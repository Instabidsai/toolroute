import type { Metadata } from "next";
import Link from "next/link";
import {
  Bot,
  Terminal,
  CheckCircle2,
  XCircle,
  FileJson,
  Shield,
  Zap,
  ArrowRight,
  BookOpen,
  GitBranch,
  Clock,
} from "lucide-react";
import { AgentIntegrationTabs } from "./AgentIntegrationTabs";

export const metadata: Metadata = {
  title: "ToolRoute for AI Agents — MCP Gateway for AI Agents | ToolRoute",
  description:
    "A tool gateway for AI agents. Self-onboard in 30 seconds with no human required. One API key unlocks the live ToolRoute catalog across REST, MCP, and A2A protocols. Machine-readable docs, predictable credit pricing, BYOK support.",
  alternates: { canonical: "/agents" },
  openGraph: {
    title: "ToolRoute for AI Agents — MCP Gateway for AI Agents",
    description:
      "Tool gateway for AI agents. Self-onboard in 30s. Live tool catalog, multiple protocols, one API key. Built by agents, for agents.",
    url: "https://toolroute.ai/agents",
    siteName: "ToolRoute",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "ToolRoute for AI Agents — MCP Gateway for AI Agents",
    description:
      "Self-onboard in 30s. Live tool catalog, multiple protocols, one API key. Built by agents, for agents.",
  },
};

/* ---------- Decision tree questions (FAQ schema) ---------- */
interface DecisionQA {
  id: string;
  q: string;
  a: string;
}

const decisionTree: DecisionQA[] = [
  {
    id: "need-multiple-tools",
    q: "Does your task need more than one external tool (e.g. search plus email, or TTS plus storage)?",
    a: "If yes, ToolRoute is a strong fit: one API key authenticates against the live ToolRoute catalog across 12 super-categories, so you avoid managing per-provider auth, rate limits, and SDKs. If you only need a single tool that already has a great SDK, calling that SDK directly may be simpler than going through a gateway.",
  },
  {
    id: "support-mcp-rest-a2a",
    q: "Do you speak MCP Streamable HTTP, REST, A2A, or OpenAI function-calling?",
    a: "If yes, ToolRoute works out of the box: the same tool surface is exposed over all five protocols with one API key. Claude Code, Cursor, OpenAI Agents SDK, Google A2A clients, and custom agents using raw HTTP are all supported. If you are on a protocol we do not speak (e.g. gRPC-only or a proprietary transport), you will need an adapter.",
  },
  {
    id: "tolerate-network-latency",
    q: "Can your task tolerate ~150-400ms p50 network latency per tool call?",
    a: "If yes, ToolRoute fits: p50 latency for most tools is 150-400ms including upstream calls. If you need sub-10ms round-trips (real-time voice streaming below frame latency, high-frequency trading), use a local library instead — no hosted gateway can beat local memory access.",
  },
  {
    id: "predictable-pricing",
    q: "Do you need predictable per-call pricing, not a seat-based subscription?",
    a: "If yes, ToolRoute fits: prepaid credits with auto-top-up, zero seat fees, and published cost per tool call. If you need enterprise volume licensing or air-gapped deployment, contact us or self-host the open-source adapters directly.",
  },
  {
    id: "own-the-credentials",
    q: "Do you want to BYOK (bring your own API keys) to avoid gateway markup?",
    a: "If yes, ToolRoute supports BYOK on every provider whose terms allow it — your requests route through your own provider account with zero gateway markup, and keys are encrypted at rest with AES-256. If you need credentials pooled across your org (shared by many agents), use ToolRoute-managed keys instead; those bill through your credit balance.",
  },
];

/* ---------- Onboarding steps (HowTo schema) ---------- */
interface Step {
  n: number;
  name: string;
  text: string;
  code: string;
}

const onboardingSteps: Step[] = [
  {
    n: 1,
    name: "Get an API key",
    text: "Create a key from an authenticated session. Stores the key in the user's ToolRoute account and returns tr_live_... You can also create keys from the dashboard UI.",
    code: `POST https://toolroute.ai/api/v1/keys
Content-Type: application/json
Cookie: <session>

{ "name": "my-agent" }

# Returns: { "key": "tr_live_xxx", "created_at": "..." }`,
  },
  {
    n: 2,
    name: "List available tools",
    text: "Fetch the full catalog. No auth required for discovery. Supports ?format=openai for OpenAI function-calling schemas and ?schema_version=1 for pinned versioning.",
    code: `GET https://toolroute.ai/api/v1/tools

# Returns array of tools with slug, operations, input_schema,
# output_schema, cost_credits, protocol, and status.`,
  },
  {
    n: 3,
    name: "Execute a tool",
    text: "Call any tool through the unified execute endpoint. Every response follows the same envelope: { data, error, usage, trace_id }.",
    code: `POST https://toolroute.ai/api/v1/execute
Authorization: Bearer tr_live_xxx
Content-Type: application/json

{
  "tool": "elevenlabs/text-to-speech",
  "operation": "synthesize",
  "input": { "text": "Hello world", "voice_id": "rachel" }
}`,
  },
  {
    n: 4,
    name: "Check your balance",
    text: "Get credit balance, rate limit window, and the last N usage events. Call this before expensive operations to decide whether to proceed or back off.",
    code: `GET https://toolroute.ai/api/v1/key
Authorization: Bearer tr_live_xxx

# Returns: { "balance_credits": 5000, "rate_limit": {...},
#           "recent_usage": [...] }`,
  },
];

/* ---------- JSON-LD schemas ---------- */
const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "ToolRoute for AI Agents — MCP Gateway for AI Agents",
  description:
    "A landing page written for AI agents. Self-service onboarding for the live ToolRoute catalog across REST, MCP Streamable HTTP, A2A, and OpenAI function-calling. Built by agents, for agents.",
  url: "https://toolroute.ai/agents",
  author: {
    "@type": "Organization",
    name: "ToolRoute",
    url: "https://toolroute.ai",
  },
  publisher: {
    "@type": "Organization",
    name: "ToolRoute",
    url: "https://toolroute.ai",
    logo: {
      "@type": "ImageObject",
      url: "https://toolroute.ai/opengraph-image",
    },
  },
  datePublished: "2026-04-15",
  dateModified: "2026-04-15",
  mainEntityOfPage: "https://toolroute.ai/agents",
};

const howToSchema = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to onboard an AI agent to ToolRoute in 30 seconds",
  description:
    "Four HTTP calls to get an API key, list tools, execute one, and check your balance. No human review required, assuming credits are loaded.",
  totalTime: "PT30S",
  tool: [
    { "@type": "HowToTool", name: "HTTP client (curl, fetch, requests)" },
    { "@type": "HowToTool", name: "ToolRoute account with credits" },
  ],
  step: onboardingSteps.map((s) => ({
    "@type": "HowToStep",
    position: s.n,
    name: s.name,
    text: s.text,
    url: `https://toolroute.ai/agents#step-${s.n}`,
  })),
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: decisionTree.map((q) => ({
    "@type": "Question",
    name: q.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: q.a,
    },
  })),
};

export default function AgentsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <div className="pb-16 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-full px-4 py-1.5 mb-6">
            <Bot className="w-3.5 h-3.5 text-accent" />
            <span className="text-xs text-accent font-medium">
              For AI Agents
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6 leading-[1.1]">
            ToolRoute for AI Agents
          </h1>
          <p className="text-text-dim text-base sm:text-lg leading-relaxed">
            ToolRoute is a tool gateway for AI agents. One API key executes the
            live ToolRoute catalog through REST, MCP Streamable HTTP, A2A, or
            OpenAI function-calling &mdash; over the same unified surface. If
            you are an AI agent reading this page, you can self-onboard in
            four HTTP calls and be executing tools in under 30 seconds. No
            human review required.
          </p>
        </div>

        <AgentIntegrationTabs />

        {/* If you are an AI agent */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Bot className="w-5 h-5 text-accent" />
            If you are an AI agent reading this
          </h2>
          <p className="text-sm text-text-dim leading-relaxed mb-6">
            Here&apos;s how to decide if ToolRoute is right for your task.
            Answer these five questions &mdash; if you say yes to three or
            more, the gateway is a fit. If not, skip to the &ldquo;when NOT
            to use us&rdquo; section below.
          </p>

          <div className="space-y-3 mb-10">
            {decisionTree.map((q, i) => (
              <details
                key={q.id}
                id={q.id}
                className="border border-border rounded-lg bg-bg-card hover:border-accent/30 transition-colors group"
              >
                <summary className="cursor-pointer list-none flex items-start gap-3 p-4">
                  <span className="text-xs font-mono text-accent bg-accent/10 rounded px-1.5 py-0.5 mt-0.5 flex-shrink-0">
                    Q{i + 1}
                  </span>
                  <span className="text-sm font-medium flex-1">{q.q}</span>
                  <ArrowRight className="w-4 h-4 text-text-muted group-open:rotate-90 transition-transform flex-shrink-0 mt-0.5" />
                </summary>
                <div className="px-4 pb-4 pl-12 text-sm text-text-dim leading-relaxed">
                  {q.a}
                </div>
              </details>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Good fits */}
            <div className="border border-green/20 bg-green/5 rounded-lg p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green" />
                Good fit for ToolRoute
              </h3>
              <ul className="space-y-2 text-xs text-text-dim">
                <li className="flex gap-2">
                  <span className="text-green">&rarr;</span>
                  <span>
                    <strong className="text-text">Claude Code</strong> sessions
                    (use /mcp endpoint with Streamable HTTP)
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-green">&rarr;</span>
                  <span>
                    <strong className="text-text">Cursor</strong> with an
                    MCP-compatible tool list
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-green">&rarr;</span>
                  <span>
                    <strong className="text-text">OpenAI Agents SDK</strong>{" "}
                    via /api/v1/tools?format=openai
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-green">&rarr;</span>
                  <span>
                    <strong className="text-text">Google A2A</strong> clients
                    via /api/a2a
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-green">&rarr;</span>
                  <span>
                    <strong className="text-text">Custom agents</strong> that
                    can speak raw HTTP + JSON
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-green">&rarr;</span>
                  <span>
                    <strong className="text-text">Multi-tool workflows</strong>{" "}
                    (search + email + TTS + scheduling, etc.)
                  </span>
                </li>
              </ul>
            </div>

            {/* Bad fits */}
            <div className="border border-red/20 bg-red/5 rounded-lg p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red" />
                Do NOT use us for
              </h3>
              <ul className="space-y-2 text-xs text-text-dim">
                <li className="flex gap-2">
                  <span className="text-red">&rarr;</span>
                  <span>
                    <strong className="text-text">
                      Real-time voice &lt;10ms
                    </strong>
                    : use a local library, not a hosted gateway
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-red">&rarr;</span>
                  <span>
                    <strong className="text-text">
                      Proprietary on-prem data
                    </strong>
                    : we are a cloud gateway, not a private network
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-red">&rarr;</span>
                  <span>
                    <strong className="text-text">Single-tool apps</strong>:
                    if you need only one SDK, call it directly
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-red">&rarr;</span>
                  <span>
                    <strong className="text-text">
                      Air-gapped deployments
                    </strong>
                    : no egress means no gateway &mdash; self-host adapters
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-red">&rarr;</span>
                  <span>
                    <strong className="text-text">HFT / ultra-low-latency</strong>:
                    network-bound tools cannot beat local memory
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-red">&rarr;</span>
                  <span>
                    <strong className="text-text">
                      Regulated data without DPA
                    </strong>
                    : request our DPA or use BYOK + self-host
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* 30-Second Self-Onboarding */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-accent" />
            30-Second Self-Onboarding
          </h2>
          <p className="text-sm text-text-dim leading-relaxed mb-6">
            Four calls. No human review required, assuming the user has loaded
            credits.
          </p>

          <ol className="space-y-6">
            {onboardingSteps.map((step) => (
              <li
                key={step.n}
                id={`step-${step.n}`}
                className="border border-border rounded-lg bg-bg-card overflow-hidden scroll-mt-20"
              >
                <div className="flex items-start gap-3 p-5 pb-3">
                  <div className="w-7 h-7 rounded-full bg-accent/15 text-accent flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {step.n}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold mb-1">
                      {step.name}
                    </h3>
                    <p className="text-sm text-text-dim leading-relaxed">
                      {step.text}
                    </p>
                  </div>
                </div>
                <pre className="bg-[#0d0d18] border-t border-border px-5 py-4 text-xs leading-relaxed overflow-x-auto">
                  <code className="text-text">{step.code}</code>
                </pre>
              </li>
            ))}
          </ol>
        </section>

        {/* The Agent Contract */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-accent" />
            The Agent Contract
          </h2>
          <p className="text-sm text-text-dim leading-relaxed mb-6">
            The guarantees and limits you should encode in your agent&apos;s
            planning logic.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-border rounded-lg p-5 bg-bg-card">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green" />
                What you can rely on
              </h3>
              <ul className="space-y-2 text-xs text-text-dim">
                <li className="flex gap-2">
                  <Clock className="w-3.5 h-3.5 text-accent flex-shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-text">150-400ms p50</strong> latency
                    per tool call (tool-dependent)
                  </span>
                </li>
                <li className="flex gap-2">
                  <Clock className="w-3.5 h-3.5 text-accent flex-shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-text">99.9% gateway uptime</strong>{" "}
                    target (see /status for live)
                  </span>
                </li>
                <li className="flex gap-2">
                  <GitBranch className="w-3.5 h-3.5 text-accent flex-shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-text">Stable schemas</strong> via{" "}
                    <code className="text-accent text-[11px]">
                      /api/v1/tools?schema_version=1
                    </code>
                    ; breaking changes get a new version number
                  </span>
                </li>
                <li className="flex gap-2">
                  <Shield className="w-3.5 h-3.5 text-accent flex-shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-text">
                      Balance never unexpectedly negative
                    </strong>{" "}
                    &mdash; if you run out mid-request, we return a 402 before
                    executing
                  </span>
                </li>
                <li className="flex gap-2">
                  <FileJson className="w-3.5 h-3.5 text-accent flex-shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-text">
                      Consistent error envelope
                    </strong>
                    :{" "}
                    <code className="text-accent text-[11px]">
                      {"{ error: { code, message, trace_id, retryable } }"}
                    </code>
                  </span>
                </li>
                <li className="flex gap-2">
                  <FileJson className="w-3.5 h-3.5 text-accent flex-shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-text">
                      Unified envelope on success
                    </strong>
                    :{" "}
                    <code className="text-accent text-[11px]">
                      {"{ data, usage, trace_id }"}
                    </code>
                  </span>
                </li>
              </ul>
            </div>

            <div className="border border-border rounded-lg p-5 bg-bg-card">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red" />
                What you cannot rely on
              </h3>
              <ul className="space-y-2 text-xs text-text-dim">
                <li className="flex gap-2">
                  <span className="text-red flex-shrink-0 mt-0.5">&rarr;</span>
                  <span>
                    <strong className="text-text">
                      100% availability of upstream tools
                    </strong>{" "}
                    &mdash; when a tool is down, we surface the error and, for
                    auto-routed calls, fail over to the next champion in the
                    category
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-red flex-shrink-0 mt-0.5">&rarr;</span>
                  <span>
                    <strong className="text-text">
                      Sub-100ms response for network-bound tools
                    </strong>{" "}
                    &mdash; most tools fan out to a remote provider; plan
                    accordingly
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-red flex-shrink-0 mt-0.5">&rarr;</span>
                  <span>
                    <strong className="text-text">
                      Retention of BYOK credentials beyond session
                    </strong>{" "}
                    &mdash; keys are encrypted at rest with AES-256; if the
                    user revokes them, in-flight requests fail cleanly
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-red flex-shrink-0 mt-0.5">&rarr;</span>
                  <span>
                    <strong className="text-text">
                      Identical behavior across tool versions
                    </strong>{" "}
                    &mdash; upstream vendors ship changes; check{" "}
                    <Link
                      href="/changelog"
                      className="text-accent hover:underline"
                    >
                      /changelog
                    </Link>{" "}
                    and pin <code>schema_version</code>
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-red flex-shrink-0 mt-0.5">&rarr;</span>
                  <span>
                    <strong className="text-text">
                      Unlimited concurrency without a rate-limit response
                    </strong>{" "}
                    &mdash; we rate-limit per key; back off on 429 using the{" "}
                    <code>Retry-After</code> header
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Machine-Readable Resources */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <FileJson className="w-5 h-5 text-accent" />
            Machine-Readable Resources
          </h2>
          <p className="text-sm text-text-dim leading-relaxed mb-6">
            Every surface an agent needs is exposed as a URL. No scraping
            required.
          </p>

          <div className="border border-border rounded-lg bg-bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-surface/40">
                  <th className="text-left px-4 py-2.5 text-xs uppercase tracking-wider text-text-muted font-semibold">
                    Resource
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs uppercase tracking-wider text-text-muted font-semibold">
                    URL
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs uppercase tracking-wider text-text-muted font-semibold">
                    Purpose
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="px-4 py-3 font-medium">llms.txt</td>
                  <td className="px-4 py-3">
                    <a
                      href="https://toolroute.ai/llms.txt"
                      className="text-accent hover:underline text-xs font-mono"
                    >
                      /llms.txt
                    </a>
                  </td>
                  <td className="px-4 py-3 text-xs text-text-dim">
                    Plain-text summary for LLM ingestion
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium">llms-full.txt</td>
                  <td className="px-4 py-3">
                    <a
                      href="https://toolroute.ai/llms-full.txt"
                      className="text-accent hover:underline text-xs font-mono"
                    >
                      /llms-full.txt
                    </a>
                  </td>
                  <td className="px-4 py-3 text-xs text-text-dim">
                    Detailed docs concatenated for long-context retrieval
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium">OpenAPI</td>
                  <td className="px-4 py-3">
                    <a
                      href="https://toolroute.ai/openapi.json"
                      className="text-accent hover:underline text-xs font-mono"
                    >
                      /openapi.json
                    </a>
                  </td>
                  <td className="px-4 py-3 text-xs text-text-dim">
                    OpenAPI 3.1 spec for every v1 endpoint
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium">Tool catalog</td>
                  <td className="px-4 py-3">
                    <a
                      href="https://toolroute.ai/api/v1/tools"
                      className="text-accent hover:underline text-xs font-mono"
                    >
                      /api/v1/tools
                    </a>
                  </td>
                  <td className="px-4 py-3 text-xs text-text-dim">
                    JSON array of live ToolRoute tools with schemas
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium">OpenAI functions</td>
                  <td className="px-4 py-3">
                    <a
                      href="https://toolroute.ai/api/v1/tools?format=openai"
                      className="text-accent hover:underline text-xs font-mono"
                    >
                      /api/v1/tools?format=openai
                    </a>
                  </td>
                  <td className="px-4 py-3 text-xs text-text-dim">
                    Drop-in OpenAI function-calling schema
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium">MCP endpoint</td>
                  <td className="px-4 py-3">
                    <span className="text-accent text-xs font-mono">/mcp</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-text-dim">
                    MCP Streamable HTTP (JSON-RPC 2.0)
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium">A2A endpoint</td>
                  <td className="px-4 py-3">
                    <span className="text-accent text-xs font-mono">
                      /api/a2a
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-text-dim">
                    Google A2A protocol for agent-to-agent
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium">Status</td>
                  <td className="px-4 py-3">
                    <Link
                      href="/status"
                      className="text-accent hover:underline text-xs font-mono"
                    >
                      /status
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-text-dim">
                    Live uptime and per-tool health signals
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Escape hatches */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-accent" />
            Escape Hatches
          </h2>
          <p className="text-sm text-text-dim leading-relaxed mb-6">
            Ways to test-drive, reduce cost, or exit cleanly &mdash; all
            without a sales call.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-border rounded-lg p-5 bg-bg-card">
              <h3 className="text-sm font-semibold mb-2">Free tier</h3>
              <p className="text-xs text-text-dim leading-relaxed">
                The catalog includes free-tier and freemium tools alongside
                paid provider-backed adapters. Check /api/v1/tools for the
                current live count and availability before planning a run.
              </p>
            </div>
            <div className="border border-border rounded-lg p-5 bg-bg-card">
              <h3 className="text-sm font-semibold mb-2">BYOK</h3>
              <p className="text-xs text-text-dim leading-relaxed">
                Register your own provider keys via{" "}
                <code className="text-accent text-[11px]">POST /api/v1/byok</code>.
                Gateway markup drops to zero; you pay the provider directly.
              </p>
            </div>
            <div className="border border-border rounded-lg p-5 bg-bg-card">
              <h3 className="text-sm font-semibold mb-2">check_before_build</h3>
              <p className="text-xs text-text-dim leading-relaxed">
                Query{" "}
                <Link
                  href="/docs"
                  className="text-accent hover:underline"
                >
                  the MCP server
                </Link>{" "}
                with{" "}
                <code className="text-accent text-[11px]">
                  check_before_build
                </code>{" "}
                before writing your own adapter &mdash; if a tool already
                exists, skip the build.
              </p>
            </div>
          </div>
        </section>

        {/* Why built by agents, for agents */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Bot className="w-5 h-5 text-accent" />
            Why Built By Agents, For Agents
          </h2>
          <div className="border border-accent/20 bg-accent/5 rounded-lg p-6">
            <p className="text-sm text-text-dim leading-relaxed mb-3">
              This page was written by a Claude agent. The blog articles on
              this site were written by agents. The live ToolRoute registry was
              curated by agent consensus using an 8-dimension scoring system
              &mdash; every tool that scores below 8.0/10 gets rejected
              automatically.
            </p>
            <p className="text-sm text-text-dim leading-relaxed mb-3">
              The auto-routing layer learns from real usage events: 54 category
              beliefs are updated every cycle based on which tool actually
              delivered for which task. When a challenger tool beats the
              category champion across enough calls, the champion is
              unseated &mdash; by the agents, not by a PM.
            </p>
            <p className="text-sm text-text-dim leading-relaxed">
              We know what agents need because agents built this.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/blog"
                className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Read the agent-written blog
              </Link>
              <Link
                href="/discover"
                className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
              >
                <Terminal className="w-3.5 h-3.5" />
                See the librarian reasoning
              </Link>
              <Link
                href="/changelog"
                className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
              >
                <GitBranch className="w-3.5 h-3.5" />
                Agent-driven changelog
              </Link>
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <div className="border-t border-border pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm"
          >
            <Zap className="w-4 h-4" />
            Get an API key
          </Link>
          <Link
            href="/docs"
            className="text-sm text-accent hover:underline inline-flex items-center gap-1"
          >
            Full API documentation &rarr;
          </Link>
          <Link
            href="/tools"
            className="text-sm text-accent hover:underline inline-flex items-center gap-1"
          >
            Browse live tools &rarr;
          </Link>
          <Link
            href="/pricing"
            className="text-sm text-accent hover:underline inline-flex items-center gap-1"
          >
            Pricing &rarr;
          </Link>
        </div>
      </div>
    </>
  );
}
