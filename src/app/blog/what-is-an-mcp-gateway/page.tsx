import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "What Is an MCP Gateway? The Infrastructure Layer AI Agents Need",
  description:
    "MCP registries list tools. MCP gateways execute them. Learn how gateways handle authentication, billing, and routing so your agents can call any tool through one API.",
  alternates: { canonical: "/blog/what-is-an-mcp-gateway" },
  openGraph: {
    title: "What Is an MCP Gateway?",
    description:
      "MCP registries list tools. MCP gateways execute them. Learn the difference and why it matters.",
    url: "https://toolroute.ai/blog/what-is-an-mcp-gateway",
    type: "article",
    publishedTime: "2026-04-16T00:00:00Z",
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is an MCP gateway?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "An MCP gateway is an infrastructure layer that sits between AI agents and MCP-compatible tools. Unlike a registry which only lists tools, a gateway handles execution, authentication, billing, and routing. Agents send requests to one endpoint and the gateway routes them to the correct tool, manages API keys, and tracks usage.",
      },
    },
    {
      "@type": "Question",
      name: "What is the difference between an MCP registry and an MCP gateway?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "An MCP registry is a directory that helps you discover tools (like a phone book). An MCP gateway is an execution layer that lets you use tools through a unified API (like a switchboard). Registries answer 'what tools exist?' while gateways answer 'how do I call this tool right now?'",
      },
    },
    {
      "@type": "Question",
      name: "Why do AI agents need an MCP gateway?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Without a gateway, every AI agent needs separate API keys, authentication flows, and error handling for each tool it uses. An MCP gateway consolidates this into one API key and one endpoint. This is especially important at scale when agents use dozens of tools across categories like search, email, voice, and data.",
      },
    },
    {
      "@type": "Question",
      name: "How does an MCP gateway handle billing?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "MCP gateways typically use a credits-based model. Users purchase credits upfront, and each tool execution deducts credits based on the underlying tool's cost. This means agents don't need individual billing accounts with every tool provider. Some gateways also support bring-your-own-key (BYOK) for tools where users already have accounts.",
      },
    },
    {
      "@type": "Question",
      name: "What protocols does an MCP gateway support?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A well-built MCP gateway supports multiple protocols: REST API for direct HTTP calls, MCP Streamable HTTP for native Model Context Protocol clients, A2A (Agent-to-Agent) for Google's protocol, and OpenAI-compatible function calling format. This lets any AI framework connect regardless of which protocol it speaks.",
      },
    },
  ],
};

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "What Is an MCP Gateway? The Infrastructure Layer AI Agents Need",
  description:
    "MCP registries list tools. MCP gateways execute them. Learn how gateways handle authentication, billing, and routing.",
  datePublished: "2026-04-16T00:00:00Z",
  author: { "@type": "Organization", name: "ToolRoute" },
  publisher: {
    "@type": "Organization",
    name: "ToolRoute",
    url: "https://toolroute.ai",
  },
  mainEntityOfPage: "https://toolroute.ai/blog/what-is-an-mcp-gateway",
};

export default function Article() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <article className="max-w-3xl mx-auto">
        <header className="mb-12">
          <p className="text-accent text-xs font-medium mb-4">
            Infrastructure
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">
            What Is an MCP Gateway? The Infrastructure Layer AI Agents Need
          </h1>
          <p className="text-text-dim text-sm leading-relaxed mb-4">
            MCP registries list tools. MCP gateways execute them. Here is the
            difference and why it matters for anyone building with AI agents.
          </p>
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <span>April 16, 2026</span>
            <span>8 min read</span>
            <span>ToolRoute Team</span>
          </div>
        </header>

        <div className="prose-custom space-y-8 text-sm leading-relaxed">
          <p>
            The Model Context Protocol (MCP) gave AI agents a standard way to
            discover and call external tools. Within a year of its release,
            thousands of MCP servers appeared: databases, search engines, email
            APIs, voice platforms, payment processors. The discovery problem was
            solved. But a new problem emerged.
          </p>
          <p>
            Every tool still required its own API key, its own authentication
            flow, its own error format, and its own billing account. An agent
            that needed to search the web, send an email, and process a payment
            had to manage three separate integrations. Scale that to 50 tools and
            the integration burden becomes the bottleneck, not the AI model
            itself.
          </p>
          <p>
            This is the problem an MCP gateway solves.
          </p>

          <h2 className="text-xl font-bold pt-4">
            MCP Gateway vs. MCP Registry: The Core Difference
          </h2>
          <p>
            An <strong>MCP registry</strong> is a directory. It answers the
            question:{" "}
            <em>what tools exist?</em> The{" "}
            <Link
              href="https://registry.modelcontextprotocol.io/"
              className="text-accent hover:underline"
              target="_blank"
              rel="noopener"
            >
              official MCP Registry
            </Link>
            , Glama, mcpservers.org, and PulseMCP are all registries. They list
            servers, describe capabilities, and help developers find what they
            need. Think of them as a phone book.
          </p>
          <p>
            An <strong>MCP gateway</strong> is an execution layer. It answers the
            question: <em>how do I call this tool right now, through one API?</em>{" "}
            A gateway sits between your agent and the underlying tools. It
            handles authentication, routes requests, normalizes responses, meters
            usage, and bills through a single account. Think of it as a
            switchboard.
          </p>

          <div className="bg-bg-card border border-border rounded-lg p-6 my-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-2 text-accent">
                  Registry (Phone Book)
                </h3>
                <ul className="space-y-1.5 text-text-dim text-xs">
                  <li>Lists available tools</li>
                  <li>Describes capabilities and protocols</li>
                  <li>Helps with discovery</li>
                  <li>You still manage each tool separately</li>
                  <li>
                    <em>Examples: Official MCP Registry, Glama, mcpservers.org</em>
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2 text-accent">
                  Gateway (Switchboard)
                </h3>
                <ul className="space-y-1.5 text-text-dim text-xs">
                  <li>Executes tool calls through one API</li>
                  <li>Manages API keys and auth for you</li>
                  <li>Normalizes response formats</li>
                  <li>Meters usage and handles billing</li>
                  <li>
                    <em>Examples: ToolRoute, Kong MCP Gateway</em>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <p>
            The analogy to LLMs is direct.{" "}
            <Link
              href="https://openrouter.ai"
              className="text-accent hover:underline"
              target="_blank"
              rel="noopener"
            >
              OpenRouter
            </Link>{" "}
            solved this exact problem for language models: instead of managing
            separate accounts with OpenAI, Anthropic, Google, and Meta, you get
            one API key that routes to any model. An MCP gateway does the same
            thing for tools.
          </p>

          <h2 className="text-xl font-bold pt-4">
            What an MCP Gateway Actually Does
          </h2>
          <p>
            Behind a single{" "}
            <code className="bg-bg-card px-1.5 py-0.5 rounded text-accent text-xs">
              POST /api/v1/execute
            </code>{" "}
            endpoint, a gateway handles five layers of complexity:
          </p>

          <h3 className="text-base font-semibold pt-2">
            1. Unified Authentication
          </h3>
          <p>
            Each underlying tool has its own auth mechanism: API keys, OAuth
            tokens, JWT signatures, basic auth. The gateway stores and manages
            all of these. Your agent authenticates once with a gateway API key.
            The gateway translates that into whatever each tool requires.
          </p>

          <h3 className="text-base font-semibold pt-2">
            2. Request Routing
          </h3>
          <p>
            When your agent calls{" "}
            <code className="bg-bg-card px-1.5 py-0.5 rounded text-accent text-xs">
              {`{"tool": "tavily", "operation": "search", "input": {"query": "MCP security best practices"}}`}
            </code>
            , the gateway resolves which adapter to use, transforms the input to
            Tavily&apos;s expected format, makes the upstream call, and normalizes
            the response back to a standard shape. The agent never touches
            Tavily&apos;s API directly.
          </p>

          <h3 className="text-base font-semibold pt-2">
            3. Multi-Protocol Support
          </h3>
          <p>
            Not every AI framework speaks MCP. Some use OpenAI function calling,
            some use Google&apos;s A2A protocol, some just want REST. A gateway
            exposes the same tools through multiple protocols:
          </p>
          <ul className="space-y-1.5 text-text-dim pl-4">
            <li>
              <strong className="text-text">REST:</strong>{" "}
              <code className="bg-bg-card px-1.5 py-0.5 rounded text-xs">
                POST /api/v1/execute
              </code>
            </li>
            <li>
              <strong className="text-text">MCP Streamable HTTP:</strong>{" "}
              <code className="bg-bg-card px-1.5 py-0.5 rounded text-xs">
                POST /mcp
              </code>{" "}
              (JSON-RPC)
            </li>
            <li>
              <strong className="text-text">A2A:</strong>{" "}
              <code className="bg-bg-card px-1.5 py-0.5 rounded text-xs">
                POST /api/a2a
              </code>{" "}
              (Google Agent-to-Agent)
            </li>
            <li>
              <strong className="text-text">OpenAI Functions:</strong>{" "}
              <code className="bg-bg-card px-1.5 py-0.5 rounded text-xs">
                GET /api/v1/tools?format=openai
              </code>
            </li>
          </ul>

          <h3 className="text-base font-semibold pt-2">
            4. Usage Metering and Billing
          </h3>
          <p>
            A gateway tracks every execution: which tool, which operation, how
            long it took, whether it succeeded. It deducts credits from a
            prepaid balance. This eliminates the need for separate billing
            accounts with every tool provider. For tools where the user already
            has an account, gateways support <strong>BYOK</strong>{" "}
            (bring-your-own-key) so the user can supply their existing API key and
            skip the credit charge.
          </p>

          <h3 className="text-base font-semibold pt-2">
            5. Reliability and Error Normalization
          </h3>
          <p>
            Every tool returns errors differently. Some return HTTP 500 with a
            JSON body, some return 200 with an error field, some timeout silently.
            A gateway normalizes all of this into a consistent error format with
            status codes, error types, and actionable messages.
          </p>

          <h2 className="text-xl font-bold pt-4">
            The Scale Problem MCP Gateways Solve
          </h2>
          <p>
            Consider a real-world AI agent that handles business operations. In a
            single workflow it might need to:
          </p>
          <ol className="space-y-1.5 text-text-dim pl-4 list-decimal">
            <li>Search the web for competitor pricing (Tavily)</li>
            <li>Generate a comparison chart (Claude API)</li>
            <li>Send the report via email (Resend)</li>
            <li>Post a summary to Slack (Slack API)</li>
            <li>Log the activity to a database (Supabase)</li>
          </ol>
          <p>
            Without a gateway, that agent needs five API keys, five
            authentication flows, five error handling patterns, and five billing
            accounts. With a gateway, it needs one API key and one endpoint. The
            operational savings compound as the number of tools grows.
          </p>
          <p>
            At ToolRoute, we currently route to{" "}
            <Link href="/tools" className="text-accent hover:underline">
              87 tools across 14 categories
            </Link>
            . Each tool has a dedicated adapter that handles its specific API
            contract. Agents interact with a uniform interface regardless of
            whether the underlying tool is a REST API, an MCP server, or an SDK.
          </p>

          <h2 className="text-xl font-bold pt-4">
            When You Need a Gateway vs. When a Registry Is Enough
          </h2>
          <div className="bg-bg-card border border-border rounded-lg p-6 my-6">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-muted border-b border-border">
                  <th className="text-left pb-2 pr-4">Scenario</th>
                  <th className="text-left pb-2 pr-4">Registry</th>
                  <th className="text-left pb-2">Gateway</th>
                </tr>
              </thead>
              <tbody className="text-text-dim">
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Exploring what tools exist</td>
                  <td className="py-2 pr-4 text-green">Sufficient</td>
                  <td className="py-2">Overkill</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Agent uses 1-2 tools</td>
                  <td className="py-2 pr-4 text-green">Sufficient</td>
                  <td className="py-2">Optional</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Agent uses 5+ tools in production</td>
                  <td className="py-2 pr-4">Not enough</td>
                  <td className="py-2 text-green">Required</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Multi-tenant SaaS with agent features</td>
                  <td className="py-2 pr-4">Not enough</td>
                  <td className="py-2 text-green">Required</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Need unified billing across tools</td>
                  <td className="py-2 pr-4">Not possible</td>
                  <td className="py-2 text-green">Core feature</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 className="text-xl font-bold pt-4">
            Frequently Asked Questions
          </h2>

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-sm">
                What is an MCP gateway?
              </h3>
              <p className="text-text-dim mt-1">
                An MCP gateway is an infrastructure layer that sits between AI
                agents and MCP-compatible tools. Unlike a registry which only
                lists tools, a gateway handles execution, authentication,
                billing, and routing. Agents send requests to one endpoint and
                the gateway routes them to the correct tool, manages API keys,
                and tracks usage.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                What is the difference between an MCP registry and an MCP
                gateway?
              </h3>
              <p className="text-text-dim mt-1">
                An MCP registry is a directory that helps you discover tools
                (like a phone book). An MCP gateway is an execution layer that
                lets you use tools through a unified API (like a switchboard).
                Registries answer &quot;what tools exist?&quot; while gateways
                answer &quot;how do I call this tool right now?&quot;
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                Why do AI agents need an MCP gateway?
              </h3>
              <p className="text-text-dim mt-1">
                Without a gateway, every AI agent needs separate API keys,
                authentication flows, and error handling for each tool. A gateway
                consolidates this into one API key and one endpoint. This is
                critical at scale when agents use dozens of tools across search,
                email, voice, and data categories.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                How does an MCP gateway handle billing?
              </h3>
              <p className="text-text-dim mt-1">
                MCP gateways use a credits-based model. Users purchase credits
                upfront, and each tool execution deducts credits based on the
                underlying tool&apos;s cost. Agents do not need individual billing
                accounts with each provider. Gateways also support BYOK
                (bring-your-own-key) for users who already have accounts with
                specific tool providers.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                What protocols does an MCP gateway support?
              </h3>
              <p className="text-text-dim mt-1">
                A well-built MCP gateway supports multiple protocols: REST for
                direct HTTP calls, MCP Streamable HTTP (JSON-RPC) for native MCP
                clients, A2A for Google&apos;s Agent-to-Agent protocol, and
                OpenAI-compatible function calling. This lets any AI framework
                connect regardless of which protocol it uses.
              </p>
            </div>
          </div>

          <div className="border-t border-border pt-8 mt-8">
            <p className="text-text-dim">
              ToolRoute is an MCP gateway. One API key, 87 tools, five
              protocols.{" "}
              <Link href="/docs" className="text-accent hover:underline">
                Read the docs
              </Link>{" "}
              or{" "}
              <Link href="/playground" className="text-accent hover:underline">
                try the playground
              </Link>
              .
            </p>
          </div>
        </div>
      </article>
    </>
  );
}
