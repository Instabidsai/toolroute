import { afterEach, describe, expect, it } from "vitest";
import {
  buildErrorRateAlertEmailText,
  buildErrorRateAlerts,
  filterDedupedErrorAlerts,
  resetErrorAlertDedupeForTests,
} from "@/lib/error-alerts";

describe("error-rate alerts", () => {
  afterEach(() => {
    resetErrorAlertDedupeForTests();
  });

  it("flags adapters above the 20 percent error threshold", () => {
    const alerts = buildErrorRateAlerts([
      { tool_slug: "search", response_status: 200 },
      { tool_slug: "search", response_status: 500 },
      { tool_slug: "search", response_status: 503 },
      { tool_slug: "email", response_status: 200 },
      { tool_slug: "email", response_status: 201 },
      { tool_slug: "email", response_status: 429 },
    ]);

    expect(alerts).toEqual([
      {
        tool_slug: "search",
        total_calls: 3,
        error_calls: 2,
        error_rate: 66.67,
      },
      {
        tool_slug: "email",
        total_calls: 3,
        error_calls: 1,
        error_rate: 33.33,
      },
    ]);
  });

  it("dedupes alerts for one hour", () => {
    const alerts = [
      {
        tool_slug: "search",
        total_calls: 5,
        error_calls: 2,
        error_rate: 40,
      },
    ];

    expect(filterDedupedErrorAlerts(alerts, 1000).fresh).toHaveLength(1);
    const second = filterDedupedErrorAlerts(alerts, 2000);
    expect(second.fresh).toHaveLength(0);
    expect(second.suppressed).toHaveLength(1);
    expect(filterDedupedErrorAlerts(alerts, 3_700_001).fresh).toHaveLength(1);
  });

  it("formats a concise alert email", () => {
    const text = buildErrorRateAlertEmailText([
      {
        tool_slug: "search",
        total_calls: 5,
        error_calls: 2,
        error_rate: 40,
      },
    ]);

    expect(text).toContain("search: 40% errors (2/5 calls)");
    expect(text).toContain("last hour");
  });
});
