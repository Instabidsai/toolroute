export interface PublicLedgerRow {
  tool_slug: string | null;
  response_status: number | null;
  latency_ms: number | null;
}

export interface PublicLedgerRollup {
  tool_slug: string;
  total_calls: number;
  success_calls: number;
  error_calls: number;
  success_rate: number;
  p50_latency_ms: number | null;
  p99_latency_ms: number | null;
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

export function buildPublicLedgerRollups(
  rows: PublicLedgerRow[]
): PublicLedgerRollup[] {
  const grouped = new Map<string, PublicLedgerRow[]>();

  for (const row of rows) {
    if (!row.tool_slug) continue;
    const toolRows = grouped.get(row.tool_slug) ?? [];
    toolRows.push(row);
    grouped.set(row.tool_slug, toolRows);
  }

  return Array.from(grouped.entries())
    .map(([tool_slug, toolRows]) => {
      const totalCalls = toolRows.length;
      const successCalls = toolRows.filter((row) =>
        isSuccessStatus(row.response_status)
      ).length;
      const latencies = toolRows
        .map((row) => row.latency_ms)
        .filter((value): value is number => typeof value === "number");

      return {
        tool_slug,
        total_calls: totalCalls,
        success_calls: successCalls,
        error_calls: totalCalls - successCalls,
        success_rate: totalCalls
          ? Number(((successCalls / totalCalls) * 100).toFixed(2))
          : 0,
        p50_latency_ms: percentile(latencies, 50),
        p99_latency_ms: percentile(latencies, 99),
      };
    })
    .sort((a, b) => b.total_calls - a.total_calls || a.tool_slug.localeCompare(b.tool_slug));
}

export function summarizePublicLedger(rollups: PublicLedgerRollup[]) {
  const totalCalls = rollups.reduce((sum, row) => sum + row.total_calls, 0);
  const totalErrors = rollups.reduce((sum, row) => sum + row.error_calls, 0);
  const toolsWithTraffic = rollups.filter((row) => row.total_calls > 0).length;
  const successRate = totalCalls
    ? Number((((totalCalls - totalErrors) / totalCalls) * 100).toFixed(2))
    : 0;

  return {
    total_calls: totalCalls,
    total_errors: totalErrors,
    tools_with_traffic: toolsWithTraffic,
    success_rate: successRate,
  };
}
