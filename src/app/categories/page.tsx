import type { Metadata } from "next";
import { getCategories, getBeliefs, getTools } from "@/lib/api";
import { SUPER_CATEGORIES } from "@/lib/types";
import Link from "next/link";
import {
  MessageSquare, Target, Calendar, BarChart3, ShoppingCart,
  GitBranch, DollarSign, PenTool, Megaphone, Settings, Shield, Server,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Category Map — ToolRoute",
  description:
    "Explore 12 super-categories and 89 sub-categories of AI agent tools. Each category has a champion tool with a living belief based on real usage.",
  alternates: {
    canonical: "/categories",
  },
  openGraph: {
    title: "Category Map — ToolRoute",
    description: "Explore 12 super-categories of AI agent tools with champion beliefs.",
    url: "https://toolroute.ai/categories",
  },
};

export const revalidate = 60;

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  MessageSquare, Target, Calendar, BarChart3, ShoppingCart,
  GitBranch, DollarSign, PenTool, Megaphone, Settings, Shield, Server,
};

export default async function CategoriesPage() {
  const [categories, beliefs, tools] = await Promise.all([
    getCategories(),
    getBeliefs(),
    getTools(),
  ]);

  const grouped = SUPER_CATEGORIES.map((sc) => {
    const subs = categories.filter((c) => c.super_category === sc.key);
    const catBeliefs = beliefs.filter((b) => b.super_category === sc.key);
    const catTools = tools.filter((t) => t.super_category === sc.key);
    return { ...sc, subs, beliefs: catBeliefs, toolCount: catTools.length };
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Category Map</h1>
        <p className="text-sm text-text-dim">
          {SUPER_CATEGORIES.length} super-categories, {categories.length}{" "}
          sub-categories. Each has a champion with a living belief.
        </p>
      </div>

      <div className="grid gap-6">
        {grouped.map((group) => {
          const Icon = iconMap[group.icon] || Server;
          return (
            <Link
              key={group.key}
              href={`/categories/${group.key}`}
              className="border border-border rounded-lg p-5 bg-bg-card hover:bg-bg-card-hover hover:border-border-bright transition-all group"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Icon className="w-4.5 h-4.5 text-accent" />
                </div>
                <div className="flex-1">
                  <h2 className="text-sm font-semibold group-hover:text-accent transition-colors">
                    {group.label}
                  </h2>
                  <p className="text-[10px] text-text-muted">
                    {group.subs.length} sub-categories &middot;{" "}
                    {group.toolCount} tools &middot; {group.beliefs.length}{" "}
                    beliefs
                  </p>
                </div>
              </div>

              {group.beliefs.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {group.beliefs.slice(0, 4).map((b) => (
                    <div
                      key={b.id}
                      className="bg-bg-surface rounded px-2.5 py-1.5"
                    >
                      <p className="text-[11px] font-medium truncate">
                        {b.champion}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="flex-1 bg-bg rounded-full h-1">
                          <div
                            className={`h-1 rounded-full ${
                              b.confidence >= 0.8 ? "bg-green" : "bg-accent"
                            }`}
                            style={{ width: `${b.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-[9px] text-text-muted font-mono">
                          {Math.round(b.confidence * 100)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
