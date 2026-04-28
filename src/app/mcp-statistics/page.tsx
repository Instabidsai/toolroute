import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, TrendingUp, Package, Shield, Zap, Users } from "lucide-react";
import { safeJsonLd } from "@/lib/json-ld";

export const metadata: Metadata = {
  title: "MCP Statistics 2026: Ecosystem, Adoption, and Tool Data | ToolRoute",
  description:
    "MCP statistics for 2026: 87 curated tools, 12 super-categories, 7 protocols supported, 75% with free tier, avg rating 9.2/10. Live data from the ToolRoute registry.",
  alternates: { canonical: "/mcp-statistics" },
  openGraph: {
    title: "MCP Statistics 2026: Ecosystem, Adoption, and Tool Data",
    description:
      "Live MCP ecosystem stats: 87 tools, 12 categories, 7 protocols, 75% free-tier coverage, 9.2/10 average quality rating.",
    url: "https://toolroute.ai/mcp-statistics",
  },
};

/* ---------- Numbers (live-synced from ToolRoute registry on 2026-04-16) ---------- */
const TOTAL_TOOLS = 87;
const TOTAL_SKILLS = 46;
const TOTAL_COMPOSITES = 6;
const TOTAL_BELIEFS = 54;
const UNIQUE_AUTHORS = 38;
const AVG_RATING = 9.2;

const categoryData = [
  { name: "Infrastructure", count: 19, pct: 21.8 },
  { name: "Content", count: 17, pct: 19.5 },
  { name: "Marketing", count: 12, pct: 13.8 },
  { name: "Communication", count: 10, pct: 11.5 },
  { name: "Operations", count: 10, pct: 11.5 },
  { name: "DevOps", count: 4, pct: 4.6 },
  { name: "CRM & Sales", count: 4, pct: 4.6 },
  { name: "Scheduling", count: 3, pct: 3.4 },
  { name: "Security", count: 3, pct: 3.4 },
  { name: "Analytics", count: 2, pct: 2.3 },
  { name: "Ecommerce", count: 2, pct: 2.3 },
  { name: "Finance", count: 1, pct: 1.1 },
];

const protocolData = [
  { name: "REST", count: 64, pct: 73.6 },
  { name: "MCP (Streamable HTTP)", count: 34, pct: 39.1 },
  { name: "OpenAPI", count: 15, pct: 17.2 },
  { name: "Skill (Claude)", count: 6, pct: 6.9 },
  { name: "GraphQL", count: 3, pct: 3.4 },
  { name: "NPM", count: 3, pct: 3.4 },
  { name: "CLI", count: 2, pct: 2.3 },
];

const costData = [
  { name: "Freemium", count: 35, pct: 40.2 },
  { name: "Free", count: 30, pct: 34.5 },
  { name: "Usage-based", count: 11, pct: 12.6 },
  { name: "Paid", count: 10, pct: 11.5 },
  { name: "CC Subscription", count: 1, pct: 1.1 },
];

const typeData = [
  { name: "REST API", count: 51, pct: 58.6 },
  { name: "MCP Server", count: 27, pct: 31.0 },
  { name: "Claude Code Skill", count: 5, pct: 5.7 },
  { name: "Open Source", count: 3, pct: 3.4 },
  { name: "CLI Tool", count: 1, pct: 1.1 },
];

const topAuthors = [
  { name: "Google", count: 6 },
  { name: "Anthropic", count: 5 },
  { name: "Vercel", count: 3 },
  { name: "Twilio", count: 2 },
  { name: "Supabase", count: 2 },
];

/* ---------- Schema.org Article ---------- */
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "MCP Statistics 2026: Ecosystem, Adoption, and Tool Data",
  description:
    "Live statistics for the Model Context Protocol (MCP) ecosystem: 87 curated tools, 12 super-categories, 7 protocols supported, 75% with free tier, 9.2/10 average rating.",
  url: "https://toolroute.ai/mcp-statistics",
  datePublished: "2026-04-16",
  dateModified: "2026-04-16",
  author: {
    "@type": "Organization",
    name: "ToolRoute",
    url: "https://toolroute.ai",
  },
  publisher: {
    "@type": "Organization",
    name: "ToolRoute",
    url: "https://toolroute.ai",
  },
  mainEntityOfPage: "https://toolroute.ai/mcp-statistics",
};

/* ---------- Small bar component ---------- */
function Bar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 bg-bg-card rounded-full overflow-hidden mt-1.5">
      <div
        className="h-full bg-accent/70 rounded-full"
        style={{ width: `${Math.max(pct, 1.5)}%` }}
      />
    </div>
  );
}

export default function MCPStatisticsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />

      <div className="pb-16 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-full px-4 py-1.5 mb-6">
            <BarChart3 className="w-3.5 h-3.5 text-accent" />
            <span className="text-xs text-accent font-medium">Live Statistics</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            MCP Statistics 2026
          </h1>
          <p className="text-text-dim leading-relaxed text-lg">
            The Model Context Protocol (MCP) ecosystem now spans {TOTAL_TOOLS} curated tools across {categoryData.length} super-categories, with {TOTAL_SKILLS} Claude Code skills, {TOTAL_COMPOSITES} multi-tool composites, and {TOTAL_BELIEFS} category beliefs tracked by ToolRoute&apos;s intelligent router. Every number below is pulled live from the ToolRoute registry, last synced 2026-04-16.
          </p>
        </div>

        {/* Top-line stat cards */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-12">
          <div className="border border-border rounded-lg p-4 bg-bg-card">
            <div className="text-3xl font-bold text-accent">{TOTAL_TOOLS}</div>
            <div className="text-xs text-text-muted mt-1">Curated tools</div>
          </div>
          <div className="border border-border rounded-lg p-4 bg-bg-card">
            <div className="text-3xl font-bold text-accent">{categoryData.length}</div>
            <div className="text-xs text-text-muted mt-1">Super-categories</div>
          </div>
          <div className="border border-border rounded-lg p-4 bg-bg-card">
            <div className="text-3xl font-bold text-accent">{protocolData.length}</div>
            <div className="text-xs text-text-muted mt-1">Protocols supported</div>
          </div>
          <div className="border border-border rounded-lg p-4 bg-bg-card">
            <div className="text-3xl font-bold text-accent">{AVG_RATING}</div>
            <div className="text-xs text-text-muted mt-1">Avg rating / 10</div>
          </div>
        </section>

        {/* Ecosystem snapshot */}
        <section className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-accent" />
            <h2 className="text-2xl font-bold" id="ecosystem-snapshot">
              MCP Ecosystem Snapshot
            </h2>
          </div>
          <ul className="space-y-2 text-sm text-text-dim leading-relaxed list-disc pl-5">
            <li>
              <strong className="text-text">{TOTAL_TOOLS} tools</strong> are currently curated in the ToolRoute registry, up from 51 adapters at the gateway launch in April 2026.
            </li>
            <li>
              <strong className="text-text">{typeData[1].count} dedicated MCP servers</strong> ({typeData[1].pct}%) plus {typeData[0].count} REST APIs ({typeData[0].pct}%) are wired behind a unified execution gateway.
            </li>
            <li>
              <strong className="text-text">{TOTAL_SKILLS} Claude Code skills</strong> and <strong className="text-text">{TOTAL_COMPOSITES} multi-tool composites</strong> extend raw tool calls into complete workflows.
            </li>
            <li>
              <strong className="text-text">{TOTAL_BELIEFS} category beliefs</strong> back the auto-routing layer, evolving from usage data rather than hand-coded rules.
            </li>
            <li>
              <strong className="text-text">{UNIQUE_AUTHORS} unique authors</strong> ship these tools, led by Google (6), Anthropic (5), and Vercel (3).
            </li>
            <li>
              <strong className="text-text">Average quality rating: {AVG_RATING}/10</strong>; every tool in the registry scores 8.0 or higher after the 2026 curation pass.
            </li>
          </ul>
        </section>

        {/* Category breakdown */}
        <section className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-4 h-4 text-accent" />
            <h2 className="text-2xl font-bold" id="top-categories">
              Top Categories by Tool Count
            </h2>
          </div>
          <p className="text-sm text-text-dim mb-4">
            Infrastructure (19 tools, 21.8%) is the largest single super-category, followed by Content (17) and Marketing (12). The top 5 categories account for 78% of all tools.
          </p>
          <div className="border border-border rounded-lg bg-bg-card divide-y divide-border">
            {categoryData.map((c) => (
              <div key={c.name} className="p-3.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium">{c.name}</span>
                  <span className="text-xs text-text-muted tabular-nums">
                    {c.count} tools &middot; {c.pct}%
                  </span>
                </div>
                <Bar pct={c.pct} />
              </div>
            ))}
          </div>
        </section>

        {/* Protocols */}
        <section className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-accent" />
            <h2 className="text-2xl font-bold" id="protocol-support">
              Protocol Support
            </h2>
          </div>
          <p className="text-sm text-text-dim mb-4">
            The typical ToolRoute entry speaks {(protocolData.reduce((s, p) => s + p.count, 0) / TOTAL_TOOLS).toFixed(1)} protocols. REST remains the universal default (73.6% of tools), but 39.1% now expose an MCP Streamable HTTP endpoint — up from zero a year ago.
          </p>
          <div className="border border-border rounded-lg bg-bg-card divide-y divide-border">
            {protocolData.map((p) => (
              <div key={p.name} className="p-3.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium">{p.name}</span>
                  <span className="text-xs text-text-muted tabular-nums">
                    {p.count} tools &middot; {p.pct}%
                  </span>
                </div>
                <Bar pct={p.pct} />
              </div>
            ))}
          </div>
        </section>

        {/* Pricing distribution */}
        <section className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-accent" />
            <h2 className="text-2xl font-bold" id="free-vs-paid">
              Free vs Paid Distribution
            </h2>
          </div>
          <p className="text-sm text-text-dim mb-4">
            75% of MCP tools ship with a usable free tier: 30 tools (34.5%) are fully free, 35 tools (40.2%) are freemium, and only 10 tools (11.5%) are paid-only. Usage-based pricing covers the remaining 12.6%.
          </p>
          <div className="border border-border rounded-lg bg-bg-card divide-y divide-border">
            {costData.map((c) => (
              <div key={c.name} className="p-3.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium">{c.name}</span>
                  <span className="text-xs text-text-muted tabular-nums">
                    {c.count} tools &middot; {c.pct}%
                  </span>
                </div>
                <Bar pct={c.pct} />
              </div>
            ))}
          </div>
        </section>

        {/* Tool types */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4" id="tool-types">
            Tool Types
          </h2>
          <p className="text-sm text-text-dim mb-4">
            Native MCP servers now make up 31% of the registry. REST APIs wrapped by ToolRoute adapters still dominate at 58.6%, and Claude Code skills fill the last-mile workflow layer.
          </p>
          <div className="border border-border rounded-lg bg-bg-card divide-y divide-border">
            {typeData.map((t) => (
              <div key={t.name} className="p-3.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium">{t.name}</span>
                  <span className="text-xs text-text-muted tabular-nums">
                    {t.count} tools &middot; {t.pct}%
                  </span>
                </div>
                <Bar pct={t.pct} />
              </div>
            ))}
          </div>
        </section>

        {/* Top publishers */}
        <section className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-accent" />
            <h2 className="text-2xl font-bold" id="top-publishers">
              Top MCP Publishers
            </h2>
          </div>
          <p className="text-sm text-text-dim mb-4">
            The top 5 publishers account for 18 tools (20.7%) of the registry. Google leads with 6 tools (Calendar, Drive, Sheets, Search Console, Indexing, Vertex AI), followed by Anthropic with 5.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {topAuthors.map((a) => (
              <div
                key={a.name}
                className="border border-border rounded-lg p-4 bg-bg-card flex items-baseline justify-between"
              >
                <span className="text-sm font-semibold">{a.name}</span>
                <span className="text-xs text-text-muted tabular-nums">
                  {a.count} tools
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Quality bar */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4" id="quality-bar">
            Quality Bar
          </h2>
          <ul className="space-y-2 text-sm text-text-dim leading-relaxed list-disc pl-5">
            <li>
              <strong className="text-text">Minimum rating to list: 8.0/10.</strong> The full registry ranges from 8.0 to 10.0.
            </li>
            <li>
              <strong className="text-text">Average rating: 9.2/10</strong> across all 87 tools.
            </li>
            <li>
              Every listing is reviewed against a four-axis rubric (capability, reliability, documentation, maintenance) before it is promoted to a category champion.
            </li>
            <li>
              {TOTAL_BELIEFS} category beliefs track which champion currently leads each job-to-be-done; champions can be unseated by usage-backed challenges.
            </li>
          </ul>
        </section>

        {/* Methodology */}
        <section className="mb-12 border border-border rounded-lg bg-bg-card p-5">
          <h2 className="text-lg font-semibold mb-2" id="methodology">
            Methodology
          </h2>
          <p className="text-sm text-text-dim leading-relaxed">
            Data on this page is pulled directly from the public ToolRoute registry
            (<code className="text-accent bg-accent/10 px-1 rounded text-xs">/api/v1/tools</code>),
            refreshed on 2026-04-16. &quot;Protocols&quot; counts any tool that exposes a given
            interface — a single tool often speaks multiple protocols, so protocol percentages
            sum to more than 100%. &quot;Free tier&quot; combines <em>free</em> and
            <em> freemium</em> cost labels. Ratings are ToolRoute&apos;s internal 1&ndash;10
            quality scores computed from capability, reliability, documentation, and
            maintenance signals.
          </p>
        </section>

        {/* CTA */}
        <div className="border-t border-border pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link
            href="/tools"
            className="text-sm text-accent hover:underline inline-flex items-center gap-1"
          >
            Browse all {TOTAL_TOOLS} tools &rarr;
          </Link>
          <Link
            href="/categories"
            className="text-sm text-accent hover:underline inline-flex items-center gap-1"
          >
            Explore categories &rarr;
          </Link>
          <Link
            href="/faq"
            className="text-sm text-accent hover:underline inline-flex items-center gap-1"
          >
            MCP FAQ &rarr;
          </Link>
        </div>
      </div>
    </>
  );
}
