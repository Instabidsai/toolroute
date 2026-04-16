import { getToolsByCategory } from "@/lib/api";
import { SUPER_CATEGORIES } from "@/lib/types";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import type { Metadata } from "next";

export const revalidate = 3600;

export async function generateStaticParams() {
  return SUPER_CATEGORIES.map((sc) => ({ super: sc.key }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ super: string }>;
}): Promise<Metadata> {
  const { super: superCat } = await params;
  const sc = SUPER_CATEGORIES.find((c) => c.key === superCat);
  if (!sc) return {};

  const title = `Best ${sc.label} Tools for AI Agents (2026) - ToolRoute`;
  const description = `The best ${sc.label.toLowerCase()} tools for AI agents in 2026. Ranked by real usage data, curated from 51+ adapters. Access every tool through one unified API.`;

  return {
    title,
    description,
    alternates: {
      canonical: `/categories/${superCat}/best`,
    },
    openGraph: {
      title,
      description,
      url: `https://toolroute.ai/categories/${superCat}/best`,
      siteName: "ToolRoute",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

const costLabel: Record<string, string> = {
  free: "Free",
  freemium: "Freemium",
  paid: "Paid",
  "usage-based": "Usage-based",
  enterprise: "Enterprise",
};

const ratingColor = (r: number) =>
  r >= 10 ? "text-green" : r >= 9 ? "text-accent" : "text-amber";

export default async function BestCategoryPage({
  params,
}: {
  params: Promise<{ super: string }>;
}) {
  const { super: superCat } = await params;
  const sc = SUPER_CATEGORIES.find((c) => c.key === superCat);
  if (!sc) notFound();

  const tools = await getToolsByCategory(superCat);
  const rankedTools = [...tools].sort((a, b) => b.rating - a.rating);
  const topTools = rankedTools.slice(0, 3);

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `Best ${sc.label} Tools for AI Agents (2026)`,
    description: `The best ${sc.label.toLowerCase()} tools for AI agents in 2026, ranked by real usage data.`,
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
    datePublished: "2026-04-15",
    dateModified: new Date().toISOString().slice(0, 10),
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://toolroute.ai/categories/${superCat}/best`,
    },
  };

  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Best ${sc.label} Tools for AI Agents 2026`,
    numberOfItems: rankedTools.length,
    itemListElement: rankedTools.map((tool, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "SoftwareApplication",
        name: tool.name,
        description: tool.description,
        url: `https://toolroute.ai/tools/${tool.slug}`,
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Web",
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: tool.rating,
          bestRating: 10,
          ratingCount: 1,
        },
      },
    })),
  };

  return (
    <div className="max-w-4xl mx-auto">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />

      <Link
        href={`/categories/${superCat}`}
        className="inline-flex items-center gap-1.5 text-xs text-text-dim hover:text-accent mb-6 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to {sc.label}
      </Link>

      <article>
        <header className="mb-10">
          <p className="text-xs text-text-muted uppercase tracking-wide mb-2">
            {sc.label} &middot; 2026 Edition
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">
            Best {sc.label} Tools for AI Agents (2026)
          </h1>
          <p className="text-base text-text-dim leading-relaxed">
            {rankedTools.length === 0
              ? `ToolRoute is actively curating the best ${sc.label.toLowerCase()} tools for AI agents. Check back soon.`
              : `We rank ${rankedTools.length} ${sc.label.toLowerCase()} tools by real usage, cost, protocol support, and reliability. Every tool on this list is accessible through a single ToolRoute API key — no separate signups, no OAuth dance, no key rotation per vendor.`}
          </p>
        </header>

        {topTools.length > 0 && (
          <section className="mb-10">
            <h2 className="text-sm font-semibold mb-4 text-text-muted uppercase tracking-wide">
              Top {Math.min(3, topTools.length)} at a Glance
            </h2>
            <div className="grid sm:grid-cols-3 gap-3">
              {topTools.map((tool, i) => (
                <Link
                  key={tool.id}
                  href={`/tools/${tool.slug}`}
                  className="border border-border rounded-lg p-4 bg-bg-card hover:border-border-bright transition-all group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-text-muted font-mono">
                      #{i + 1}
                    </span>
                    <span
                      className={`text-sm font-bold ${ratingColor(tool.rating)}`}
                    >
                      {tool.rating}/10
                    </span>
                  </div>
                  <h3 className="font-semibold text-sm mb-1 group-hover:text-accent transition-colors">
                    {tool.name}
                  </h3>
                  <p className="text-xs text-text-dim line-clamp-2">
                    {tool.description}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {rankedTools.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-semibold mb-4">
              Full Ranking ({rankedTools.length} tools)
            </h2>
            <div className="border border-border rounded-lg overflow-hidden bg-bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-bg-surface border-b border-border">
                    <tr className="text-left text-xs text-text-muted uppercase tracking-wide">
                      <th className="px-4 py-3 w-10">#</th>
                      <th className="px-4 py-3">Tool</th>
                      <th className="px-4 py-3 hidden md:table-cell">
                        Description
                      </th>
                      <th className="px-4 py-3">Rating</th>
                      <th className="px-4 py-3 hidden sm:table-cell">
                        Protocols
                      </th>
                      <th className="px-4 py-3 hidden lg:table-cell">Cost</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankedTools.map((tool, i) => (
                      <tr
                        key={tool.id}
                        className="border-b border-border last:border-b-0 hover:bg-bg-card-hover transition-colors"
                      >
                        <td className="px-4 py-3 text-xs text-text-muted font-mono">
                          {i + 1}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/tools/${tool.slug}`}
                            className="font-semibold hover:text-accent transition-colors"
                          >
                            {tool.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-xs text-text-dim max-w-md hidden md:table-cell">
                          <span className="line-clamp-2">
                            {tool.description}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs font-bold ${ratingColor(tool.rating)}`}
                          >
                            {tool.rating}/10
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <div className="flex gap-1 flex-wrap">
                            {tool.protocols?.slice(0, 3).map((p) => (
                              <span key={p} className="protocol-badge">
                                {p}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-text-dim hidden lg:table-cell">
                          {costLabel[tool.cost] ?? tool.cost}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/tools/${tool.slug}`}
                            className="text-xs text-accent hover:underline inline-flex items-center gap-1"
                          >
                            View
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        <section className="mb-10 border border-border rounded-lg p-6 bg-bg-card">
          <h2 className="text-lg font-semibold mb-3">
            How We Rank {sc.label} Tools
          </h2>
          <ul className="text-sm text-text-dim space-y-2">
            <li>
              <span className="text-text">Real usage data.</span> Ratings
              reflect what agents actually execute through ToolRoute, not
              marketing.
            </li>
            <li>
              <span className="text-text">Protocol coverage.</span> Tools that
              expose MCP, REST, and OpenAPI score higher — more agent
              frameworks can call them without glue code.
            </li>
            <li>
              <span className="text-text">Cost predictability.</span> Free and
              usage-based tools are preferred for agent workloads where call
              volume is unknown.
            </li>
            <li>
              <span className="text-text">Reliability under load.</span> Tools
              that fail silently or rate-limit aggressively get downgraded
              after 10+ production incidents.
            </li>
          </ul>
        </section>

        <section className="border border-accent/20 rounded-lg p-6 bg-accent/5">
          <h2 className="text-lg font-semibold mb-2">
            Access All {rankedTools.length > 0 ? rankedTools.length : ""}{" "}
            {sc.label} Tools Through One API
          </h2>
          <p className="text-sm text-text-dim mb-4">
            Stop juggling API keys. ToolRoute proxies every tool on this page
            through a single endpoint, with unified billing, usage tracking,
            and automatic failover. One key, one invoice, zero vendor lock-in.
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
              href="/pricing"
              className="inline-flex items-center gap-1.5 border border-border px-4 py-2 rounded text-sm font-semibold hover:border-border-bright transition-colors"
            >
              See Pricing
            </Link>
            <a
              href="https://github.com/Instabidsai/toolroute"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-text-dim hover:text-text transition-colors"
            >
              GitHub
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </section>
      </article>
    </div>
  );
}
