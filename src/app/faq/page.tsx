import type { Metadata } from "next";
import Link from "next/link";
import { HelpCircle } from "lucide-react";
import { safeJsonLd } from "@/lib/json-ld";

export const metadata: Metadata = {
  title: "MCP & ToolRoute FAQ — 20 Answers for AI Developers | ToolRoute",
  description:
    "Straight answers about MCP (Model Context Protocol), ToolRoute's 87-tool gateway, pricing, BYOK, protocols, security, and how it compares to self-hosting, Composio, Zapier, and Kong.",
  alternates: { canonical: "/faq" },
  openGraph: {
    title: "MCP & ToolRoute FAQ — 20 Answers for AI Developers",
    description:
      "20 questions answered about MCP, ToolRoute, pricing, BYOK, protocols, and alternatives.",
    url: "https://toolroute.ai/faq",
  },
};

interface QA {
  id: string;
  q: string;
  a: string;
  link?: { href: string; label: string };
}

const faqs: QA[] = [
  // MCP basics
  {
    id: "what-is-mcp",
    q: "What is MCP (Model Context Protocol)?",
    a: "MCP is an open protocol from Anthropic that lets AI models call external tools, resources, and prompts through a standard JSON-RPC 2.0 interface. It replaces one-off function-calling integrations with a single uniform way for any model (Claude, GPT, open-source LLMs) to talk to any MCP-compliant server. Think of it as USB for AI tools.",
    link: { href: "/blog/what-is-model-context-protocol", label: "Full MCP explainer" },
  },
  {
    id: "how-does-mcp-work",
    q: "How does MCP work?",
    a: "MCP runs a JSON-RPC 2.0 conversation between an MCP client (the agent or host application) and an MCP server (the tool provider). The client discovers capabilities with tools/list, invokes them with tools/call, and receives structured results that can include text, images, or streamed events. Transports include stdio for local processes and Streamable HTTP for remote servers.",
    link: { href: "/glossary#json-rpc", label: "JSON-RPC definition" },
  },
  {
    id: "why-mcp-over-rest",
    q: "Why use MCP instead of plain REST APIs?",
    a: "MCP gives AI agents a self-describing, discoverable interface that REST does not: tools advertise their schemas, descriptions, and parameters via tools/list so the model can pick the right one without prompt engineering. REST still powers most backends, but MCP is the layer that makes those backends addressable by an autonomous agent without custom glue per endpoint.",
    link: { href: "/blog/mcp-vs-rest-api-ai-agents", label: "MCP vs REST deep dive" },
  },
  {
    id: "how-many-mcp-servers",
    q: "How many MCP servers exist?",
    a: "ToolRoute curates 87 production-grade tools as of April 2026, of which 34 expose a native MCP Streamable HTTP endpoint. The wider ecosystem contains several hundred community servers on GitHub, but quality and protocol compliance vary sharply — the curated registry is the filtered slice.",
    link: { href: "/mcp-statistics", label: "Full MCP statistics" },
  },

  // ToolRoute basics
  {
    id: "what-is-toolroute",
    q: "What is ToolRoute?",
    a: "ToolRoute is the OpenRouter for tools — a single gateway that executes 87 curated third-party tools through one API key and one unified protocol layer. Agents can call any tool via REST, MCP Streamable HTTP, A2A, or OpenAI function-calling format without managing 87 separate SDKs, credentials, and rate limits.",
  },
  {
    id: "why-use-toolroute",
    q: "Why use ToolRoute instead of integrating tools directly?",
    a: "Integrating 87 tools yourself means 87 SDKs, 87 auth flows, 87 rate limiters, 87 billing relationships, and a rewrite every time a vendor changes their API. ToolRoute collapses that into one API key, one credit balance, one status page, and one set of docs — while auto-routing to the best tool per job using 54 category beliefs learned from real usage.",
    link: { href: "/compare", label: "ToolRoute vs alternatives" },
  },
  {
    id: "how-many-tools-toolroute",
    q: "How many tools does ToolRoute support?",
    a: "ToolRoute currently supports 87 tools, 46 Claude Code skills, and 6 multi-tool composites spanning 12 super-categories (Infrastructure, Content, Marketing, Communication, Operations, DevOps, CRM & Sales, Scheduling, Security, Analytics, Ecommerce, Finance). Tools are added weekly and only listings that score 8.0+/10 on the internal quality rubric ship to production.",
    link: { href: "/tools", label: "Browse all tools" },
  },
  {
    id: "which-protocols",
    q: "Which protocols does ToolRoute support?",
    a: "ToolRoute exposes five protocols over the same tool surface: REST (POST /api/v1/execute), MCP Streamable HTTP (POST /mcp), A2A — Google's Agent-to-Agent protocol (POST /api/a2a), OpenAI function-calling (GET /api/v1/tools?format=openai), and native SDKs for Node and Python. The same API key works across all five.",
    link: { href: "/docs", label: "Protocol docs" },
  },

  // Pricing
  {
    id: "pricing",
    q: "How does ToolRoute pricing work?",
    a: "ToolRoute uses prepaid credits with optional auto-top-up. You load a balance via Stripe, and each tool call draws credits based on that tool's published cost — no monthly seat fees and no surprise overages. Usage-based tools pass through at cost with a thin gateway markup; free tools stay free. BYOK cuts the markup to zero on supported providers.",
    link: { href: "/pricing", label: "See pricing" },
  },
  {
    id: "is-toolroute-free",
    q: "Is ToolRoute free to use?",
    a: "Yes for 30 of the 87 tools (34.5%), which have a fully free tier you can call with just an API key. An additional 35 tools (40.2%) are freemium — free within generous limits — so about 75% of the registry can be used without paying the underlying provider. Freemium and paid-only tools bill through your ToolRoute credit balance.",
    link: { href: "/blog/free-mcp-servers-2026", label: "Free MCP servers 2026" },
  },

  // BYOK + auth
  {
    id: "what-is-byok",
    q: "What is BYOK and does ToolRoute support it?",
    a: "BYOK (Bring Your Own Key) lets you register your own API keys for third-party providers with the gateway. ToolRoute supports BYOK on every provider whose terms allow it — your requests route through your own account at the provider, you incur zero gateway markup, and keys are encrypted at rest with AES-256 (never stored in plaintext).",
    link: { href: "/blog/bring-your-own-key-mcp-byok", label: "BYOK explained" },
  },
  {
    id: "security",
    q: "Is ToolRoute secure?",
    a: "All credentials are encrypted at rest with AES-256 and decrypted only at execution time in the gateway process memory. The gateway runs on Vercel with TLS 1.3, per-key rate limiting, full audit logs in Supabase, and signed webhook responses. Provider keys are never written to logs and are never returned to the client after registration.",
    link: { href: "/blog/mcp-server-security-best-practices", label: "MCP security best practices" },
  },

  // Comparison
  {
    id: "vs-composio",
    q: "How is ToolRoute different from Composio?",
    a: "Composio focuses on OAuth-heavy SaaS integrations (Gmail, Slack, Notion) with a managed-auth flow. ToolRoute is protocol-first: the same tool is callable via REST, MCP, A2A, and OpenAI format from one key, with auto-routing driven by category beliefs rather than a static catalog. ToolRoute and Composio are complementary — several ToolRoute adapters route through Composio under the hood.",
    link: { href: "/blog/composio-vs-zapier-ai-automation", label: "Composio vs Zapier" },
  },
  {
    id: "vs-zapier",
    q: "How is ToolRoute different from Zapier or n8n?",
    a: "Zapier and n8n are workflow builders aimed at human operators dragging boxes on a canvas. ToolRoute is an execution gateway aimed at autonomous AI agents making tool calls in a loop — no visual editor, just a structured catalog the model can reason over. If you need a human-facing automation, use Zapier; if you need an agent calling tools in production, use ToolRoute.",
  },
  {
    id: "vs-self-hosted",
    q: "Should I self-host MCP servers instead?",
    a: "Self-hosting one or two MCP servers is fine; self-hosting 87 is a team-month of undifferentiated work and ongoing maintenance. ToolRoute is the managed alternative: unified billing, 5-protocol support, auto-routing, auth management, usage tracking, and prepaid credits — none of which you get from stitching together upstream MCP servers yourself.",
    link: { href: "/blog/self-hosted-vs-cloud-mcp-servers", label: "Self-hosted vs cloud MCP" },
  },
  {
    id: "vs-kong-registry",
    q: "How is ToolRoute different from Kong MCP Registry or the official MCP Registry?",
    a: "Kong's MCP Registry and the official MCP Registry are directories — they list servers but do not execute tool calls. ToolRoute is an executing gateway: the same catalog entries are backed by live adapters, a unified API key, usage tracking, and billing. You can read the registry for free; you pay ToolRoute only when a tool call succeeds.",
    link: { href: "/compare", label: "Side-by-side comparison" },
  },

  // Getting started
  {
    id: "get-started",
    q: "How do I get started with ToolRoute?",
    a: "Sign up at toolroute.ai, create an API key from the dashboard, and load credits via Stripe — or start on the free tier with no card required. Then POST to /api/v1/execute with a tool ID and input, or connect your agent to the MCP endpoint at https://toolroute.ai/mcp. The full quickstart in the docs takes about five minutes.",
    link: { href: "/docs", label: "Quickstart docs" },
  },
  {
    id: "claude-code-setup",
    q: "How do I use ToolRoute with Claude Code?",
    a: "Add ToolRoute to your .mcp.json as an HTTP MCP server pointing at https://toolroute.ai/mcp with your API key in the Authorization header. Claude Code will then discover all 87 tools via tools/list and call them with tools/call — no per-tool SDK installs. ToolRoute recommends using one hub port rather than stdio spawns to keep session memory under control.",
    link: { href: "/blog/claude-code-mcp-server-setup", label: "Claude Code MCP setup" },
  },
  {
    id: "openai-agents-setup",
    q: "Does ToolRoute work with OpenAI Agents and function-calling?",
    a: "Yes. Call GET /api/v1/tools?format=openai to receive the full tool catalog as OpenAI-formatted function definitions, then pass the tool calls your model produces to POST /api/v1/execute. ToolRoute handles the translation from OpenAI function-call format to the underlying provider's API automatically.",
    link: { href: "/blog/openai-agents-mcp-tools", label: "OpenAI Agents + MCP tools" },
  },
  {
    id: "auto-routing",
    q: "What is auto-routing in ToolRoute?",
    a: "Auto-routing lets you describe a task in natural language instead of picking a specific tool — ToolRoute selects the best tool from 54 category beliefs formed by real usage data and success rates. Ask for 'documentation for Next.js router' and the router calls Context7 without you naming it; champions get unseated when a challenger tool consistently outperforms them.",
    link: { href: "/blog/mcp-auto-routing-ai-agent-tools", label: "Auto-routing deep dive" },
  },
];

/* ---------- FAQPage schema ---------- */
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: f.a,
    },
  })),
};

export default function FAQPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />

      <div className="pb-16 max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-full px-4 py-1.5 mb-6">
            <HelpCircle className="w-3.5 h-3.5 text-accent" />
            <span className="text-xs text-accent font-medium">FAQ</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            MCP &amp; ToolRoute FAQ
          </h1>
          <p className="text-text-dim leading-relaxed">
            Straight answers for AI developers evaluating the Model Context Protocol ecosystem and ToolRoute&apos;s 87-tool gateway. Every answer leads with the direct response — no preamble, no fluff. {faqs.length} questions, updated 2026-04-16.
          </p>
        </div>

        {/* Table of contents */}
        <nav
          aria-label="FAQ table of contents"
          className="border border-border rounded-lg p-4 bg-bg-card mb-10"
        >
          <h2 className="text-xs uppercase tracking-wider text-text-muted font-semibold mb-3">
            Jump to a question
          </h2>
          <ol className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-sm list-decimal pl-5 marker:text-text-muted">
            {faqs.map((f) => (
              <li key={f.id}>
                <a
                  href={`#${f.id}`}
                  className="text-accent hover:underline"
                >
                  {f.q}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* Questions */}
        <div className="space-y-8">
          {faqs.map((f) => (
            <article
              key={f.id}
              id={f.id}
              className="border border-border rounded-lg p-5 bg-bg-card scroll-mt-20 hover:border-accent/30 transition-colors"
            >
              <h2 className="text-lg font-semibold mb-3">{f.q}</h2>
              <p className="text-sm text-text-dim leading-relaxed mb-3">
                {f.a}
              </p>
              {f.link && (
                <Link
                  href={f.link.href}
                  className="text-xs text-accent hover:underline inline-flex items-center gap-1"
                >
                  {f.link.label} &rarr;
                </Link>
              )}
            </article>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="border-t border-border mt-16 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link
            href="/docs"
            className="text-sm text-accent hover:underline inline-flex items-center gap-1"
          >
            Read the API documentation &rarr;
          </Link>
          <Link
            href="/tools"
            className="text-sm text-accent hover:underline inline-flex items-center gap-1"
          >
            Browse all 87 tools &rarr;
          </Link>
          <Link
            href="/mcp-statistics"
            className="text-sm text-accent hover:underline inline-flex items-center gap-1"
          >
            MCP statistics 2026 &rarr;
          </Link>
        </div>
      </div>
    </>
  );
}
