import type { ToolAdapter } from "./gateway-types";

export interface GatewayUsageRow {
  tool_slug: string | null;
  response_status: number | null;
  latency_ms: number | null;
  cost_to_user?: number | null;
}

export interface AdapterStatusMetric {
  slug: string;
  name: string;
  operations: number;
  total_calls: number;
  success_calls: number;
  error_calls: number;
  uptime_pct: number | null;
  p50_latency_ms: number | null;
  p99_latency_ms: number | null;
  revenue_24h: number;
}

function percentile(values: number[], pct: number) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1)
  );
  return sorted[index];
}

function isSuccessStatus(status: number | null) {
  return typeof status === "number" && status >= 200 && status < 400;
}

export function buildAdapterStatusMetrics(
  adapters: ToolAdapter[],
  rows: GatewayUsageRow[]
): AdapterStatusMetric[] {
  const rowsByAdapter = new Map<string, GatewayUsageRow[]>();

  for (const row of rows) {
    if (!row.tool_slug) continue;
    const adapterRows = rowsByAdapter.get(row.tool_slug) ?? [];
    adapterRows.push(row);
    rowsByAdapter.set(row.tool_slug, adapterRows);
  }

  return adapters
    .map((adapter) => {
      const adapterRows = rowsByAdapter.get(adapter.slug) ?? [];
      const successCalls = adapterRows.filter((row) =>
        isSuccessStatus(row.response_status)
      ).length;
      const totalCalls = adapterRows.length;
      const latencies = adapterRows
        .map((row) => row.latency_ms)
        .filter((value): value is number => typeof value === "number");
      const revenue = adapterRows.reduce(
        (sum, row) => sum + (Number(row.cost_to_user) || 0),
        0
      );

      return {
        slug: adapter.slug,
        name: adapter.name,
        operations: adapter.operations.length,
        total_calls: totalCalls,
        success_calls: successCalls,
        error_calls: totalCalls - successCalls,
        uptime_pct: totalCalls
          ? Number(((successCalls / totalCalls) * 100).toFixed(2))
          : null,
        p50_latency_ms: percentile(latencies, 50),
        p99_latency_ms: percentile(latencies, 99),
        revenue_24h: Number(revenue.toFixed(4)),
      };
    })
    .sort((a, b) => {
      if (a.total_calls !== b.total_calls) return b.total_calls - a.total_calls;
      return a.slug.localeCompare(b.slug);
    });
}
