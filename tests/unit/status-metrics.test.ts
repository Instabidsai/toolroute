import { describe, expect, it } from "vitest";
import type { ToolAdapter } from "@/lib/gateway-types";
import { buildAdapterStatusMetrics } from "@/lib/status-metrics";

function adapter(slug: string, name = slug) {
  return {
    slug,
    name,
    operations: ["run"],
  } as ToolAdapter;
}

describe("buildAdapterStatusMetrics", () => {
  it("computes 24h uptime and latency rollups per adapter", () => {
    const metrics = buildAdapterStatusMetrics(
      [adapter("openai", "OpenAI"), adapter("tavily", "Tavily")],
      [
        {
          tool_slug: "openai",
          response_status: 200,
          latency_ms: 100,
          cost_to_user: 0.01,
        },
        {
          tool_slug: "openai",
          response_status: 500,
          latency_ms: 400,
          cost_to_user: 0,
        },
        {
          tool_slug: "openai",
          response_status: 204,
          latency_ms: 200,
          cost_to_user: 0.02,
        },
      ]
    );

    expect(metrics[0]).toMatchObject({
      slug: "openai",
      total_calls: 3,
      success_calls: 2,
      error_calls: 1,
      uptime_pct: 66.67,
      p50_latency_ms: 200,
      p99_latency_ms: 400,
      revenue_24h: 0.03,
    });
    expect(metrics[1]).toMatchObject({
      slug: "tavily",
      total_calls: 0,
      uptime_pct: null,
      p50_latency_ms: null,
    });
  });
});
