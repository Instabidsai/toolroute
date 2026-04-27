import type { Metadata } from "next";
import { Activity, BarChart3, Clock, Database, ShieldCheck } from "lucide-react";
import { supabaseAdmin } from "@/lib/gateway";
import {
  buildPublicLedgerRollups,
  summarizePublicLedger,
  type PublicLedgerRow,
} from "@/lib/public-ledger";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "ToolRoute Public Ledger | Anon-Safe Tool Usage Rollups",
  description:
    "Anon-safe ToolRoute usage rollups by tool: 24-hour call count, success rate, and p50/p99 latency.",
  alternates: {
    canonical: "/ledger",
  },
};

async function getPublicLedgerRows() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin()
    .from("gateway_usage_log")
    .select("tool_slug, response_status, latency_ms")
    .gte("created_at", since)
    .limit(20000);

  if (error) {
    console.error("Public ledger query failed:", error.message);
    return { since, rows: [] as PublicLedgerRow[] };
  }

  return { since, rows: (data ?? []) as PublicLedgerRow[] };
}

function formatPct(value: number) {
  return `${value.toFixed(2)}%`;
}

function formatMs(value: number | null) {
  return value === null ? "-" : `${value}ms`;
}

export default async function PublicLedgerPage() {
  const { since, rows } = await getPublicLedgerRows();
  const rollups = buildPublicLedgerRollups(rows);
  const summary = summarizePublicLedger(rollups);
  const lastChecked = new Date().toISOString().replace("T", " ").slice(0, 19);

  return (
    <div className="space-y-8 pb-16">
      <section className="space-y-4 border-b border-border pb-8">
        <div className="flex items-center gap-3">
          <Database className="h-6 w-6 text-accent" />
          <h1 className="text-3xl font-bold tracking-tight">Public Ledger</h1>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-text-dim">
          Anon-safe 24-hour rollups from ToolRoute gateway traffic. This page
          only exposes tool-level counts, success rate, and latency percentiles.
          It does not expose users, API keys, prompts, inputs, or outputs.
        </p>
        <div className="flex flex-wrap gap-3 text-xs text-text-muted">
          <span>Window starts {since.replace("T", " ").slice(0, 19)} UTC</span>
          <span>Last checked {lastChecked} UTC</span>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-bg-card p-5">
          <p className="text-xs uppercase tracking-wider text-text-muted">
            Calls
          </p>
          <p className="mt-3 text-2xl font-bold">{summary.total_calls}</p>
        </div>
        <div className="rounded-lg border border-border bg-bg-card p-5">
          <p className="text-xs uppercase tracking-wider text-text-muted">
            Success rate
          </p>
          <p className="mt-3 text-2xl font-bold">
            {formatPct(summary.success_rate)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-bg-card p-5">
          <p className="text-xs uppercase tracking-wider text-text-muted">
            Tool rollups
          </p>
          <p className="mt-3 text-2xl font-bold">
            {summary.tools_with_traffic}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-bg-card p-5">
          <p className="text-xs uppercase tracking-wider text-text-muted">
            Error calls
          </p>
          <p className="mt-3 text-2xl font-bold">{summary.total_errors}</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5 text-accent" />
            24h Tool Rollups
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th className="px-5 py-3 font-medium">Tool</th>
                <th className="px-5 py-3 font-medium">Calls</th>
                <th className="px-5 py-3 font-medium">Success</th>
                <th className="px-5 py-3 font-medium">Errors</th>
                <th className="px-5 py-3 font-medium">p50</th>
                <th className="px-5 py-3 font-medium">p99</th>
              </tr>
            </thead>
            <tbody>
              {rollups.length ? (
                rollups.map((tool) => (
                  <tr
                    key={tool.tool_slug}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="px-5 py-3">
                      <code className="text-xs text-accent">
                        {tool.tool_slug}
                      </code>
                    </td>
                    <td className="px-5 py-3">{tool.total_calls}</td>
                    <td className="px-5 py-3">
                      {formatPct(tool.success_rate)}
                    </td>
                    <td className="px-5 py-3">{tool.error_calls}</td>
                    <td className="px-5 py-3">
                      {formatMs(tool.p50_latency_ms)}
                    </td>
                    <td className="px-5 py-3">
                      {formatMs(tool.p99_latency_ms)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-5 py-6 text-sm text-text-dim" colSpan={6}>
                    No public ledger traffic in the current 24-hour window.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="flex items-start gap-3 rounded-lg border border-border bg-bg-card p-5 text-sm text-text-dim">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-green" />
          <p>
            The ledger is intentionally aggregate-only. Raw usage events remain
            private and owner-scoped.
          </p>
        </div>
        <div className="flex items-start gap-3 rounded-lg border border-border bg-bg-card p-5 text-sm text-text-dim">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
          <p>
            Percentiles use observed gateway latency in milliseconds. Empty
            latency samples render as a dash.
          </p>
        </div>
      </section>

      <section className="flex items-start gap-3 text-sm text-text-dim">
        <Activity className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
        <p>
          For operational health with adapter inventory and uptime targets, use
          the status page. This ledger is public proof of aggregate gateway
          activity only.
        </p>
      </section>
    </div>
  );
}
