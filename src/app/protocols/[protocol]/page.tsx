import { getTools } from "@/lib/api";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { safeJsonLd } from "@/lib/json-ld";

export const revalidate = 3600;

export const PROTOCOLS = [
  {
    key: "mcp",
    label: "MCP",
    name: "MCP Servers",
    h1: "MCP Servers for AI Agents (2026)",
    intro:
      "Model Context Protocol (MCP) servers expose tools to AI agents through a standardized JSON-RPC interface. ToolRoute aggregates every battle-tested MCP server below into one Streamable HTTP endpoint — drop a single URL into Claude Desktop, Cursor, or any MCP client.",
  },
  {
    key: "rest",
    label: "REST",
    name: "REST API Tools",
    h1: "Best REST API Tools for AI Agents (2026)",
    intro:
      "REST APIs remain the most interoperable way to call external services from an agent runtime. These tools ship clean, well-documented REST endpoints that ToolRoute wraps with auth, rate-limiting, and unified billing so your agent never has to manage a single API key.",
  },
  {
    key: "a2a",
    label: "A2A",
    name: "A2A Protocol Tools",
    h1: "A2A Protocol Tools for AI Agents (2026)",
    intro:
      "Agent-to-Agent (A2A) is Google's open protocol for agent interoperability. Tools on this list expose A2A-compatible endpoints so swarms of specialized agents can discover, delegate, and compose without custom glue.",
  },
  {
    key: "graphql",
    label: "GraphQL",
    name: "GraphQL API Tools",
    h1: "GraphQL API Tools for AI Agents (2026)",
    intro:
      "GraphQL lets agents fetch exactly the data they need in a single round-trip. These tools expose typed GraphQL schemas — ToolRoute proxies them with introspection caching so agents get schema-aware completions without hammering origin servers.",
  },
  {
    key: "openapi",
    label: "OpenAPI",
    name: "OpenAPI Tools",
    h1: "OpenAPI Tools for AI Agents (2026)",
    intro:
      "Tools with published OpenAPI specs are the easiest for agents to consume — the spec becomes the tool definition. ToolRoute auto-generates OpenAI function schemas and MCP tool descriptors from every OpenAPI doc below.",
  },
  {
    key: "skill",
    label: "Skill",
    name: "Claude Code Skills",
    h1: "Best Claude Code Skills for AI Agents (2026)",
    intro:
      "Claude Code Skills are reusable instruction bundles that teach agents how to perform specific jobs. These skills ship with production-tested prompts, file templates, and verification steps — invoke them as slash commands inside any Claude Code session.",
  },
  {
    key: "cli",
    label: "CLI",
    name: "CLI Tools",
    h1: "CLI Tools for AI Agents (2026)",
    intro:
      "Command-line tools agents invoke via subprocess calls. ToolRoute hosts sandboxed CLI execution for every tool below — no need to install, version-pin, or containerize.",
  },
  {
    key: "npm",
    label: "NPM",
    name: "NPM Packages for AI Agents",
    h1: "NPM Packages for AI Agents (2026)",
    intro:
      "TypeScript-first packages agents import directly. Each package on this list has been vetted for agent-safe defaults (timeouts, retries, structured errors) and is available through ToolRoute's SDK adapter layer.",
  },
] as const;

export async function generateStaticParams() {
  return PROTOCOLS.map((p) => ({ protocol: p.key }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ protocol: string }>;
}): Promise<Metadata> {
  const { protocol } = await params;
  const p = PROTOCOLS.find((x) => x.key === protocol);
  if (!p) return {};

  const title = `${p.name} for AI Agents (2026) - ToolRoute`;
  const description = `The best ${p.name.toLowerCase()} for AI agents in 2026. Every ${p.label} tool accessible through one unified ToolRoute API key.`;

  return {
    title,
    description,
    alternates: {
      canonical: `/protocols/${protocol}`,
    },
    openGraph: {
      title,
      description,
      url: `https://toolroute.ai/protocols/${protocol}`,
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

export default async function ProtocolPage({
  params,
}: {
  params: Promise<{ protocol: string }>;
}) {
  const { protocol } = await params;
  const p = PROTOCOLS.find((x) => x.key === protocol);
  if (!p) notFound();

  const allTools = await getTools();
  const rankedTools = allTools
    .filter((t) => t.protocols?.includes(protocol))
    .sort((a, b) => b.rating - a.rating);
  const topTools = rankedTools.slice(0, 3);

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: p.h1,
    description: p.intro.slice(0, 200),
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
      "@id": `https://toolroute.ai/protocols/${protocol}`,
    },
  };

  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: p.h1,
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
        dangerouslySetInnerHTML={{ __html: safeJsonLd(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(itemListSchema) }}
      />

      <Link
        href="/tools"
        className="inline-flex items-center gap-1.5 text-xs text-text-dim hover:text-accent mb-6 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Registry
      </Link>

      <article>
        <header className="mb-10">
          <p className="text-xs text-text-muted uppercase tracking-wide mb-2">
            Protocol &middot; {p.label} &middot; 2026 Edition
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">{p.h1}</h1>
          <p className="text-base text-text-dim leading-relaxed">{p.intro}</p>
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

        {rankedTools.length > 0 ? (
          <section className="mb-10">
            <h2 className="text-xl font-semibold mb-4">
              All {p.label} Tools ({rankedTools.length})
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
                        Category
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
                        <td className="px-4 py-3 text-xs hidden sm:table-cell">
                          <Link
                            href={`/categories/${tool.super_category}`}
                            className="text-text-dim hover:text-accent transition-colors capitalize"
                          >
                            {tool.super_category.replace(/_/g, " ")}
                          </Link>
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
        ) : (
          <section className="mb-10 border border-border rounded-lg p-8 bg-bg-card text-center">
            <p className="text-sm text-text-dim">
              No {p.label} tools in the registry yet. Check back soon — we
              index 2-5 new tools per week.
            </p>
          </section>
        )}

        <section className="mb-10 border border-border rounded-lg p-6 bg-bg-card">
          <h2 className="text-lg font-semibold mb-3">
            Why {p.label} for AI Agents?
          </h2>
          <ul className="text-sm text-text-dim space-y-2">
            <li>
              <span className="text-text">One key, every {p.label} tool.</span>{" "}
              ToolRoute normalizes auth across every adapter — your agent
              doesn't need to care which tool it's calling.
            </li>
            <li>
              <span className="text-text">Usage-based billing.</span> Pay only
              for the calls your agent makes. No per-vendor seats, no minimum
              commits.
            </li>
            <li>
              <span className="text-text">Failure tracking.</span> Every {p.label}{" "}
              call is logged with latency, error codes, and retry counts —
              accessible via the dashboard or API.
            </li>
            <li>
              <span className="text-text">Automatic protocol translation.</span>{" "}
              Tools on this list can be called via REST, MCP, or OpenAI
              function format — ToolRoute handles the shape-shift.
            </li>
          </ul>
        </section>

        <section className="border border-accent/20 rounded-lg p-6 bg-accent/5">
          <h2 className="text-lg font-semibold mb-2">
            Access Every {p.label} Tool Through One API
          </h2>
          <p className="text-sm text-text-dim mb-4">
            Stop writing one-off adapters for every new tool. ToolRoute ships
            {rankedTools.length > 0 ? ` ${rankedTools.length} ` : " every "}
            {p.label} tool behind a single endpoint — unified billing, unified
            errors, unified observability.
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
