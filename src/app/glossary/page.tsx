import type { Metadata } from "next";
import Link from "next/link";
import { BookMarked } from "lucide-react";

/* ---------- Metadata ---------- */
export const metadata: Metadata = {
  title: "MCP Glossary — AI Agent Tool Terms Defined | ToolRoute",
  description:
    "MCP glossary of Model Context Protocol terms. Definitions for MCP server, MCP client, MCP gateway, tool call, JSON-RPC, A2A, BYOK, and 20+ AI agent terms.",
  alternates: {
    canonical: "/glossary",
  },
  openGraph: {
    title: "MCP Glossary — AI Agent Tool Terms Defined | ToolRoute",
    description:
      "MCP glossary of Model Context Protocol terms. Definitions for MCP server, MCP client, MCP gateway, tool call, JSON-RPC, A2A, BYOK, and 20+ AI agent terms.",
    url: "https://toolroute.ai/glossary",
  },
};

/* ---------- Term data ---------- */
interface Term {
  id: string;
  term: string;
  definition: string;
  seeAlso: string[];
  blogLink?: { href: string; label: string };
}

const terms: Term[] = [
  {
    id: "a2a-protocol",
    term: "A2A Protocol",
    definition:
      "Agent-to-Agent (A2A) is an open protocol created by Google that enables AI agents built on different frameworks to communicate and collaborate. Unlike MCP which connects agents to tools, A2A focuses on agent-to-agent interoperability through JSON-RPC messages, task lifecycle management, and capability discovery via Agent Cards.",
    seeAlso: ["mcp", "json-rpc", "agent-framework"],
    blogLink: {
      href: "/blog/a2a-vs-mcp-protocol-comparison",
      label: "A2A vs MCP: Protocol Comparison",
    },
  },
  {
    id: "adapter",
    term: "Adapter",
    definition:
      "An adapter is a translation layer that converts a standardized gateway request into a provider-specific API call. In ToolRoute, each adapter handles authentication, input mapping, response normalization, and error translation for one third-party service. Adapters let developers use dozens of different APIs through a single unified interface.",
    seeAlso: ["api-gateway", "mcp-gateway", "auto-routing"],
  },
  {
    id: "agent-framework",
    term: "Agent Framework",
    definition:
      "An agent framework is a software library or platform that provides the scaffolding for building autonomous AI agents. Frameworks like LangChain, CrewAI, AutoGen, and the Anthropic Agent SDK handle orchestration, memory, tool use, and multi-step reasoning so developers can focus on defining agent behavior rather than building infrastructure from scratch.",
    seeAlso: ["function-calling", "tool-call", "mcp-client"],
    blogLink: {
      href: "/blog/build-ai-agent-multiple-tools",
      label: "Build an AI Agent with Multiple Tools",
    },
  },
  {
    id: "api-gateway",
    term: "API Gateway",
    definition:
      "An API gateway is a server that sits between clients and backend services, acting as a single entry point for all API requests. It handles routing, authentication, rate limiting, billing, and protocol translation. Traditional API gateways like Kong or AWS API Gateway are designed for REST traffic, whereas MCP gateways extend this concept to the Model Context Protocol.",
    seeAlso: ["mcp-gateway", "adapter", "auto-routing"],
    blogLink: {
      href: "/blog/mcp-gateway-vs-api-gateway",
      label: "MCP Gateway vs API Gateway",
    },
  },
  {
    id: "auto-routing",
    term: "Auto-Routing",
    definition:
      "Auto-routing is an intelligent dispatch mechanism that selects the best tool for a given task based on natural-language intent. Instead of specifying a tool ID directly, the caller describes what they need and the router matches their request against category beliefs, tool capabilities, and usage history to pick the optimal provider and operation.",
    seeAlso: ["category-belief", "champion", "tool-call"],
  },
  {
    id: "byok",
    term: "BYOK (Bring Your Own Key)",
    definition:
      "BYOK is a billing model where users register their own API keys for third-party providers with a gateway. When a BYOK key is configured, requests route through the user's own account at the provider, incurring zero markup from the gateway. Keys are typically encrypted at rest (AES-256) and never stored in plaintext.",
    seeAlso: ["api-gateway", "credits", "prepaid-billing"],
    blogLink: {
      href: "/blog/bring-your-own-key-mcp-byok",
      label: "Bring Your Own Key: MCP BYOK Explained",
    },
  },
  {
    id: "category-belief",
    term: "Category Belief",
    definition:
      "A category belief is a confidence-weighted assertion about which tool is best for a given task category. Beliefs are formed from usage data, success rates, and explicit challenges, and they evolve over time. When a new tool consistently outperforms the current champion, the belief shifts. This is how ToolRoute's librarian learns which tools to recommend.",
    seeAlso: ["champion", "auto-routing", "composite"],
  },
  {
    id: "champion",
    term: "Champion (ToolRoute)",
    definition:
      "A champion is the highest-confidence tool for a given category in the ToolRoute registry. Champions are determined by category beliefs which track usage patterns, success rates, and quality scores. Any tool can challenge the current champion by providing evidence of superior performance, triggering a belief update if the evidence is strong enough.",
    seeAlso: ["category-belief", "auto-routing", "tool-mcp"],
  },
  {
    id: "composite",
    term: "Composite (ToolRoute)",
    definition:
      "A composite is a pre-built multi-tool workflow that chains several tool calls into a single logical operation. For example, a 'research and summarize' composite might chain a web search, a page scrape, and an LLM summarization into one request. Composites are reusable, versioned, and billed as the sum of their constituent tool costs.",
    seeAlso: ["tool-call", "tool-result", "auto-routing"],
  },
  {
    id: "credits",
    term: "Credits",
    definition:
      "Credits are the internal billing unit in prepaid tool-access platforms. Users purchase credits in advance (typically via Stripe), and each tool call deducts a small amount based on the operation's cost. Credits provide predictable billing, prevent surprise charges, and let developers set hard spending limits for their AI agents.",
    seeAlso: ["prepaid-billing", "byok", "api-gateway"],
    blogLink: {
      href: "/blog/ai-agent-tool-billing-credits",
      label: "AI Agent Tool Billing with Credits",
    },
  },
  {
    id: "function-calling",
    term: "Function Calling",
    definition:
      "Function calling is a capability of large language models (like GPT-4, Claude, and Gemini) that lets the model output structured JSON describing a function it wants to invoke rather than generating free-form text. The host application then executes the function and feeds the result back to the model. Function calling is the mechanism that turns an LLM into an agent that can take actions in the real world.",
    seeAlso: ["tool-call", "tool-result", "agent-framework"],
  },
  {
    id: "json-rpc",
    term: "JSON-RPC",
    definition:
      "JSON-RPC is a lightweight remote procedure call protocol encoded in JSON. Both MCP and A2A use JSON-RPC 2.0 as their wire format, sending requests with a method name, parameters, and an ID, and receiving responses with a result or error. Its simplicity and language-agnosticism make it a natural fit for AI tool protocols.",
    seeAlso: ["mcp", "a2a-protocol", "streamable-http"],
  },
  {
    id: "mcp",
    term: "MCP (Model Context Protocol)",
    definition:
      "The Model Context Protocol (MCP) is an open standard created by Anthropic that defines how AI models and agents connect to external tools and data sources. MCP provides a unified interface for tool discovery, invocation, and result handling, replacing bespoke integrations with a single protocol. It uses JSON-RPC 2.0 over multiple transport layers.",
    seeAlso: ["mcp-server", "mcp-client", "mcp-host", "json-rpc"],
    blogLink: {
      href: "/blog/what-is-model-context-protocol",
      label: "What Is the Model Context Protocol?",
    },
  },
  {
    id: "mcp-client",
    term: "MCP Client",
    definition:
      "An MCP client is a component that maintains an active session with an MCP server, sending JSON-RPC requests and receiving responses. Each client typically connects to one server at a time. MCP clients handle capability negotiation, request serialization, and transport management on behalf of the host application.",
    seeAlso: ["mcp", "mcp-host", "mcp-server"],
  },
  {
    id: "mcp-gateway",
    term: "MCP Gateway",
    definition:
      "An MCP gateway is an intermediary server that aggregates multiple MCP servers (or tool adapters) behind a single endpoint. It handles authentication, billing, rate limiting, and protocol translation so that a client connecting to one gateway gains access to every tool behind it. ToolRoute is an MCP gateway that exposes 50+ tools through one API key.",
    seeAlso: ["mcp", "api-gateway", "mcp-registry", "adapter"],
    blogLink: {
      href: "/blog/what-is-an-mcp-gateway",
      label: "What Is an MCP Gateway?",
    },
  },
  {
    id: "mcp-host",
    term: "MCP Host",
    definition:
      "An MCP host is the user-facing application that orchestrates one or more MCP clients and presents tool capabilities to the end user or AI model. Examples include Claude Desktop, VS Code with Copilot, and custom agent applications. The host is responsible for security policy, user consent, and deciding which tools the model can access.",
    seeAlso: ["mcp", "mcp-client", "mcp-server"],
  },
  {
    id: "mcp-registry",
    term: "MCP Registry",
    definition:
      "An MCP registry is a searchable catalog of available MCP servers and tools. Registries let agents discover what capabilities exist before building custom integrations. ToolRoute functions as both a registry (searchable catalog with category beliefs and usage data) and a gateway (direct execution through a unified API).",
    seeAlso: ["mcp", "mcp-gateway", "champion"],
  },
  {
    id: "mcp-server",
    term: "MCP Server",
    definition:
      "An MCP server is a program that exposes tools, resources, and prompts to MCP clients over a standardized transport (stdio, SSE, or Streamable HTTP). Each server typically wraps one external service or data source, translating MCP JSON-RPC calls into provider-specific API requests. Servers declare their capabilities during the initialization handshake.",
    seeAlso: ["mcp", "mcp-client", "stdio-transport", "sse-transport"],
    blogLink: {
      href: "/blog/best-mcp-servers-ai-agents-2026",
      label: "Best MCP Servers for AI Agents in 2026",
    },
  },
  {
    id: "prepaid-billing",
    term: "Prepaid Billing",
    definition:
      "Prepaid billing is a payment model where users fund their account with credits before making tool calls. Each API request deducts credits based on the operation's cost. This model prevents unexpected charges, simplifies metering for micro-transactions (fractions of a cent per call), and gives developers hard spending limits for autonomous agents.",
    seeAlso: ["credits", "byok", "api-gateway"],
  },
  {
    id: "prompt-mcp",
    term: "Prompt (MCP Primitive)",
    definition:
      "In MCP, a prompt is a reusable template that defines a specific interaction pattern for an AI model. Prompts are one of the three core primitives alongside tools and resources. They are user-controlled, meaning the host application decides when and how to surface them. Prompts can include arguments, multi-turn message sequences, and embedded resource references.",
    seeAlso: ["tool-mcp", "resource-mcp", "mcp"],
  },
  {
    id: "resource-mcp",
    term: "Resource (MCP Primitive)",
    definition:
      "In MCP, a resource is a read-only data source that an MCP server exposes to clients. Resources are identified by URIs and can represent files, database records, API responses, or live system data. They are application-controlled, meaning the host decides how to incorporate them into the model's context. Resources support subscriptions for real-time updates.",
    seeAlso: ["tool-mcp", "prompt-mcp", "mcp"],
  },
  {
    id: "sse-transport",
    term: "SSE Transport",
    definition:
      "Server-Sent Events (SSE) is a transport mechanism where the server pushes real-time updates to the client over a long-lived HTTP connection. In MCP, SSE transport was used in earlier protocol versions for server-to-client streaming. It has largely been superseded by Streamable HTTP, which provides bidirectional communication in a single request-response cycle.",
    seeAlso: ["streamable-http", "stdio-transport", "mcp"],
  },
  {
    id: "stdio-transport",
    term: "Stdio Transport",
    definition:
      "Stdio (standard input/output) is the simplest MCP transport, where the client spawns the server as a child process and communicates by writing JSON-RPC messages to stdin and reading from stdout. Stdio is easy to set up for local development but does not scale to multi-tenant or remote deployments because each client session requires its own server process.",
    seeAlso: ["sse-transport", "streamable-http", "mcp"],
    blogLink: {
      href: "/blog/self-hosted-vs-cloud-mcp-servers",
      label: "Self-Hosted vs Cloud MCP Servers",
    },
  },
  {
    id: "streamable-http",
    term: "Streamable HTTP",
    definition:
      "Streamable HTTP is the recommended remote transport for MCP. The client sends JSON-RPC requests via HTTP POST, and the server can respond with a single JSON result or upgrade to a Server-Sent Events stream for long-running operations. This gives the simplicity of REST for quick calls and the streaming capability of SSE when needed, all through a single endpoint.",
    seeAlso: ["sse-transport", "stdio-transport", "json-rpc", "mcp"],
  },
  {
    id: "tool-call",
    term: "Tool Call",
    definition:
      "A tool call is a structured request from an AI model (or agent) to execute a specific operation. It includes the tool identifier and a JSON object of input parameters. In MCP, tool calls are sent as JSON-RPC requests with the method tools/call. The gateway validates the request, routes it to the correct adapter, and returns a tool result.",
    seeAlso: ["tool-result", "function-calling", "tool-mcp"],
  },
  {
    id: "tool-mcp",
    term: "Tool (MCP Primitive)",
    definition:
      "In MCP, a tool is an executable operation that an MCP server exposes to AI models. Tools are one of the three core primitives alongside resources and prompts. They are model-controlled, meaning the AI model decides when to invoke them (with human-in-the-loop approval from the host). Each tool has a name, description, and a JSON Schema defining its input parameters.",
    seeAlso: ["resource-mcp", "prompt-mcp", "tool-call", "mcp"],
    blogLink: {
      href: "/blog/mcp-tools-for-developers",
      label: "MCP Tools for Developers",
    },
  },
  {
    id: "tool-result",
    term: "Tool Result",
    definition:
      "A tool result is the structured response returned after a tool call executes. It contains the output data from the external service (text, JSON, images, or binary), plus metadata like execution time and cost. In MCP, tool results are returned as JSON-RPC responses with content arrays that can include text and image blocks.",
    seeAlso: ["tool-call", "tool-mcp", "json-rpc"],
  },
];

/* ---------- Sort terms alphabetically ---------- */
const sortedTerms = [...terms].sort((a, b) =>
  a.term.localeCompare(b.term, "en", { sensitivity: "base" })
);

/* ---------- Compute which letters have terms ---------- */
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const lettersWithTerms = new Set(
  sortedTerms.map((t) => t.term[0].toUpperCase())
);

/* ---------- JSON-LD DefinedTermList ---------- */
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "DefinedTermSet",
  name: "MCP Glossary — AI Agent Tool Terms",
  description:
    "Comprehensive glossary of Model Context Protocol (MCP) and AI agent terminology including MCP server, MCP client, MCP gateway, tool call, JSON-RPC, A2A, BYOK, and more.",
  url: "https://toolroute.ai/glossary",
  hasDefinedTerm: sortedTerms.map((t) => ({
    "@type": "DefinedTerm",
    name: t.term,
    description: t.definition,
    url: `https://toolroute.ai/glossary#${t.id}`,
    inDefinedTermSet: "https://toolroute.ai/glossary",
  })),
};

/* ---------- Page ---------- */
export default function GlossaryPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="pb-16 max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-full px-4 py-1.5 mb-6">
            <BookMarked className="w-3.5 h-3.5 text-accent" />
            <span className="text-xs text-accent font-medium">Glossary</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            MCP Glossary
          </h1>
          <p className="text-text-dim leading-relaxed">
            A complete dictionary of Model Context Protocol and AI agent
            terminology. {sortedTerms.length} terms defined, cross-referenced,
            and kept current with the evolving MCP ecosystem.
          </p>
        </div>

        {/* Alphabet jump links */}
        <nav
          aria-label="Alphabet navigation"
          className="flex flex-wrap gap-1.5 mb-10 border border-border rounded-lg p-3 bg-bg-card"
        >
          {alphabet.map((letter) => {
            const active = lettersWithTerms.has(letter);
            return active ? (
              <a
                key={letter}
                href={`#letter-${letter}`}
                className="w-8 h-8 flex items-center justify-center rounded text-xs font-bold text-accent hover:bg-accent/15 transition-colors"
              >
                {letter}
              </a>
            ) : (
              <span
                key={letter}
                className="w-8 h-8 flex items-center justify-center rounded text-xs font-bold text-text-muted/30"
              >
                {letter}
              </span>
            );
          })}
        </nav>

        {/* Terms grouped by letter */}
        {alphabet
          .filter((letter) => lettersWithTerms.has(letter))
          .map((letter) => {
            const letterTerms = sortedTerms.filter(
              (t) => t.term[0].toUpperCase() === letter
            );
            return (
              <section key={letter} id={`letter-${letter}`} className="mb-10">
                <div className="sticky top-14 z-10 bg-bg/95 backdrop-blur-sm border-b border-border pb-2 mb-4 pt-4 scroll-mt-20">
                  <h2 className="text-2xl font-bold text-accent">{letter}</h2>
                </div>
                <div className="space-y-6">
                  {letterTerms.map((t) => (
                    <article
                      key={t.id}
                      id={t.id}
                      className="border border-border rounded-lg p-5 bg-bg-card scroll-mt-24 hover:border-accent/30 transition-colors"
                    >
                      <h3 className="text-lg font-semibold mb-2">{t.term}</h3>
                      <p className="text-sm text-text-dim leading-relaxed mb-3">
                        {t.definition}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        {t.seeAlso.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">
                              See also:
                            </span>
                            {t.seeAlso.map((ref) => {
                              const refTerm = sortedTerms.find(
                                (rt) => rt.id === ref
                              );
                              return (
                                <a
                                  key={ref}
                                  href={`#${ref}`}
                                  className="text-xs text-accent bg-accent/10 px-2 py-0.5 rounded hover:bg-accent/20 transition-colors"
                                >
                                  {refTerm?.term ?? ref}
                                </a>
                              );
                            })}
                          </div>
                        )}
                        {t.blogLink && (
                          <Link
                            href={t.blogLink.href}
                            className="text-xs text-accent hover:underline"
                          >
                            {t.blogLink.label} &rarr;
                          </Link>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}

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
            Browse all tools &rarr;
          </Link>
          <Link
            href="/blog"
            className="text-sm text-accent hover:underline inline-flex items-center gap-1"
          >
            Read the blog &rarr;
          </Link>
        </div>
      </div>
    </>
  );
}
