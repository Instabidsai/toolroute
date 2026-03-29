import type { Metadata } from "next";
import { getLibrarianState, getUsageEvents, getTools, getBeliefs } from "@/lib/api";
import { StatCard } from "@/components/StatCard";
import { Activity, TrendingUp, AlertCircle, CheckCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Discovery Dashboard — ToolRoute",
  description:
    "System health, usage events, and belief intelligence for the ToolRoute registry. Track tool usage across 17 companies in real time.",
  alternates: {
    canonical: "/discover",
  },
  openGraph: {
    title: "Discovery Dashboard — ToolRoute",
    description: "System health, usage events, and belief intelligence.",
    url: "https://toolroute.ai/discover",
  },
};

export const revalidate = 30;

export default async function DiscoverPage() {
  const [state, events, tools, beliefs] = await Promise.all([
    getLibrarianState(),
    getUsageEvents(20),
    getTools(),
    getBeliefs(),
  ]);

  const toolMap = new Map(tools.map((t) => [t.slug, t]));

  const highConfidence = beliefs.filter((b) => b.confidence >= 0.8);
  const lowConfidence = beliefs.filter(
    (b) => b.confidence < 0.6 && b.confidence > 0
  );
  const uncovered = beliefs.filter((b) => b.observation_count === 0);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Discovery Dashboard</h1>
        <p className="text-sm text-text-dim">
          System health, usage events, and belief intelligence.
        </p>
      </div>

      {/* System Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatCard
          label="Tools"
          value={state.tool_count}
          sub="Curated registry"
        />
        <StatCard
          label="Beliefs"
          value={state.belief_count}
          sub={`${highConfidence.length} high confidence`}
        />
        <StatCard
          label="Usage (7d)"
          value={state.usage_events_7d}
          sub="Events recorded"
        />
        <StatCard
          label="Pending"
          value={state.pending_discoveries}
          sub="To review"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Usage */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold">Recent Usage Events</h2>
          </div>
          <div className="border border-border rounded-lg bg-bg-card divide-y divide-border">
            {events.length > 0 ? (
              events.slice(0, 10).map((e) => {
                const tool = toolMap.get(e.tool_slug);
                const outcomeColor =
                  e.outcome === "success"
                    ? "text-green"
                    : e.outcome === "failure"
                      ? "text-red"
                      : "text-amber";
                return (
                  <div key={e.id} className="px-4 py-2.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">
                        {tool?.name || e.tool_slug}
                      </p>
                      <p className="text-[10px] text-text-muted">
                        {e.company} &middot; {e.action}
                      </p>
                    </div>
                    <span className={`text-[10px] font-mono ${outcomeColor}`}>
                      {e.outcome}
                    </span>
                    {e.duration_ms && (
                      <span className="text-[10px] text-text-muted">
                        {(e.duration_ms / 1000).toFixed(1)}s
                      </span>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="px-4 py-8 text-center text-xs text-text-dim">
                No usage events yet. Use record_usage() to start tracking.
              </div>
            )}
          </div>
        </section>

        {/* Belief Health */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-green" />
            <h2 className="text-sm font-semibold">Belief Health</h2>
          </div>

          {/* High confidence */}
          <div className="border border-border rounded-lg bg-bg-card p-4 mb-3">
            <div className="flex items-center gap-1.5 mb-2">
              <CheckCircle className="w-3.5 h-3.5 text-green" />
              <p className="text-xs font-medium text-green">
                High Confidence ({highConfidence.length})
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {highConfidence.slice(0, 12).map((b) => (
                <span
                  key={b.id}
                  className="text-[10px] bg-green/10 border border-green/20 rounded px-2 py-0.5 text-green"
                >
                  {b.champion}
                </span>
              ))}
            </div>
          </div>

          {/* Untested */}
          <div className="border border-border rounded-lg bg-bg-card p-4 mb-3">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertCircle className="w-3.5 h-3.5 text-amber" />
              <p className="text-xs font-medium text-amber">
                Untested ({uncovered.length})
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {uncovered.slice(0, 12).map((b) => (
                <span
                  key={b.id}
                  className="text-[10px] bg-amber/10 border border-amber/20 rounded px-2 py-0.5 text-amber"
                >
                  {b.champion}
                </span>
              ))}
            </div>
          </div>

          {/* Low confidence */}
          {lowConfidence.length > 0 && (
            <div className="border border-border rounded-lg bg-bg-card p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <AlertCircle className="w-3.5 h-3.5 text-red" />
                <p className="text-xs font-medium text-red">
                  Low Confidence ({lowConfidence.length})
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {lowConfidence.map((b) => (
                  <span
                    key={b.id}
                    className="text-[10px] bg-red/10 border border-red/20 rounded px-2 py-0.5 text-red"
                  >
                    {b.champion} ({Math.round(b.confidence * 100)}%)
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
