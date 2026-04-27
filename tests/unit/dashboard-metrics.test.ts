import { describe, expect, it } from "vitest";
import { buildSevenDayUsageChart } from "@/lib/dashboard-metrics";

describe("buildSevenDayUsageChart", () => {
  it("returns seven ordered days with request counts and cost totals", () => {
    const now = new Date("2026-04-27T12:00:00.000Z");

    const chart = buildSevenDayUsageChart(
      [
        { created_at: "2026-04-27T01:00:00.000Z", cost_to_user: 0.01 },
        { created_at: "2026-04-27T02:00:00.000Z", cost_to_user: 0.02 },
        { created_at: "2026-04-24T02:00:00.000Z", cost_to_user: 0.005 },
        { created_at: "2026-04-01T02:00:00.000Z", cost_to_user: 99 },
      ],
      now
    );

    expect(chart).toHaveLength(7);
    expect(chart.map((point) => point.date)).toEqual([
      "2026-04-21",
      "2026-04-22",
      "2026-04-23",
      "2026-04-24",
      "2026-04-25",
      "2026-04-26",
      "2026-04-27",
    ]);
    expect(chart[3]).toMatchObject({ requests: 1, cost: 0.005 });
    expect(chart[6]).toMatchObject({ requests: 2, cost: 0.03 });
  });
});
