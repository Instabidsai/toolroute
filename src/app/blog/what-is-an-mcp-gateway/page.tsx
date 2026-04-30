import type { Metadata } from "next";
import Link from "next/link";
import { safeJsonLd } from "@/lib/json-ld";

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
    modifiedTime: "2026-04-15T00:00:00Z",
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
  dateModified: "2026-04-15T00:00:00Z",
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
        dangerouslySetInnerHTML={{ __html: safeJsonLd(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(articleSchema) }}
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
            The{" "}
            <Link
              href="/blog/what-is-model-context-protocol"
              className="text-accent hover:underline"
            >
              Model Context Protocol (MCP)
            </Link>{" "}
            gave AI agents a standard way to discover and call external tools.
            Within a year of its release, thousands of MCP servers appeared:
            databases, search engines, email APIs, voice platforms, payment
            processors. The discovery problem was solved. But a new problem
            emerged.
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
            thing for tools. We call this pattern{" "}
            <Link
              href="/blog/openrouter-for-tools"
              className="text-accent hover:underline"
            >
              OpenRouter for tools
            </Link>
            , and it is the reason ToolRoute exists.
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
              {`{"tool": "tavily/search", "input": {"query": "MCP security best practices"}}`}
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
            A Brief History of MCP
          </h2>
          <p>
            Anthropic released the Model Context Protocol in November 2024 as an
            open standard for connecting AI assistants to external systems. The
            goal was to solve what integration engineers call the{" "}
            <em>M &times; N problem</em>: if you have M AI applications and N
            tools, you need M &times; N custom integrations. Every new model or
            tool multiplies the integration surface. MCP turned that into
            M + N by defining a single wire protocol both sides could speak.
          </p>
          <p>
            Within weeks of the spec going public, the ecosystem exploded.
            Official servers for Google Drive, Slack, GitHub, and Postgres
            shipped first. Community developers followed with servers for every
            conceivable SaaS: Stripe, Linear, Notion, Figma, Supabase, Vercel.
            By mid-2025 public registries tracked more than 3,000 MCP servers,
            and by the time you are reading this that number is well past five
            figures.
          </p>
          <p>
            Growth exposed the next problem. Running and trusting thousands of
            independent servers is operationally brutal. Teams began asking a
            different question: <em>how do we consume MCP without standing up a
            server for every tool?</em> That is when MCP gateways emerged.
            Gateways take the protocol&apos;s promise of universal connectivity
            and add the operational layer the spec deliberately left out:
            identity, billing, governance, and reliability. For a deeper look at
            how gateways compare to other well-known patterns, see{" "}
            <Link
              href="/blog/mcp-gateway-vs-api-gateway"
              className="text-accent hover:underline"
            >
              MCP gateway vs. API gateway
            </Link>{" "}
            and{" "}
            <Link
              href="/blog/mcp-vs-rest-api-ai-agents"
              className="text-accent hover:underline"
            >
              MCP vs. REST APIs for AI agents
            </Link>
            .
          </p>

          <h2 className="text-xl font-bold pt-4">
            Shadow MCP: The Sprawl Problem Gateways Solve
          </h2>
          <p>
            Every enterprise that lived through the SaaS boom remembers{" "}
            <em>shadow IT</em>: marketing spinning up its own analytics tool,
            sales signing a contract for a CRM nobody else knew about, finance
            discovering five redundant expense trackers on the credit card
            statement. MCP is now generating its own version. We call it{" "}
            <strong>shadow MCP</strong>.
          </p>
          <p>
            The pattern is familiar. An engineer reads about a cool MCP server
            on a directory site, runs{" "}
            <code className="bg-bg-card px-1.5 py-0.5 rounded text-accent text-xs">
              npx
            </code>{" "}
            to install it, pastes a production API key into a local config file,
            and wires it into a side-project agent. Nothing about that flow
            touches security review, procurement, or the CISO&apos;s inventory.
            Multiply it by a 200-person engineering org and the blast radius is
            enormous.
          </p>
          <p>
            Three specific risks compound fast. First, <strong>credential
            sprawl</strong>: the same OpenAI or Stripe key ends up pasted into a
            dozen unaudited processes running on laptops, containers, and
            forgotten servers. Second, <strong>unvetted code execution</strong>:
            most MCP servers are npm or PyPI packages, and installing one grants
            arbitrary code the right to read environment variables, make
            outbound network calls, and touch the filesystem. Third,{" "}
            <strong>attack-surface expansion</strong>: every shadow server is a
            new process listening on a port or stdin, usually with no rate
            limits, auth, or logging.
          </p>
          <p>
            A gateway collapses all of that into one controlled plane. Instead
            of N servers running in N environments, there is one endpoint, one
            identity model, one audit trail. Tools are{" "}
            <Link
              href="/blog/best-mcp-servers-ai-agents-2026"
              className="text-accent hover:underline"
            >
              vetted before they are routable
            </Link>
            , credentials live in a managed vault, and every call is attributed
            to a specific agent, user, and request. For a deeper treatment of
            the attack surface and how to retire shadow servers, see{" "}
            <Link
              href="/blog/shadow-mcp-risks"
              className="text-accent hover:underline"
            >
              Shadow MCP risks and how to eliminate them
            </Link>
            . If you are still choosing transports,{" "}
            <Link
              href="/blog/mcp-stdio-vs-http-hub"
              className="text-accent hover:underline"
            >
              stdio vs. HTTP hub
            </Link>{" "}
            explains why centralized HTTP is the right default for shared
            infrastructure.
          </p>

          <h2 className="text-xl font-bold pt-4">
            MCP Gateway Compliance and Governance
          </h2>
          <p>
            Once a gateway sits in front of every tool call, it becomes the
            natural place to enforce the controls auditors, enterprise buyers,
            and regulated customers ask about. The registry layer cannot do
            this; only the execution layer can. That is why mature MCP gateways
            ship with compliance primitives baked in rather than bolted on.
          </p>
          <p>
            <strong>Audit logging</strong> is the foundation. Every request
            should be written to an append-only log with request ID, caller
            identity, tool and operation invoked, input hash, output hash,
            latency, outcome, and timestamp. Logs need to be immutable, exportable
            to a SIEM, and retained for the window your framework requires
            (typically one year for SOC 2, three years for HIPAA-adjacent
            work). Without this, there is no way to reconstruct what an agent
            did during an incident.
          </p>
          <p>
            <strong>Access control</strong> happens at two layers. Role-based
            access control gates which human users and service accounts can
            mint API keys, register BYOK credentials, or change billing
            settings. Tool-scoped access control gates which tools a given key
            can call. A support-bot key should not be able to invoke payment or
            infrastructure tools just because the credit balance is high
            enough. Scopes travel with the key and are enforced at the gateway
            before the request ever reaches an adapter.
          </p>
          <p>
            <strong>Framework mapping</strong> is what turns those primitives
            into audit evidence. SOC 2 Common Criteria (CC6.1, CC6.6, CC7.2)
            map directly onto gateway features: identity, least privilege,
            monitoring, and change management. ISO 27001 Annex A controls
            A.9 (access control), A.12.4 (logging), and A.14.2 (secure
            development) are satisfied by the same underlying data. A good
            gateway exports logs and configuration snapshots in a format
            auditors can consume without a custom integration. For the full
            mapping and the evidence artifacts auditors expect, see{" "}
            <Link
              href="/blog/mcp-governance-soc2-compliance"
              className="text-accent hover:underline"
            >
              MCP governance and SOC 2 compliance
            </Link>
            . For hardening the servers behind the gateway, see{" "}
            <Link
              href="/blog/mcp-server-security-best-practices"
              className="text-accent hover:underline"
            >
              MCP server security best practices
            </Link>
            . Definitions for every term in this section live in the{" "}
            <Link href="/glossary" className="text-accent hover:underline">
              MCP glossary
            </Link>
            , and common compliance questions are answered on the{" "}
            <Link href="/faq" className="text-accent hover:underline">
              FAQ
            </Link>
            .
          </p>

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
            <h3 className="font-semibold text-sm mb-4">Related Articles</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/blog/mcp-gateway-vs-api-gateway" className="text-accent hover:underline">MCP Gateway vs API Gateway: What AI Agents Actually Need</Link></li>
              <li><Link href="/blog/mcp-vs-rest-api-ai-agents" className="text-accent hover:underline">MCP vs REST APIs: Which Should Your AI Agent Speak?</Link></li>
              <li><Link href="/blog/what-is-model-context-protocol" className="text-accent hover:underline">What Is the Model Context Protocol? A Plain-English Guide</Link></li>
              <li><Link href="/blog/openrouter-for-tools" className="text-accent hover:underline">OpenRouter for Tools: One API Key for Every MCP Server</Link></li>
              <li><Link href="/blog/best-mcp-servers-ai-agents-2026" className="text-accent hover:underline">The Best MCP Servers for AI Agents in 2026</Link></li>
              <li><Link href="/blog/use-mcp-tools-without-managing-servers" className="text-accent hover:underline">How to Use MCP Tools Without Managing Servers</Link></li>
              <li><Link href="/blog/build-ai-agent-multiple-tools" className="text-accent hover:underline">How to Build an AI Agent With Multiple Tools</Link></li>
              <li><Link href="/blog/mcp-stdio-vs-http-hub" className="text-accent hover:underline">MCP stdio vs HTTP Hub: Which Transport to Use</Link></li>
              <li><Link href="/blog/shadow-mcp-risks" className="text-accent hover:underline">Shadow MCP Risks and How to Eliminate Them</Link></li>
              <li><Link href="/blog/mcp-server-security-best-practices" className="text-accent hover:underline">MCP Server Security Best Practices</Link></li>
              <li><Link href="/blog/mcp-governance-soc2-compliance" className="text-accent hover:underline">MCP Governance and SOC 2 Compliance</Link></li>
              <li><Link href="/glossary" className="text-accent hover:underline">MCP Glossary</Link></li>
              <li><Link href="/faq" className="text-accent hover:underline">MCP Gateway FAQ</Link></li>
            </ul>
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
