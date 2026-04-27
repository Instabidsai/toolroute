import { afterEach, describe, expect, it } from "vitest";
import {
  buildSpendAnomalyAlerts,
  buildSpendAnomalyEmailText,
  filterDedupedSpendAlerts,
  resetSpendAnomalyDedupeForTests,
} from "@/lib/spend-anomalies";

const NOW = new Date("2026-04-27T18:00:00.000Z");

describe("spend anomaly alerts", () => {
  afterEach(() => {
    resetSpendAnomalyDedupeForTests();
  });

  it("flags users above $50 and 5x their 7-day daily average", () => {
    const alerts = buildSpendAnomalyAlerts(
      [
        {
          user_id: "user-hot",
          cost_to_user: 30,
          created_at: "2026-04-27T10:00:00.000Z",
        },
        {
          user_id: "user-hot",
          cost_to_user: 25,
          created_at: "2026-04-27T12:00:00.000Z",
        },
        {
          user_id: "user-hot",
          cost_to_user: 35,
          created_at: "2026-04-24T12:00:00.000Z",
        },
        {
          user_id: "user-normal",
          cost_to_user: 55,
          created_at: "2026-04-27T12:00:00.000Z",
        },
        {
          user_id: "user-normal",
          cost_to_user: 140,
          created_at: "2026-04-24T12:00:00.000Z",
        },
      ],
      NOW
    );

    expect(alerts).toEqual([
      {
        user_id: "user-hot",
        spend_24h: 55,
        baseline_daily_avg: 5,
        multiplier: 11,
        calls_24h: 2,
      },
    ]);
  });

  it("flags first-time spikes with a zero baseline", () => {
    const alerts = buildSpendAnomalyAlerts(
      [
        {
          user_id: "user-new",
          cost_to_user: 51,
          created_at: "2026-04-27T12:00:00.000Z",
        },
      ],
      NOW
    );

    expect(alerts[0]).toMatchObject({
      user_id: "user-new",
      spend_24h: 51,
      baseline_daily_avg: 0,
      multiplier: "Infinity",
    });
  });

  it("dedupes each user for 24 hours", () => {
    const alerts = [
      {
        user_id: "user-hot",
        spend_24h: 55,
        baseline_daily_avg: 5,
        multiplier: 11,
        calls_24h: 2,
      },
    ];

    expect(filterDedupedSpendAlerts(alerts, 1000).fresh).toHaveLength(1);
    const second = filterDedupedSpendAlerts(alerts, 2000);
    expect(second.fresh).toHaveLength(0);
    expect(second.suppressed).toHaveLength(1);
    expect(filterDedupedSpendAlerts(alerts, 86_401_001).fresh).toHaveLength(1);
  });

  it("formats a concise email", () => {
    const text = buildSpendAnomalyEmailText([
      {
        user_id: "user-hot",
        spend_24h: 55,
        baseline_daily_avg: 5,
        multiplier: 11,
        calls_24h: 2,
      },
    ]);

    expect(text).toContain("user-hot: $55.0000 in 24h");
    expect(text).toContain("baseline $5.0000/day");
    expect(text).toContain("11x");
  });
});
