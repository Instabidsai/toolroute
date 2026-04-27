import type { Metadata } from "next";
import { Activity, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { listRegisteredAdapters, supabaseAdmin } from "@/lib/gateway";
import {
  buildAdapterStatusMetrics,
  type GatewayUsageRow,
} from "@/lib/status-metrics";

export const revalidate = 30;

export const metadata: Metadata = {
  title: "ToolRoute Status | 24h Adapter Health",
  description:
    "Live ToolRoute adapter status with 24-hour uptime, call count, latency, and revenue rollups.",
  alternates: {
    canonical: "/status",
  },
};

async function getUsageRows() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin()
    .from("gateway_usage_log")
    .select("tool_slug, response_status, latency_ms, cost_to_user")
    .gte("created_at", since)
    .limit(10000);

  if (error) {
    console.error("Status page usage query failed:", error.message);
    return [];
  }

  return (data ?? []) as GatewayUsageRow[];
}

function formatPct(value: number | null) {
  return value === null ? "No traffic" : `${value.toFixed(2)}%`;
}

function formatMs(value: number | null) {
  return value === null ? "-" : `${value}ms`;
}

export default async function StatusPage() {
  const adapters = listRegisteredAdapters();
  const usageRows = await getUsageRows();
  const metrics = buildAdapterStatusMetrics(adapters, usageRows);
  const totalCalls = metrics.reduce((sum, row) => sum + row.total_calls, 0);
  const totalErrors = metrics.reduce((sum, row) => sum + row.error_calls, 0);
  const weightedUptime =
    totalCalls === 0 ? null : Number((((totalCalls - totalErrors) / totalCalls) * 100).toFixed(2));
  const activeAdapters = metrics.filter((row) => row.total_calls > 0).length;
  const lastChecked = new Date().toISOString().replace("T", " ").slice(0, 19);

  return (
    <div className="space-y-8 pb-16">
      <section className="space-y-4 border-b border-border pb-8">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-accent" />
          <h1 className="text-3xl font-bold tracking-tight">System Status</h1>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-text-dim">
          Per-adapter 24h uptime from `gateway_usage_log`. This page reflects
          ToolRoute traffic and errors, not every upstream provider's global
          status page.
        </p>
        <p className="text-xs text-text-muted">Last checked {lastChecked} UTC</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-bg-card p-5">
          <p className="text-xs uppercase tracking-wider text-text-muted">
            24h uptime
          </p>
          <div className="mt-3 flex items-center gap-2">
            {weightedUptime === null || weightedUptime >= 99 ? (
              <CheckCircle className="h-5 w-5 text-green" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber" />
            )}
            <p className="text-2xl font-bold">{formatPct(weightedUptime)}</p>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-bg-card p-5">
          <p className="text-xs uppercase tracking-wider text-text-muted">
            Calls
          </p>
          <p className="mt-3 text-2xl font-bold">{totalCalls}</p>
        </div>
        <div className="rounded-lg border border-border bg-bg-card p-5">
          <p className="text-xs uppercase tracking-wider text-text-muted">
            Error calls
          </p>
          <p className="mt-3 text-2xl font-bold">{totalErrors}</p>
        </div>
        <div className="rounded-lg border border-border bg-bg-card p-5">
          <p className="text-xs uppercase tracking-wider text-text-muted">
            Active adapters
          </p>
          <p className="mt-3 text-2xl font-bold">
            {activeAdapters}/{metrics.length}
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold">Adapter 24h Uptime</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th className="px-5 py-3 font-medium">Adapter</th>
                <th className="px-5 py-3 font-medium">Uptime</th>
                <th className="px-5 py-3 font-medium">Calls</th>
                <th className="px-5 py-3 font-medium">Errors</th>
                <th className="px-5 py-3 font-medium">p50</th>
                <th className="px-5 py-3 font-medium">p99</th>
                <th className="px-5 py-3 font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((adapter) => (
                <tr key={adapter.slug} className="border-b border-border/60 last:border-0">
                  <td className="px-5 py-3">
                    <div className="font-medium">{adapter.name}</div>
                    <code className="text-xs text-text-muted">{adapter.slug}</code>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={
                        adapter.uptime_pct === null || adapter.uptime_pct >= 99
                          ? "text-green"
                          : "text-amber"
                      }
                    >
                      {formatPct(adapter.uptime_pct)}
                    </span>
                  </td>
                  <td className="px-5 py-3">{adapter.total_calls}</td>
                  <td className="px-5 py-3">{adapter.error_calls}</td>
                  <td className="px-5 py-3">{formatMs(adapter.p50_latency_ms)}</td>
                  <td className="px-5 py-3">{formatMs(adapter.p99_latency_ms)}</td>
                  <td className="px-5 py-3">${adapter.revenue_24h.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex items-start gap-3 rounded-lg border border-border bg-bg-card p-5 text-sm text-text-dim">
        <Clock className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
        <p>
          Adapters with no calls in the last 24 hours show "No traffic" instead
          of a synthetic uptime score. The page refreshes every 30 seconds.
        </p>
      </section>
    </div>
  );
}
