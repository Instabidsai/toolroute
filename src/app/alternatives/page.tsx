import { getTools } from "@/lib/api";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Metadata } from "next";

export const revalidate = 3600;

const ratingColor = (r: number) =>
  r >= 10 ? "text-green" : r >= 9 ? "text-accent" : "text-amber";

const prettifySubCategory = (sub: string) =>
  sub
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

export const metadata: Metadata = {
  title: "Tool Alternatives for AI Agents (2026) - ToolRoute",
  description:
    "Browse side-by-side alternatives to every popular AI agent tool. Tavily alternatives, Firecrawl alternatives, Stripe alternatives, and more — ranked, reviewed, accessible through one API.",
  alternates: {
    canonical: "/alternatives",
  },
  openGraph: {
    title: "Tool Alternatives for AI Agents (2026) - ToolRoute",
    description:
      "Side-by-side alternatives to every popular AI agent tool. Ranked, reviewed, accessible through one API.",
    url: "https://toolroute.ai/alternatives",
    siteName: "ToolRoute",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tool Alternatives for AI Agents (2026) - ToolRoute",
    description:
      "Side-by-side alternatives to every popular AI agent tool. Ranked, reviewed, accessible through one API.",
  },
};

export default async function AlternativesIndexPage() {
  const allTools = await getTools();
  const featured = allTools
    .filter((t) => t.rating >= 9)
    .sort((a, b) => {
      if (b.rating !== a.rating) return b.rating - a.rating;
      return a.name.localeCompare(b.name);
    });

  // Group by sub-category to show "N alternatives" counts
  const subCategoryCounts = new Map<string, number>();
  for (const t of allTools) {
    subCategoryCounts.set(
      t.sub_category,
      (subCategoryCounts.get(t.sub_category) ?? 0) + 1
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        href="/tools"
        className="inline-flex items-center gap-1.5 text-xs text-text-dim hover:text-accent mb-6 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Registry
      </Link>

      <header className="mb-10">
        <p className="text-xs text-text-muted uppercase tracking-wide mb-2">
          Alternative Guides &middot; 2026 Edition
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold mb-4">
          Tool Alternatives for AI Agents
        </h1>
        <p className="text-base text-text-dim leading-relaxed">
          Picking a tool is a bet. Picking two and A/B-ing them is a strategy.
          These guides show the real alternatives to the most popular tools in
          the ToolRoute registry — ranked by rating, grouped by what they
          actually do, and one click away from being live in your agent through
          a single API key.
        </p>
      </header>

      <section className="mb-10">
        <h2 className="text-sm font-semibold mb-4 text-text-muted uppercase tracking-wide">
          Alternative Guides ({featured.length})
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {featured.map((t) => {
            const altCount = (subCategoryCounts.get(t.sub_category) ?? 1) - 1;
            return (
              <Link
                key={t.id}
                href={`/alternatives/${t.slug}`}
                className="border border-border rounded-lg p-4 bg-bg-card hover:border-border-bright transition-all group"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm group-hover:text-accent transition-colors">
                    {t.name} Alternatives
                  </h3>
                  <span
                    className={`text-xs font-bold whitespace-nowrap ${ratingColor(t.rating)}`}
                  >
                    {t.rating}/10
                  </span>
                </div>
                <p className="text-xs text-text-muted mb-2">
                  {prettifySubCategory(t.sub_category)} &middot;{" "}
                  {altCount > 0
                    ? `${altCount} alternative${altCount === 1 ? "" : "s"}`
                    : "No direct alternatives"}
                </p>
                <p className="text-xs text-text-dim line-clamp-2">
                  {t.description}
                </p>
                <span className="inline-flex items-center gap-1 text-xs text-accent mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  Compare alternatives
                  <ArrowRight className="w-3 h-3" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="border border-accent/20 rounded-lg p-6 bg-accent/5">
        <h2 className="text-lg font-semibold mb-2">
          Don&apos;t Pick. Route.
        </h2>
        <p className="text-sm text-text-dim mb-4">
          Every tool and every alternative listed here is already wired into
          ToolRoute. Instead of picking a winner and hoping, add both, route
          traffic, and let real usage data tell you which one survives.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/docs"
            className="inline-flex items-center gap-1.5 bg-accent text-bg px-4 py-2 rounded text-sm font-semibold hover:bg-accent/90 transition-colors"
          >
            View API Docs
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            href="/tools"
            className="inline-flex items-center gap-1.5 border border-border px-4 py-2 rounded text-sm font-semibold hover:border-border-bright transition-colors"
          >
            Full Registry
          </Link>
          <Link
            href="/categories"
            className="inline-flex items-center gap-1.5 text-sm text-text-dim hover:text-text transition-colors"
          >
            Browse by category
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </section>
    </div>
  );
}
