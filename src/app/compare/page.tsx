import type { Metadata } from "next";
import Link from "next/link";
import { Zap, ArrowRight, Check, X, Minus } from "lucide-react";

export const metadata: Metadata = {
  title: "ToolRoute vs Alternatives — MCP Gateway Comparison",
  description:
    "MCP gateway comparison: ToolRoute vs self-hosted MCP, Kong MCP Registry, Official MCP Registry, and Glama. See which platform actually executes tools — not just lists them.",
  alternates: {
    canonical: "/compare",
  },
  openGraph: {
    title: "ToolRoute vs Alternatives — MCP Gateway Comparison",
    description:
      "MCP gateway comparison: ToolRoute vs self-hosted MCP, Kong MCP Registry, Official MCP Registry, and Glama.",
    url: "https://toolroute.ai/compare",
  },
};

type CellValue = "yes" | "no" | "partial" | string;

interface ComparisonRow {
  feature: string;
  toolroute: CellValue;
  selfHosted: CellValue;
  kong: CellValue;
  official: CellValue;
  glama: CellValue;
}

const rows: ComparisonRow[] = [
  {
    feature: "Tool execution",
    toolroute: "yes",
    selfHosted: "yes",
    kong: "no",
    official: "no",
    glama: "partial",
  },
  {
    feature: "Unified billing",
    toolroute: "yes",
    selfHosted: "no",
    kong: "no",
    official: "no",
    glama: "no",
  },
  {
    feature: "BYOK support",
    toolroute: "yes",
    selfHosted: "yes",
    kong: "no",
    official: "no",
    glama: "no",
  },
  {
    feature: "Multi-protocol (REST / MCP / A2A / OpenAI)",
    toolroute: "5 protocols",
    selfHosted: "1 protocol",
    kong: "no",
    official: "no",
    glama: "MCP only",
  },
  {
    feature: "Number of tools",
    toolroute: "70+",
    selfHosted: "Varies",
    kong: "Registry only",
    official: "Registry only",
    glama: "40+",
  },
  {
    feature: "Authentication management",
    toolroute: "yes",
    selfHosted: "Manual",
    kong: "no",
    official: "no",
    glama: "partial",
  },
  {
    feature: "Usage tracking",
    toolroute: "yes",
    selfHosted: "no",
    kong: "no",
    official: "no",
    glama: "partial",
  },
  {
    feature: "Auto-routing",
    toolroute: "yes",
    selfHosted: "no",
    kong: "no",
    official: "no",
    glama: "no",
  },
  {
    feature: "Prepaid credits",
    toolroute: "yes",
    selfHosted: "no",
    kong: "no",
    official: "no",
    glama: "no",
  },
  {
    feature: "Rate limiting",
    toolroute: "yes",
    selfHosted: "Manual",
    kong: "yes",
    official: "no",
    glama: "partial",
  },
  {
    feature: "Schema markup for tools",
    toolroute: "yes",
    selfHosted: "no",
    kong: "no",
    official: "no",
    glama: "partial",
  },
  {
    feature: "Belief-based rankings",
    toolroute: "yes",
    selfHosted: "no",
    kong: "no",
    official: "no",
    glama: "no",
  },
];

const competitors = [
  { key: "toolroute" as const, label: "ToolRoute", highlight: true },
  { key: "selfHosted" as const, label: "Self-Hosted MCP" },
  { key: "kong" as const, label: "Kong MCP Registry" },
  { key: "official" as const, label: "Official MCP Registry" },
  { key: "glama" as const, label: "Glama" },
];

function CellContent({ value, highlight }: { value: CellValue; highlight?: boolean }) {
  if (value === "yes") {
    return (
      <span className={`inline-flex items-center justify-center ${highlight ? "text-accent" : "text-green"}`}>
        <Check className="w-4 h-4" />
      </span>
    );
  }
  if (value === "no") {
    return (
      <span className="inline-flex items-center justify-center text-text-muted">
        <X className="w-4 h-4" />
      </span>
    );
  }
  if (value === "partial") {
    return (
      <span className="inline-flex items-center justify-center text-amber">
        <Minus className="w-4 h-4" />
      </span>
    );
  }
  return (
    <span className={`text-xs ${highlight ? "text-accent font-semibold" : "text-text-dim"}`}>
      {value}
    </span>
  );
}

function jsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "ToolRoute vs Alternatives — MCP Gateway Comparison",
    description:
      "A detailed comparison of MCP gateway options: ToolRoute, self-hosted MCP servers, Kong MCP Registry, the official MCP Registry, and Glama. Covers execution, billing, protocols, and more.",
    url: "https://toolroute.ai/compare",
    publisher: {
      "@type": "Organization",
      name: "ToolRoute",
      url: "https://toolroute.ai",
    },
    datePublished: "2026-04-15",
    dateModified: "2026-04-15",
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": "https://toolroute.ai/compare",
    },
  };
}

export default function ComparePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd()) }}
      />

      <div className="space-y-24 pb-16">
        {/* Hero */}
        <section className="text-center pt-12">
          <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-full px-4 py-1.5 mb-6">
            <Zap className="w-3.5 h-3.5 text-accent" />
            <span className="text-xs text-accent font-medium">Comparison</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            ToolRoute vs the alternatives
          </h1>
          <p className="text-text-dim max-w-2xl mx-auto text-sm leading-relaxed mb-4">
            Most MCP registries help you <em>find</em> tools. ToolRoute is the
            only gateway that <strong>executes</strong> them&mdash;with unified billing,
            five protocols, and an intelligence layer that picks the right tool
            for your task.
          </p>
          <p className="text-text-muted max-w-xl mx-auto text-xs leading-relaxed">
            This is an honest comparison. Where competitors do something well, we
            say so. Where ToolRoute is the only option, we explain why.
          </p>
        </section>

        {/* Comparison Table */}
        <section className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">
            Feature-by-feature comparison
          </h2>
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-bg-card">
                    <th className="text-left p-4 text-text-muted font-medium text-xs uppercase tracking-wider min-w-[180px]">
                      Feature
                    </th>
                    {competitors.map((c) => (
                      <th
                        key={c.key}
                        className={`p-4 text-center font-medium text-xs uppercase tracking-wider min-w-[120px] ${
                          c.highlight ? "text-accent" : "text-text-muted"
                        }`}
                      >
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row) => (
                    <tr
                      key={row.feature}
                      className="hover:bg-bg-card-hover transition-colors"
                    >
                      <td className="p-4 text-text">{row.feature}</td>
                      {competitors.map((c) => (
                        <td key={c.key} className="p-4 text-center">
                          <CellContent
                            value={row[c.key]}
                            highlight={c.highlight}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-text-muted text-xs text-center mt-4">
            Data accurate as of April 2026. Entries marked with a dash indicate
            partial or limited support.
          </p>
        </section>

        {/* Why it matters */}
        <section className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">
            Why these differences matter
          </h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {[
              {
                title: "Execution, not just discovery",
                body: "Registries list tools. ToolRoute runs them. One POST request to /api/v1/execute and your agent has results. No server management, no provider accounts, no credential juggling.",
              },
              {
                title: "Unified billing across all tools",
                body: "Buy credits once. Use them on any tool. No more managing separate subscriptions for search, email, code analysis, and 20 other APIs. One bill, one dashboard.",
              },
              {
                title: "Five protocols, one endpoint",
                body: "REST, MCP Streamable HTTP, Google A2A, OpenAI function-calling format, and native SDKs. Your agent speaks whatever protocol it wants — ToolRoute translates.",
              },
              {
                title: "Belief-based intelligence",
                body: "ToolRoute tracks real usage data across hundreds of agents and builds beliefs about which tools work best for which tasks. Auto-routing uses this intelligence to pick the right tool automatically.",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="border border-border rounded-lg p-6 bg-bg-card"
              >
                <h3 className="font-semibold text-sm mb-2">{card.title}</h3>
                <p className="text-sm text-text-dim leading-relaxed">
                  {card.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Competitor detail sections */}
        <section className="max-w-4xl mx-auto space-y-10">
          <h2 className="text-2xl font-bold text-center mb-2">
            Detailed breakdowns
          </h2>
          <p className="text-text-muted text-xs text-center mb-8">
            An honest look at each alternative and where it fits.
          </p>

          {[
            {
              name: "Self-Hosted MCP Servers",
              strengths:
                "Full control over infrastructure. BYOK is automatic since you own the keys. Unlimited customization. No vendor lock-in.",
              weaknesses:
                "You maintain every server, handle auth, manage updates, and build your own billing. No cross-tool intelligence. Each tool is its own island. Scaling means scaling each server independently.",
              verdict:
                "Best for teams with dedicated DevOps who need maximum control and are willing to trade convenience for it.",
            },
            {
              name: "Kong MCP Registry",
              strengths:
                "Backed by Kong's API gateway expertise. Strong rate limiting and traffic management. Enterprise pedigree.",
              weaknesses:
                "Registry only — does not execute tools. No billing layer. Focused on cataloging and traffic policies, not on running tools for agents.",
              verdict:
                "Good for enterprises already using Kong who want to catalog internal MCP servers. Not a replacement for an execution gateway.",
            },
            {
              name: "Official MCP Registry",
              strengths:
                "Authoritative source for MCP server metadata. Directly maintained by the MCP specification community. Good reference for discovering what exists.",
              weaknesses:
                "Pure discovery — no execution, no billing, no auth management. You still need to self-host or use a gateway to actually call the tools you find.",
              verdict:
                "Essential reference. Use it alongside an execution layer like ToolRoute.",
            },
            {
              name: "Glama",
              strengths:
                "Clean UI for MCP tool discovery. Growing catalog. Some execution support for select tools. Community-driven.",
              weaknesses:
                "Limited protocol support (MCP only). No unified billing or credit system. No BYOK. No auto-routing or belief-based intelligence. Execution coverage is partial.",
              verdict:
                "Good for browsing MCP servers. Gaps become apparent when you need production-grade execution across multiple protocols.",
            },
          ].map((comp) => (
            <div
              key={comp.name}
              className="border border-border rounded-lg p-6 bg-bg-card"
            >
              <h3 className="font-semibold mb-4">{comp.name}</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-green font-medium">Strengths: </span>
                  <span className="text-text-dim">{comp.strengths}</span>
                </div>
                <div>
                  <span className="text-amber font-medium">Weaknesses: </span>
                  <span className="text-text-dim">{comp.weaknesses}</span>
                </div>
                <div>
                  <span className="text-accent font-medium">Verdict: </span>
                  <span className="text-text-dim">{comp.verdict}</span>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* Bottom CTA */}
        <section className="text-center">
          <div className="border border-border rounded-lg p-10 bg-bg-card max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-3">
              Ready to stop managing and start building?
            </h2>
            <p className="text-text-dim text-sm mb-6">
              One API key. One bill. Every tool your agent needs.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold px-6 py-3 rounded-lg transition-colors text-sm"
              >
                View Pricing
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center gap-2 text-text-dim hover:text-accent text-sm transition-colors"
              >
                Read the docs
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
