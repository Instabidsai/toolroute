"use client";

import { useState, useEffect, useCallback } from "react";
import { BarChart3, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface UsageRow {
  id: string;
  tool_slug: string;
  provider_used: string | null;
  response_status: number;
  latency_ms: number;
  cost_to_user: number;
  error_message: string | null;
  created_at: string;
}

interface ToolBreakdown {
  tool: string;
  count: number;
  totalCost: number;
  avgLatency: number;
  errorRate: number;
}

type DateRange = "7d" | "30d" | "90d";

function getStartDate(range: DateRange): string {
  const d = new Date();
  switch (range) {
    case "7d":
      d.setDate(d.getDate() - 7);
      break;
    case "30d":
      d.setDate(d.getDate() - 30);
      break;
    case "90d":
      d.setDate(d.getDate() - 90);
      break;
  }
  return d.toISOString();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: number }) {
  const ok = status >= 200 && status < 300;
  return (
    <span
      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
        ok
          ? "bg-green/10 text-green border border-green/20"
          : "bg-red/10 text-red border border-red/20"
      }`}
    >
      {status}
    </span>
  );
}

function BarChartSimple({
  data,
}: {
  data: { label: string; value: number; max: number }[];
}) {
  if (data.length === 0) {
    return (
      <div className="text-center py-6 text-xs text-text-dim">
        No data for this period
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="text-[10px] text-text-dim w-20 text-right shrink-0 truncate">
            {d.label}
          </span>
          <div className="flex-1 bg-bg-surface rounded-full h-5 overflow-hidden">
            <div
              className="h-full bg-accent/70 rounded-full transition-all duration-700 flex items-center justify-end pr-2"
              style={{
                width: d.max > 0 ? `${Math.max((d.value / d.max) * 100, 4)}%` : "4%",
              }}
            >
              <span className="text-[9px] text-white font-medium">
                {d.value}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function UsagePage() {
  const [range, setRange] = useState<DateRange>("7d");
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const fetchUsage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const startDate = getStartDate(range);
      const res = await fetch(
        `/api/v1/usage?limit=200&start_date=${encodeURIComponent(startDate)}`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to fetch usage");
      setUsage(json.data ?? []);
      setPage(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load usage data");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  // Compute breakdowns
  const toolMap = new Map<string, { count: number; cost: number; latency: number[]; errors: number }>();
  for (const row of usage) {
    const existing = toolMap.get(row.tool_slug) || {
      count: 0,
      cost: 0,
      latency: [],
      errors: 0,
    };
    existing.count++;
    existing.cost += row.cost_to_user;
    existing.latency.push(row.latency_ms);
    if (row.response_status >= 400) existing.errors++;
    toolMap.set(row.tool_slug, existing);
  }

  const breakdowns: ToolBreakdown[] = Array.from(toolMap.entries())
    .map(([tool, stats]) => ({
      tool,
      count: stats.count,
      totalCost: stats.cost,
      avgLatency: Math.round(
        stats.latency.reduce((a, b) => a + b, 0) / stats.latency.length
      ),
      errorRate: Math.round((stats.errors / stats.count) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  // Daily aggregation for chart
  const dailyMap = new Map<string, number>();
  for (const row of usage) {
    const day = new Date(row.created_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    dailyMap.set(day, (dailyMap.get(day) ?? 0) + 1);
  }
  const dailyData = Array.from(dailyMap.entries()).map(([label, value]) => ({
    label,
    value,
    max: Math.max(...Array.from(dailyMap.values())),
  }));

  // Pagination
  const paged = usage.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(usage.length / pageSize);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-32 bg-bg-card rounded animate-pulse" />
        <div className="h-48 bg-bg-card border border-border rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-text-dim" />
            Usage Analytics
          </h1>
          <p className="text-xs text-text-dim mt-1">
            {usage.length} requests in selected period
          </p>
        </div>
        <div className="flex items-center gap-1 bg-bg-card border border-border rounded-lg p-0.5">
          {(["7d", "30d", "90d"] as DateRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 rounded text-xs transition-colors ${
                range === r
                  ? "bg-accent text-white"
                  : "text-text-dim hover:text-text"
              }`}
            >
              {r === "7d" ? "7 days" : r === "30d" ? "30 days" : "90 days"}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="border border-red/20 rounded-lg bg-red/5 px-4 py-3 text-xs text-red flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Chart */}
      <section>
        <h2 className="text-sm font-semibold mb-3">Requests per Day</h2>
        <div className="border border-border rounded-lg bg-bg-card p-4">
          <BarChartSimple data={dailyData} />
        </div>
      </section>

      {/* Tool Breakdown */}
      {breakdowns.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-3">Usage by Tool</h2>
          <div className="border border-border rounded-lg bg-bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-text-muted text-[10px] uppercase tracking-wider">
                    <th className="text-left p-3 font-medium">Tool</th>
                    <th className="text-right p-3 font-medium">Calls</th>
                    <th className="text-right p-3 font-medium hidden sm:table-cell">
                      Total Cost
                    </th>
                    <th className="text-right p-3 font-medium hidden sm:table-cell">
                      Avg Latency
                    </th>
                    <th className="text-right p-3 font-medium">Error Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdowns.map((b) => (
                    <tr
                      key={b.tool}
                      className="border-b border-border/50 hover:bg-bg-surface/50 transition-colors"
                    >
                      <td className="p-3">
                        <code className="text-accent">{b.tool}</code>
                      </td>
                      <td className="p-3 text-right">{b.count}</td>
                      <td className="p-3 text-right text-text-dim hidden sm:table-cell">
                        ${b.totalCost.toFixed(4)}
                      </td>
                      <td className="p-3 text-right text-text-dim hidden sm:table-cell">
                        {b.avgLatency}ms
                      </td>
                      <td className="p-3 text-right">
                        <span
                          className={
                            b.errorRate > 10
                              ? "text-red"
                              : b.errorRate > 0
                                ? "text-amber"
                                : "text-green"
                          }
                        >
                          {b.errorRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Detailed Log */}
      <section>
        <h2 className="text-sm font-semibold mb-3">Request Log</h2>
        {usage.length === 0 ? (
          <div className="border border-border rounded-lg bg-bg-card p-6 text-center">
            <BarChart3 className="w-8 h-8 text-text-muted mx-auto mb-2" />
            <p className="text-xs text-text-dim">
              No requests in this period.
            </p>
          </div>
        ) : (
          <>
            <div className="border border-border rounded-lg bg-bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-text-muted text-[10px] uppercase tracking-wider">
                      <th className="text-left p-3 font-medium">Tool</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-left p-3 font-medium hidden sm:table-cell">
                        Latency
                      </th>
                      <th className="text-left p-3 font-medium hidden sm:table-cell">
                        Cost
                      </th>
                      <th className="text-left p-3 font-medium hidden md:table-cell">
                        Error
                      </th>
                      <th className="text-left p-3 font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-border/50 hover:bg-bg-surface/50 transition-colors"
                      >
                        <td className="p-3">
                          <code className="text-accent">{row.tool_slug}</code>
                        </td>
                        <td className="p-3">
                          <StatusBadge status={row.response_status} />
                        </td>
                        <td className="p-3 text-text-dim hidden sm:table-cell">
                          {row.latency_ms}ms
                        </td>
                        <td className="p-3 text-text-dim hidden sm:table-cell">
                          ${row.cost_to_user.toFixed(4)}
                        </td>
                        <td className="p-3 text-text-dim hidden md:table-cell max-w-[200px] truncate">
                          {row.error_message || "-"}
                        </td>
                        <td className="p-3 text-text-dim whitespace-nowrap">
                          {formatDate(row.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-3">
                <span className="text-[10px] text-text-muted">
                  Page {page + 1} of {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="p-1 rounded hover:bg-bg-surface disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() =>
                      setPage((p) => Math.min(totalPages - 1, p + 1))
                    }
                    disabled={page >= totalPages - 1}
                    className="p-1 rounded hover:bg-bg-surface disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
