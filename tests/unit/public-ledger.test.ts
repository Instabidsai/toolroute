import { describe, expect, it } from "vitest";
import {
  buildPublicLedgerRollups,
  summarizePublicLedger,
} from "@/lib/public-ledger";

describe("public ledger rollups", () => {
  it("groups anon-safe usage by tool with latency percentiles", () => {
    const rollups = buildPublicLedgerRollups([
      { tool_slug: "search", response_status: 200, latency_ms: 10 },
      { tool_slug: "search", response_status: 201, latency_ms: 20 },
      { tool_slug: "search", response_status: 500, latency_ms: 30 },
      { tool_slug: "email", response_status: 202, latency_ms: 100 },
      { tool_slug: "email", response_status: 429, latency_ms: 400 },
      { tool_slug: null, response_status: 200, latency_ms: 1 },
    ]);

    expect(rollups[0]).toEqual({
      tool_slug: "search",
      total_calls: 3,
      success_calls: 2,
      error_calls: 1,
      success_rate: 66.67,
      p50_latency_ms: 20,
      p99_latency_ms: 30,
    });
    expect(rollups[1]).toMatchObject({
      tool_slug: "email",
      total_calls: 2,
      success_rate: 50,
      p50_latency_ms: 100,
      p99_latency_ms: 400,
    });
  });

  it("summarizes total public ledger traffic", () => {
    const summary = summarizePublicLedger([
      {
        tool_slug: "search",
        total_calls: 3,
        success_calls: 2,
        error_calls: 1,
        success_rate: 66.67,
        p50_latency_ms: 20,
        p99_latency_ms: 30,
      },
      {
        tool_slug: "email",
        total_calls: 2,
        success_calls: 2,
        error_calls: 0,
        success_rate: 100,
        p50_latency_ms: 100,
        p99_latency_ms: 100,
      },
    ]);

    expect(summary).toEqual({
      total_calls: 5,
      total_errors: 1,
      tools_with_traffic: 2,
      success_rate: 80,
    });
  });
});
