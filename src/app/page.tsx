import { getLibrarianState } from "@/lib/api";
import { StatCard } from "@/components/StatCard";
import { SearchBox } from "@/components/SearchBox";
import { Zap, ArrowRight } from "lucide-react";
import Link from "next/link";

export const revalidate = 60;

export default async function HomePage() {
  let state;
  try {
    state = await getLibrarianState();
  } catch {
    state = null;
  }

  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="text-center pt-12 pb-4">
        <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-full px-4 py-1.5 mb-6">
          <Zap className="w-3.5 h-3.5 text-accent" />
          <span className="text-xs text-accent font-medium">
            The OpenRouter for Tools
          </span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
          Check before
          <br />
          you <span className="text-accent">build</span>.
        </h1>
        <p className="text-text-dim max-w-lg mx-auto text-sm leading-relaxed mb-8">
          50 curated best-in-class tools for AI agents. Living beliefs that
          evolve from real usage across 17 companies. Intelligent composition.
        </p>
        <SearchBox />
      </section>

      {/* Stats */}
      {state && (
        <section>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              label="Curated Tools"
              value={state.tool_count}
              sub="9/10+ only"
            />
            <StatCard
              label="Category Beliefs"
              value={state.belief_count}
              sub={`${state.champion_count} champions`}
            />
            <StatCard
              label="Composites"
              value={state.composite_count}
              sub="Multi-tool solutions"
            />
            <StatCard
              label="Installed"
              value={state.inventory_count}
              sub="In our fleet"
            />
          </div>
        </section>
      )}

      {/* Top Beliefs */}
      {state && state.top_beliefs.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Top Champions</h2>
            <Link
              href="/categories"
              className="text-xs text-accent flex items-center gap-1 hover:underline"
            >
              All categories <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {state.top_beliefs.slice(0, 9).map((b) => (
              <div
                key={`${b.super_category}-${b.sub_category}`}
                className="border border-border rounded-lg p-3 bg-bg-card hover:bg-bg-card-hover transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold">{b.champion}</span>
                  <span className="text-xs font-mono text-accent">
                    {Math.round(b.confidence * 100)}%
                  </span>
                </div>
                <p className="text-[10px] text-text-muted">
                  {b.super_category} /{" "}
                  {b.sub_category.replace(/_/g, " ")}
                </p>
                <div className="w-full bg-bg-surface rounded-full h-1 mt-2">
                  <div
                    className={`h-1 rounded-full transition-all duration-700 ${
                      b.confidence >= 0.8
                        ? "bg-green"
                        : b.confidence >= 0.6
                          ? "bg-accent"
                          : "bg-amber"
                    }`}
                    style={{ width: `${b.confidence * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Quick Links */}
      <section className="grid sm:grid-cols-3 gap-4 pb-8">
        <Link
          href="/tools"
          className="border border-border rounded-lg p-5 bg-bg-card hover:bg-bg-card-hover hover:border-accent/30 transition-all group"
        >
          <h3 className="font-semibold text-sm mb-1 group-hover:text-accent transition-colors">
            Browse Registry
          </h3>
          <p className="text-xs text-text-dim">
            All 50 curated tools with ratings, protocols, and capabilities.
          </p>
        </Link>
        <Link
          href="/categories"
          className="border border-border rounded-lg p-5 bg-bg-card hover:bg-bg-card-hover hover:border-accent/30 transition-all group"
        >
          <h3 className="font-semibold text-sm mb-1 group-hover:text-accent transition-colors">
            Category Map
          </h3>
          <p className="text-xs text-text-dim">
            11 super-categories, 89 sub-categories, champion beliefs.
          </p>
        </Link>
        <Link
          href="/composites"
          className="border border-border rounded-lg p-5 bg-bg-card hover:bg-bg-card-hover hover:border-accent/30 transition-all group"
        >
          <h3 className="font-semibold text-sm mb-1 group-hover:text-accent transition-colors">
            Composites
          </h3>
          <p className="text-xs text-text-dim">
            Multi-tool solutions assembled from the registry.
          </p>
        </Link>
      </section>
    </div>
  );
}
