import { getTools, getToolBySlug } from "@/lib/api";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import type { Metadata } from "next";

export const revalidate = 3600;

const costLabel: Record<string, string> = {
  free: "Free",
  freemium: "Freemium",
  paid: "Paid",
  "usage-based": "Usage-based",
  enterprise: "Enterprise",
};

const ratingColor = (r: number) =>
  r >= 10 ? "text-green" : r >= 9 ? "text-accent" : "text-amber";

const prettifySubCategory = (sub: string) =>
  sub
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

export async function generateStaticParams() {
  try {
    const tools = await getTools();
    return tools
      .filter((t) => t.rating >= 9)
      .map((t) => ({ tool: t.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tool: string }>;
}): Promise<Metadata> {
  const { tool } = await params;
  const t = await getToolBySlug(tool);
  if (!t) return {};

  const subLabel = prettifySubCategory(t.sub_category);
  const title = `${t.name} Alternatives for AI Agents (2026) - ToolRoute`;
  const description = `The best ${t.name} alternatives for AI agents, ranked. See which tools in ${subLabel} compete and when to pick each.`;

  return {
    title,
    description,
    alternates: {
      canonical: `/alternatives/${tool}`,
    },
    openGraph: {
      title,
      description,
      url: `https://toolroute.ai/alternatives/${tool}`,
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

export default async function AlternativesPage({
  params,
}: {
  params: Promise<{ tool: string }>;
}) {
  const { tool } = await params;
  const target = await getToolBySlug(tool);
  if (!target) notFound();

  const allTools = await getTools();
  const alternatives = allTools
    .filter(
      (t) => t.sub_category === target.sub_category && t.slug !== target.slug
    )
    .sort((a, b) => b.rating - a.rating);

  const subLabel = prettifySubCategory(target.sub_category);
  const h1 = `${target.name} Alternatives for AI Agents`;

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: h1,
    description: `The best ${target.name} alternatives for AI agents, ranked. See which tools in ${subLabel} compete and when to pick each.`,
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
      "@id": `https://toolroute.ai/alternatives/${tool}`,
    },
  };

  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: h1,
    numberOfItems: alternatives.length,
    itemListElement: alternatives.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "SoftwareApplication",
        name: t.name,
        description: t.description,
        url: `https://toolroute.ai/tools/${t.slug}`,
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Web",
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: t.rating,
          bestRating: 10,
          ratingCount: 1,
        },
      },
    })),
  };

  const top = alternatives[0];
  const second = alternatives[1];
  const third = alternatives[2];

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
        href="/alternatives"
        className="inline-flex items-center gap-1.5 text-xs text-text-dim hover:text-accent mb-6 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        All Alternative Guides
      </Link>

      <article>
        <header className="mb-10">
          <p className="text-xs text-text-muted uppercase tracking-wide mb-2">
            Alternatives &middot; {subLabel} &middot; 2026 Edition
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">{h1}</h1>
          <p className="text-base text-text-dim leading-relaxed">
            Looking for alternatives to{" "}
            <Link
              href={`/tools/${target.slug}`}
              className="text-accent hover:underline"
            >
              {target.name}
            </Link>
            ? Here are the {alternatives.length > 0 ? alternatives.length : "top"}{" "}
            {subLabel.toLowerCase()} tools that compete, ranked by how well they
            serve AI agents in production. Every tool on this list is accessible
            through one ToolRoute API key.
          </p>
        </header>

        <section className="mb-10">
          <h2 className="text-sm font-semibold mb-4 text-text-muted uppercase tracking-wide">
            About {target.name}
          </h2>
          <div className="border border-border rounded-lg p-5 bg-bg-card">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <Link
                  href={`/tools/${target.slug}`}
                  className="font-semibold text-lg hover:text-accent transition-colors"
                >
                  {target.name}
                </Link>
                <p className="text-xs text-text-muted mt-0.5">
                  {subLabel} &middot;{" "}
                  <Link
                    href={`/categories/${target.super_category}`}
                    className="hover:text-accent transition-colors capitalize"
                  >
                    {target.super_category.replace(/_/g, " ")}
                  </Link>{" "}
                  &middot; {costLabel[target.cost] ?? target.cost}
                </p>
              </div>
              <span
                className={`text-sm font-bold whitespace-nowrap ${ratingColor(target.rating)}`}
              >
                {target.rating}/10
              </span>
            </div>
            <p className="text-sm text-text-dim leading-relaxed">
              {target.description}
            </p>
            {target.website_url && (
              <a
                href={target.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-text-dim hover:text-accent transition-colors mt-3"
              >
                Visit {target.name}
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </section>

        {alternatives.length > 0 ? (
          <section className="mb-10">
            <h2 className="text-xl font-semibold mb-4">
              Top {target.name} Alternatives ({alternatives.length})
            </h2>
            <div className="border border-border rounded-lg overflow-hidden bg-bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-bg-surface border-b border-border">
                    <tr className="text-left text-xs text-text-muted uppercase tracking-wide">
                      <th className="px-4 py-3 w-10">#</th>
                      <th className="px-4 py-3">Alternative</th>
                      <th className="px-4 py-3 hidden md:table-cell">
                        Description
                      </th>
                      <th className="px-4 py-3">Rating</th>
                      <th className="px-4 py-3 hidden lg:table-cell">Cost</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {alternatives.map((t, i) => (
                      <tr
                        key={t.id}
                        className="border-b border-border last:border-b-0 hover:bg-bg-card-hover transition-colors"
                      >
                        <td className="px-4 py-3 text-xs text-text-muted font-mono">
                          {i + 1}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/tools/${t.slug}`}
                            className="font-semibold hover:text-accent transition-colors"
                          >
                            {t.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-xs text-text-dim max-w-md hidden md:table-cell">
                          <span className="line-clamp-2">{t.description}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs font-bold ${ratingColor(t.rating)}`}
                          >
                            {t.rating}/10
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-text-dim hidden lg:table-cell">
                          {costLabel[t.cost] ?? t.cost}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/tools/${t.slug}`}
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
            <p className="text-xs text-text-muted mt-3">
              See all{" "}
              <Link
                href={`/categories/${target.super_category}/best`}
                className="text-accent hover:underline"
              >
                best {target.super_category.replace(/_/g, " ")} tools
              </Link>{" "}
              for a broader comparison.
            </p>
          </section>
        ) : (
          <section className="mb-10 border border-border rounded-lg p-8 bg-bg-card text-center">
            <p className="text-sm text-text-dim">
              No direct alternatives to {target.name} in the {subLabel}{" "}
              sub-category yet. Check the{" "}
              <Link
                href={`/categories/${target.super_category}/best`}
                className="text-accent hover:underline"
              >
                broader {target.super_category.replace(/_/g, " ")} category
              </Link>{" "}
              for adjacent tools.
            </p>
          </section>
        )}

        {alternatives.length > 0 && (
          <section className="mb-10 border border-border rounded-lg p-6 bg-bg-card">
            <h2 className="text-lg font-semibold mb-4">
              When to Use Which {subLabel} Tool
            </h2>
            <ul className="text-sm text-text-dim space-y-3">
              <li>
                <span className="text-text font-semibold">
                  Pick {target.name}
                </span>{" "}
                when {target.description.split(".")[0].toLowerCase()}. Best for
                teams already invested in its ecosystem.
              </li>
              {top && (
                <li>
                  <span className="text-text font-semibold">
                    Pick{" "}
                    <Link
                      href={`/tools/${top.slug}`}
                      className="text-accent hover:underline"
                    >
                      {top.name}
                    </Link>
                  </span>{" "}
                  when you want the highest-rated alternative ({top.rating}/10).{" "}
                  {top.description.split(".")[0]}.
                </li>
              )}
              {second && (
                <li>
                  <span className="text-text font-semibold">
                    Pick{" "}
                    <Link
                      href={`/tools/${second.slug}`}
                      className="text-accent hover:underline"
                    >
                      {second.name}
                    </Link>
                  </span>{" "}
                  when{" "}
                  {second.cost === "free" || second.cost === "freemium"
                    ? "you need a free tier to start"
                    : "you're willing to pay for premium features"}
                  . {second.description.split(".")[0]}.
                </li>
              )}
              {third && (
                <li>
                  <span className="text-text font-semibold">
                    Pick{" "}
                    <Link
                      href={`/tools/${third.slug}`}
                      className="text-accent hover:underline"
                    >
                      {third.name}
                    </Link>
                  </span>{" "}
                  for a third option that still lands in the top tier.{" "}
                  {third.description.split(".")[0]}.
                </li>
              )}
              <li>
                <span className="text-text font-semibold">Can't decide?</span>{" "}
                Route both through ToolRoute and let usage data settle it —
                every call is logged with latency, error rate, and cost so you
                can A/B the alternatives without rewriting adapter code.
              </li>
            </ul>
          </section>
        )}

        <section className="border border-accent/20 rounded-lg p-6 bg-accent/5">
          <h2 className="text-lg font-semibold mb-2">
            Access {target.name} and All Alternatives Through One API
          </h2>
          <p className="text-sm text-text-dim mb-4">
            Stop picking winners at integration time. ToolRoute wraps{" "}
            {target.name}
            {alternatives.length > 0
              ? ` plus ${alternatives.length} alternative${alternatives.length === 1 ? "" : "s"}`
              : ""}{" "}
            behind one unified endpoint — swap providers with a string change,
            pay per call, and compare them with real usage data instead of
            marketing pages.
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
            <Link
              href={`/categories/${target.super_category}/best`}
              className="inline-flex items-center gap-1.5 text-sm text-text-dim hover:text-text transition-colors"
            >
              Best in category
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </section>
      </article>
    </div>
  );
}
