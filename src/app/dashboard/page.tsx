"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Wallet,
  Activity,
  CalendarDays,
  Crown,
  Key,
  Plus,
  ExternalLink,
  BookOpen,
  Search,
  Copy,
  Check,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/lib/supabase";
import {
  buildSevenDayUsageChart,
  type UsageChartPoint,
} from "@/lib/dashboard-metrics";

interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

interface UsageRow {
  id: string;
  tool_slug: string;
  response_status: number;
  latency_ms: number;
  cost_to_user: number;
  created_at: string;
  error_message: string | null;
}

interface DashboardData {
  email: string;
  plan: string;
  creditBalance: number;
  requestsToday: number;
  requestsMonth: number;
  keys: ApiKeyRow[];
  recentUsage: UsageRow[];
  usageChart: UsageChartPoint[];
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
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

function PlanBadge({ plan }: { plan: string }) {
  const colors: Record<string, string> = {
    free: "bg-text-muted/10 text-text-dim border-border",
    builder: "bg-accent/10 text-accent border-accent/20",
    pro: "bg-amber/10 text-amber border-amber/20",
    enterprise: "bg-purple/10 text-purple border-purple/20",
  };
  const cls = colors[plan] || colors.free;
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider border ${cls}`}
    >
      {plan}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="text-text-muted hover:text-accent transition-colors"
      title="Copy prefix"
    >
      {copied ? (
        <Check className="w-3 h-3 text-green" />
      ) : (
        <Copy className="w-3 h-3" />
      )}
    </button>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const token = session.access_token;
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
      };
      const now = new Date();
      const usageStart = new Date(now);
      usageStart.setDate(now.getDate() - 6);
      usageStart.setHours(0, 0, 0, 0);

      const [keysRes, usageRes] = await Promise.all([
        fetch("/api/v1/keys", { headers }),
        fetch(
          `/api/v1/usage?limit=200&start_date=${encodeURIComponent(
            usageStart.toISOString()
          )}`,
          { headers }
        ),
      ]);

      const keysJson = await keysRes.json();
      const usageJson = await usageRes.json();

      if (!keysRes.ok || !usageRes.ok) {
        throw new Error(
          keysJson.error?.message ||
            usageJson.error?.message ||
            "Failed to fetch dashboard data"
        );
      }

      // Get user info from gateway_users via Supabase
      const { data: gwUser } = await supabase
        .from("gateway_users")
        .select("credit_balance, plan_slug")
        .eq("id", session.user.id)
        .single();

      // Count today and month requests from usage
      const dayStart = new Date(now);
      dayStart.setUTCHours(0, 0, 0, 0);
      const monthStart = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);

      const { count: todayCount } = await supabase
        .from("gateway_usage_log")
        .select("id", { count: "exact", head: true })
        .eq("user_id", session.user.id)
        .gte("created_at", dayStart.toISOString());

      const { count: monthCount } = await supabase
        .from("gateway_usage_log")
        .select("id", { count: "exact", head: true })
        .eq("user_id", session.user.id)
        .gte("created_at", monthStart.toISOString());

      setData({
        email: session.user.email ?? "",
        plan: gwUser?.plan_slug ?? "free",
        creditBalance: gwUser?.credit_balance ?? 0,
        requestsToday: todayCount ?? 0,
        requestsMonth: monthCount ?? 0,
        keys: keysJson.data ?? [],
        recentUsage: (usageJson.data ?? []).slice(0, 10),
        usageChart: buildSevenDayUsageChart(usageJson.data ?? [], now),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-bg-card rounded animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-24 bg-bg-card border border-border rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-red/20 rounded-lg bg-red/5 p-6 text-center">
        <p className="text-sm text-red">{error}</p>
        <button
          onClick={() => {
            setError(null);
            setLoading(true);
            fetchDashboard();
          }}
          className="mt-3 text-xs text-accent hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-8 animate-slide-up">
      {/* Welcome */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-xs text-text-dim mt-1">
            {data.email} <PlanBadge plan={data.plan} />
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="border border-border rounded-lg p-4 bg-bg-card">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-3.5 h-3.5 text-green" />
            <p className="text-[10px] uppercase tracking-wider text-text-muted">
              Credit Balance
            </p>
          </div>
          <p className="text-2xl font-bold text-text">
            ${data.creditBalance.toFixed(2)}
          </p>
          <Link
            href="/dashboard/billing"
            className="text-[10px] text-accent hover:underline"
          >
            Buy credits
          </Link>
        </div>
        <div className="border border-border rounded-lg p-4 bg-bg-card">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-3.5 h-3.5 text-accent" />
            <p className="text-[10px] uppercase tracking-wider text-text-muted">
              Requests Today
            </p>
          </div>
          <p className="text-2xl font-bold text-text">{data.requestsToday}</p>
        </div>
        <div className="border border-border rounded-lg p-4 bg-bg-card">
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays className="w-3.5 h-3.5 text-cyan" />
            <p className="text-[10px] uppercase tracking-wider text-text-muted">
              This Month
            </p>
          </div>
          <p className="text-2xl font-bold text-text">{data.requestsMonth}</p>
        </div>
        <div className="border border-border rounded-lg p-4 bg-bg-card">
          <div className="flex items-center gap-2 mb-1">
            <Crown className="w-3.5 h-3.5 text-amber" />
            <p className="text-[10px] uppercase tracking-wider text-text-muted">
              Plan
            </p>
          </div>
          <p className="text-2xl font-bold text-text capitalize">{data.plan}</p>
          <Link
            href="/dashboard/billing"
            className="text-[10px] text-accent hover:underline"
          >
            Upgrade
          </Link>
        </div>
      </div>

      {/* 7-day usage chart */}
      <section className="border border-border rounded-lg bg-bg-card p-4">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-text-dim" />
              Usage Last 7 Days
            </h2>
            <p className="text-[10px] text-text-muted mt-1">
              Requests and billed usage from the gateway ledger.
            </p>
          </div>
          <Link
            href="/dashboard/usage"
            className="text-xs text-accent hover:underline"
          >
            Details
          </Link>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.usageChart}>
              <CartesianGrid
                stroke="var(--color-border)"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fill: "var(--color-text-dim)", fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: "var(--color-border)" }}
              />
              <YAxis
                yAxisId="requests"
                tick={{ fill: "var(--color-text-dim)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={32}
              />
              <Tooltip
                cursor={{ fill: "rgba(99, 102, 241, 0.08)" }}
                contentStyle={{
                  background: "var(--color-bg-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  color: "var(--color-text)",
                  fontSize: 12,
                }}
                formatter={(value, name) =>
                  name === "cost"
                    ? [`$${Number(value).toFixed(4)}`, "Cost"]
                    : [value, "Requests"]
                }
              />
              <Bar
                yAxisId="requests"
                dataKey="requests"
                fill="var(--color-accent)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* API Keys */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Key className="w-4 h-4 text-text-dim" />
            API Keys
          </h2>
          <Link
            href="/dashboard/keys"
            className="flex items-center gap-1 text-xs text-accent hover:underline"
          >
            <Plus className="w-3 h-3" />
            Create Key
          </Link>
        </div>

        {data.keys.length === 0 ? (
          <div className="border border-border rounded-lg bg-bg-card p-6 text-center">
            <Key className="w-8 h-8 text-text-muted mx-auto mb-2" />
            <p className="text-xs text-text-dim mb-3">
              No API keys yet. Create one to start making requests.
            </p>
            <Link
              href="/dashboard/keys"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-accent text-white text-xs hover:bg-accent-hover transition-colors"
            >
              <Plus className="w-3 h-3" />
              Create API Key
            </Link>
          </div>
        ) : (
          <div className="border border-border rounded-lg bg-bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-text-muted text-[10px] uppercase tracking-wider">
                    <th className="text-left p-3 font-medium">Name</th>
                    <th className="text-left p-3 font-medium">Prefix</th>
                    <th className="text-left p-3 font-medium hidden sm:table-cell">
                      Last Used
                    </th>
                    <th className="text-left p-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.keys.slice(0, 5).map((key) => (
                    <tr
                      key={key.id}
                      className="border-b border-border/50 hover:bg-bg-surface/50 transition-colors"
                    >
                      <td className="p-3 font-medium">{key.name}</td>
                      <td className="p-3">
                        <span className="flex items-center gap-1.5">
                          <code className="text-text-dim">
                            {key.key_prefix}...
                          </code>
                          <CopyButton text={key.key_prefix} />
                        </span>
                      </td>
                      <td className="p-3 text-text-dim hidden sm:table-cell">
                        {key.last_used_at
                          ? formatTime(key.last_used_at)
                          : "Never"}
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            key.is_active
                              ? "bg-green/10 text-green border border-green/20"
                              : "bg-red/10 text-red border border-red/20"
                          }`}
                        >
                          {key.is_active ? "Active" : "Revoked"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.keys.length > 5 && (
              <div className="p-2 text-center border-t border-border/50">
                <Link
                  href="/dashboard/keys"
                  className="text-[10px] text-accent hover:underline"
                >
                  View all {data.keys.length} keys
                </Link>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Recent Usage */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Activity className="w-4 h-4 text-text-dim" />
            Recent Requests
          </h2>
          <Link
            href="/dashboard/usage"
            className="text-xs text-accent hover:underline"
          >
            View all
          </Link>
        </div>

        {data.recentUsage.length === 0 ? (
          <div className="border border-border rounded-lg bg-bg-card p-6 text-center">
            <Activity className="w-8 h-8 text-text-muted mx-auto mb-2" />
            <p className="text-xs text-text-dim">
              No requests yet. Use your API key to make your first call.
            </p>
          </div>
        ) : (
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
                    <th className="text-left p-3 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentUsage.map((row) => (
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
                      <td className="p-3 text-text-dim">
                        {formatTime(row.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Quick Actions */}
      <section>
        <h2 className="text-sm font-semibold mb-3">Quick Actions</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <Link
            href="/dashboard/billing"
            className="border border-border rounded-lg p-4 bg-bg-card hover:bg-bg-card-hover hover:border-accent/30 transition-all group"
          >
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-4 h-4 text-green group-hover:text-accent transition-colors" />
              <h3 className="text-xs font-semibold group-hover:text-accent transition-colors">
                Buy Credits
              </h3>
            </div>
            <p className="text-[10px] text-text-dim">
              Top up your balance to keep making requests.
            </p>
          </Link>
          <Link
            href="/discover"
            className="border border-border rounded-lg p-4 bg-bg-card hover:bg-bg-card-hover hover:border-accent/30 transition-all group"
          >
            <div className="flex items-center gap-2 mb-1">
              <Search className="w-4 h-4 text-cyan group-hover:text-accent transition-colors" />
              <h3 className="text-xs font-semibold group-hover:text-accent transition-colors">
                Browse Tools
              </h3>
            </div>
            <p className="text-[10px] text-text-dim">
              Explore 70+ curated tools available through the gateway.
            </p>
          </Link>
          <a
            href="https://toolroute.ai/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="border border-border rounded-lg p-4 bg-bg-card hover:bg-bg-card-hover hover:border-accent/30 transition-all group"
          >
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-4 h-4 text-amber group-hover:text-accent transition-colors" />
              <h3 className="text-xs font-semibold group-hover:text-accent transition-colors">
                View Docs
              </h3>
              <ExternalLink className="w-3 h-3 text-text-muted" />
            </div>
            <p className="text-[10px] text-text-dim">
              Integration guides, API reference, and examples.
            </p>
          </a>
        </div>
      </section>
    </div>
  );
}
