import type { Metadata } from "next";
import Link from "next/link";
import { safeJsonLd } from "@/lib/json-ld";

export const metadata: Metadata = {
  title:
    "MCP Gateway vs API Gateway: What AI Agents Actually Need | ToolRoute",
  description:
    "API gateways manage REST endpoints. MCP gateways manage AI tool calls. Different problem, different solution. Here is what changed and why it matters.",
  alternates: { canonical: "/blog/mcp-gateway-vs-api-gateway" },
  openGraph: {
    title: "MCP Gateway vs API Gateway: What AI Agents Actually Need",
    description:
      "API gateways route HTTP requests. MCP gateways route tool calls. A side-by-side comparison of what each does and where they diverge.",
    url: "https://toolroute.ai/blog/mcp-gateway-vs-api-gateway",
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
      name: "Can I use Kong or Apigee as an MCP gateway?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Traditional API gateways like Kong and Apigee can proxy MCP traffic at the HTTP level, but they cannot interpret tool schemas, route by capability, meter per-tool usage, or translate between protocols like MCP Streamable HTTP, A2A, and OpenAI function calling. You would need to build all of that logic yourself on top of the gateway.",
      },
    },
    {
      "@type": "Question",
      name: "What is the difference between an API gateway and an MCP gateway?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "An API gateway routes HTTP requests to backend services based on URL paths and methods. An MCP gateway routes AI tool calls to the correct tool adapter based on tool name and operation, handling schema discovery, multi-protocol translation, per-tool billing, and credential management. API gateways think in endpoints; MCP gateways think in capabilities.",
      },
    },
    {
      "@type": "Question",
      name: "Do MCP gateways replace API gateways?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. MCP gateways and API gateways solve different problems. If you are serving a REST API to human-built frontends, you still need an API gateway. If your AI agents need to call external tools through a unified interface, you need an MCP gateway. Some architectures use both: an API gateway for your public API and an MCP gateway for your agent's tool layer.",
      },
    },
    {
      "@type": "Question",
      name: "How does an MCP gateway handle tools that use different protocols?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "An MCP gateway uses dedicated adapters for each tool. When an agent makes a request, the gateway identifies the correct adapter, translates the request into whatever format the upstream tool expects (REST, GraphQL, SDK call, etc.), executes it, and normalizes the response. The agent always sees the same interface regardless of what protocol the tool uses internally.",
      },
    },
    {
      "@type": "Question",
      name: "What protocols can agents use to connect to an MCP gateway?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "ToolRoute supports five inbound protocols: REST API (POST /api/v1/execute), MCP Streamable HTTP (POST /mcp via JSON-RPC), Google A2A (POST /api/a2a), OpenAI-compatible function calling (GET /api/v1/tools?format=openai), and native SDKs. This means any AI framework can connect regardless of which protocol it prefers.",
      },
    },
  ],
};

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "MCP Gateway vs API Gateway: What AI Agents Actually Need",
  description:
    "API gateways manage REST endpoints. MCP gateways manage AI tool calls. A side-by-side comparison with specific examples.",
  datePublished: "2026-04-16T00:00:00Z",
  author: { "@type": "Organization", name: "ToolRoute" },
  publisher: {
    "@type": "Organization",
    name: "ToolRoute",
    url: "https://toolroute.ai",
  },
  mainEntityOfPage:
    "https://toolroute.ai/blog/mcp-gateway-vs-api-gateway",
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
            MCP Gateway vs API Gateway: What AI Agents Actually Need
          </h1>
          <p className="text-text-dim text-sm leading-relaxed mb-4">
            API gateways route HTTP requests to backend services. MCP gateways
            route AI tool calls to the right adapter. They sound similar.
            They solve fundamentally different problems.
          </p>
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <span>April 16, 2026</span>
            <span>9 min read</span>
            <span>ToolRoute Team</span>
          </div>
        </header>

        <div className="prose-custom space-y-8 text-sm leading-relaxed">
          <p>
            If you have built anything with APIs in the last decade, you know
            what an API gateway is. Kong, Apigee, AWS API Gateway, Traefik
            &mdash; these tools sit between clients and backend services,
            handling rate limiting, authentication, routing, and load
            balancing. They are mature, battle-tested infrastructure for
            serving REST and GraphQL APIs to human-built frontends.
          </p>
          <p>
            Then MCP arrived. Anthropic&apos;s Model Context Protocol gave AI
            agents a standardized way to discover and call external tools. The
            ecosystem exploded: thousands of MCP servers, dozens of registries,
            and a new kind of client &mdash; autonomous agents that decide
            which tools to call at runtime based on what they are trying to
            accomplish, not what URL they were hardcoded to hit.
          </p>
          <p>
            This new client broke the assumptions that traditional API gateways
            were built on. The result is a new infrastructure category:{" "}
            <Link
              href="/blog/what-is-an-mcp-gateway"
              className="text-accent hover:underline"
            >
              the MCP gateway
            </Link>
            .
          </p>

          <h2 className="text-xl font-bold pt-4">
            What an API Gateway Does (and Does Well)
          </h2>
          <p>
            A traditional API gateway manages traffic between clients and
            backend services. Its job is straightforward:
          </p>
          <ul className="space-y-1.5 text-text-dim pl-4">
            <li>
              <strong className="text-text">Path-based routing:</strong>{" "}
              <code className="bg-bg-card px-1.5 py-0.5 rounded text-accent text-xs">
                /api/users
              </code>{" "}
              goes to the users service,{" "}
              <code className="bg-bg-card px-1.5 py-0.5 rounded text-accent text-xs">
                /api/orders
              </code>{" "}
              goes to the orders service.
            </li>
            <li>
              <strong className="text-text">Auth enforcement:</strong> Validate
              JWTs, API keys, or OAuth tokens before the request reaches the
              backend.
            </li>
            <li>
              <strong className="text-text">Rate limiting:</strong> Protect
              services from abuse with per-client or per-route limits.
            </li>
            <li>
              <strong className="text-text">Load balancing:</strong> Distribute
              requests across multiple instances of a service.
            </li>
            <li>
              <strong className="text-text">Protocol translation:</strong>{" "}
              Convert between REST and gRPC, or terminate TLS.
            </li>
          </ul>
          <p>
            This works because the client &mdash; a web frontend, a mobile app,
            a third-party integration &mdash; knows exactly which endpoint it
            wants to hit. The developer hardcodes{" "}
            <code className="bg-bg-card px-1.5 py-0.5 rounded text-accent text-xs">
              POST /api/orders
            </code>{" "}
            into the application. The API gateway routes that request. The
            contract is static and known at build time.
          </p>

          <h2 className="text-xl font-bold pt-4">
            What Changes When the Client Is an AI Agent
          </h2>
          <p>
            AI agents do not know which endpoints to call at build time. An
            agent given the task &ldquo;research competitors and email me a
            report&rdquo; needs to dynamically figure out that it should call a
            search tool, then a document generation tool, then an email tool.
            The tool selection happens at runtime based on the agent&apos;s
            reasoning, not a developer&apos;s hardcoded integration.
          </p>
          <p>
            This changes the infrastructure requirements in five specific ways:
          </p>

          <h3 className="text-base font-semibold pt-2">
            1. Routing by Capability, Not by URL Path
          </h3>
          <p>
            An API gateway routes{" "}
            <code className="bg-bg-card px-1.5 py-0.5 rounded text-accent text-xs">
              GET /api/v2/search?q=term
            </code>{" "}
            to a search service. An MCP gateway routes{" "}
            <code className="bg-bg-card px-1.5 py-0.5 rounded text-accent text-xs">
              {`{"tool": "tavily", "operation": "search"}`}
            </code>{" "}
            to a Tavily adapter. The agent does not know or care about Tavily&apos;s
            URL structure, authentication method, or response format. It knows it
            needs a &ldquo;search&rdquo; capability and the gateway resolves the rest.
          </p>

          <h3 className="text-base font-semibold pt-2">
            2. Schema Discovery at Runtime
          </h3>
          <p>
            Traditional API gateways serve OpenAPI specs, but the client still
            needs a developer to read the spec, write the integration, and
            deploy it. MCP gateways serve{" "}
            <code className="bg-bg-card px-1.5 py-0.5 rounded text-accent text-xs">
              tools/list
            </code>{" "}
            responses that agents consume programmatically. The agent reads the
            schema, understands what parameters a tool expects, and calls it
            &mdash; all within a single conversation turn. At ToolRoute, the{" "}
            <Link href="/tools" className="text-accent hover:underline">
              tool catalog
            </Link>{" "}
            serves 87 tools across 14 categories, each with machine-readable
            schemas that agents parse without human intervention.
          </p>

          <h3 className="text-base font-semibold pt-2">
            3. Credential Management Across Dozens of Providers
          </h3>
          <p>
            When a frontend calls your own API, you manage one set of
            credentials. When an agent calls 30 different external tools in a
            single workflow, someone has to manage 30 sets of credentials. An
            API gateway was never designed for this. It authenticates the
            incoming request, not the outgoing ones. An MCP gateway manages
            both: it authenticates the agent (one API key) and then injects
            the correct credentials for each upstream tool.
          </p>

          <h3 className="text-base font-semibold pt-2">
            4. Per-Tool Billing Instead of Per-Request Billing
          </h3>
          <p>
            API gateways bill by request volume or bandwidth. A search API call
            and an email send are the same from a rate-limiting perspective. But
            tools have wildly different costs: a web search might cost $0.001, a
            voice synthesis call might cost $0.05, and an image generation
            might cost $0.10. MCP gateways meter at the tool-and-operation
            level, deducting the right number of credits for each specific call.
          </p>

          <h3 className="text-base font-semibold pt-2">
            5. Multi-Protocol Inbound Translation
          </h3>
          <p>
            An API gateway typically handles one inbound protocol (HTTP) and
            maybe translates to one outbound protocol (gRPC). An MCP gateway
            needs to accept requests from agents that speak different languages.
            Claude uses MCP natively. OpenAI-based agents use function calling.
            Google&apos;s agents use A2A. Custom agents just want REST. The
            gateway translates all of these into a uniform internal execution,
            then translates the response back.
          </p>

          <h2 className="text-xl font-bold pt-4">
            Side-by-Side: API Gateway vs MCP Gateway
          </h2>

          <div className="bg-bg-card border border-border rounded-lg p-6 my-6 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-muted border-b border-border">
                  <th className="text-left pb-3 pr-4">Dimension</th>
                  <th className="text-left pb-3 pr-4">API Gateway</th>
                  <th className="text-left pb-3">MCP Gateway</th>
                </tr>
              </thead>
              <tbody className="text-text-dim">
                <tr className="border-b border-border/50">
                  <td className="py-2.5 pr-4 font-medium text-text">Client</td>
                  <td className="py-2.5 pr-4">Web apps, mobile apps, third-party integrations</td>
                  <td className="py-2.5">AI agents, LLM frameworks, autonomous systems</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2.5 pr-4 font-medium text-text">Routing logic</td>
                  <td className="py-2.5 pr-4">URL path + HTTP method</td>
                  <td className="py-2.5">Tool name + operation</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2.5 pr-4 font-medium text-text">Discovery</td>
                  <td className="py-2.5 pr-4">OpenAPI spec (read by humans)</td>
                  <td className="py-2.5">tools/list schema (read by agents)</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2.5 pr-4 font-medium text-text">Auth model</td>
                  <td className="py-2.5 pr-4">Validates inbound credentials</td>
                  <td className="py-2.5">Validates inbound + injects outbound credentials per tool</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2.5 pr-4 font-medium text-text">Billing</td>
                  <td className="py-2.5 pr-4">Per-request or bandwidth</td>
                  <td className="py-2.5">Per-tool, per-operation credits</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2.5 pr-4 font-medium text-text">Inbound protocols</td>
                  <td className="py-2.5 pr-4">HTTP (REST, GraphQL)</td>
                  <td className="py-2.5">REST, MCP Streamable HTTP, A2A, OpenAI Functions, SDKs</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2.5 pr-4 font-medium text-text">Upstream integration</td>
                  <td className="py-2.5 pr-4">Proxy to your own services</td>
                  <td className="py-2.5">Adapters for third-party tools (search, email, voice, data, etc.)</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2.5 pr-4 font-medium text-text">Rate limiting</td>
                  <td className="py-2.5 pr-4">Per-client or per-route</td>
                  <td className="py-2.5">Per-tool + credit-based throttling</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 font-medium text-text">Examples</td>
                  <td className="py-2.5 pr-4">Kong, Apigee, AWS API Gateway, Traefik</td>
                  <td className="py-2.5">ToolRoute, Cloudflare AI Gateway (partial)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 className="text-xl font-bold pt-4">
            What They Have in Common
          </h2>
          <p>
            MCP gateways and API gateways are not opposites. They share core
            infrastructure patterns:
          </p>
          <ul className="space-y-1.5 text-text-dim pl-4">
            <li>
              <strong className="text-text">Single entry point:</strong> Both
              consolidate access through one endpoint instead of letting clients
              talk directly to every backend.
            </li>
            <li>
              <strong className="text-text">Authentication layer:</strong> Both
              verify that the caller has permission before forwarding the
              request.
            </li>
            <li>
              <strong className="text-text">Logging and observability:</strong>{" "}
              Both record what happened &mdash; which request, which backend,
              how long, whether it succeeded.
            </li>
            <li>
              <strong className="text-text">Error normalization:</strong> Both
              translate varied backend error formats into something consistent
              for the client.
            </li>
            <li>
              <strong className="text-text">Abuse protection:</strong> Both
              throttle or block excessive usage to protect upstream services.
            </li>
          </ul>
          <p>
            If you understand API gateways, you already understand 60% of an
            MCP gateway. The remaining 40% is what makes them a distinct
            category.
          </p>

          <h2 className="text-xl font-bold pt-4">
            A Concrete Example: The Same Workflow Through Each Gateway
          </h2>
          <p>
            Suppose an agent needs to search the web for &ldquo;MCP security
            best practices,&rdquo; summarize the results, and email the summary
            to a user.
          </p>

          <div className="bg-bg-card border border-border rounded-lg p-6 my-6 space-y-4">
            <div>
              <h3 className="font-semibold mb-2 text-accent text-xs uppercase tracking-wide">
                Through an API Gateway (Kong / Apigee)
              </h3>
              <ol className="space-y-1.5 text-text-dim text-xs list-decimal pl-4">
                <li>Developer signs up for Tavily, gets an API key, stores it in the agent config.</li>
                <li>Developer signs up for Resend, gets an API key, stores it separately.</li>
                <li>Developer writes a Tavily integration: specific URL, specific headers, specific response parsing.</li>
                <li>Developer writes a Resend integration: different URL, different headers, different response format.</li>
                <li>Developer configures Kong routes for both, sets rate limits per route.</li>
                <li>Agent calls <code className="bg-bg-surface px-1 py-0.5 rounded">POST /api/tavily/search</code> and <code className="bg-bg-surface px-1 py-0.5 rounded">POST /api/resend/send</code> with separate auth headers (Resend is a Class-A provider — BYOK required either way).</li>
                <li>Developer maintains both integrations as APIs change.</li>
              </ol>
            </div>
            <div className="border-t border-border pt-4">
              <h3 className="font-semibold mb-2 text-accent text-xs uppercase tracking-wide">
                Through an MCP Gateway (ToolRoute)
              </h3>
              <ol className="space-y-1.5 text-text-dim text-xs list-decimal pl-4">
                <li>Developer gets one ToolRoute API key.</li>
                <li>Agent calls <code className="bg-bg-surface px-1 py-0.5 rounded">{`POST /api/v1/execute {tool: "tavily", operation: "search"}`}</code>.</li>
                <li>Agent calls <code className="bg-bg-surface px-1 py-0.5 rounded">{`POST /api/v1/execute {tool: "resend", operation: "send_email"}`}</code>.</li>
                <li>Gateway handles both upstream integrations. Agent sees identical response shapes.</li>
              </ol>
            </div>
          </div>

          <p>
            Seven steps collapsed to four. Two API keys collapsed to one. Two
            integration formats collapsed to zero custom code. And if you swap
            Tavily for Exa or Resend for SendGrid, the agent&apos;s code does
            not change &mdash; only the gateway&apos;s adapter config does.
          </p>

          <h2 className="text-xl font-bold pt-4">
            Why You Cannot Just &ldquo;Put Kong in Front of MCP&rdquo;
          </h2>
          <p>
            A reasonable question: can you configure Kong or Apigee to proxy
            MCP traffic and get the same result? Technically, you can proxy the
            HTTP layer. But you lose everything that makes an MCP gateway
            useful:
          </p>
          <ul className="space-y-1.5 text-text-dim pl-4">
            <li>
              <strong className="text-text">No schema awareness.</strong> Kong
              does not know that the incoming JSON contains a tool name and
              operation. It cannot validate that the agent is calling a real
              tool with valid parameters.
            </li>
            <li>
              <strong className="text-text">No credential injection.</strong>{" "}
              Kong validates inbound auth but cannot inject different outbound
              credentials per tool. You would build that yourself.
            </li>
            <li>
              <strong className="text-text">No per-tool metering.</strong> Kong
              counts requests. It cannot deduct 2 credits for a search and 10
              credits for a voice synthesis from the same prepaid balance.
            </li>
            <li>
              <strong className="text-text">No protocol translation.</strong>{" "}
              Kong will not translate an MCP JSON-RPC{" "}
              <code className="bg-bg-card px-1.5 py-0.5 rounded text-accent text-xs">
                tools/call
              </code>{" "}
              request into an OpenAI function calling format or a Google A2A
              task. An MCP gateway handles five inbound protocols natively.
            </li>
            <li>
              <strong className="text-text">No tool catalog.</strong> Kong does
              not serve a{" "}
              <code className="bg-bg-card px-1.5 py-0.5 rounded text-accent text-xs">
                tools/list
              </code>{" "}
              response. Agents have no way to discover what is available.
            </li>
          </ul>
          <p>
            You could build all of this as custom Kong plugins. At that point,
            you have built an MCP gateway &mdash; you just started with Kong
            as the HTTP layer.
          </p>

          <h2 className="text-xl font-bold pt-4">
            When You Need Both
          </h2>
          <p>
            Most production AI applications will use both types of gateway in
            their architecture:
          </p>
          <div className="bg-bg-card border border-border rounded-lg p-6 my-6">
            <ul className="space-y-2 text-text-dim text-xs">
              <li>
                <strong className="text-text">API gateway</strong> sits in front
                of your own services: user auth, data APIs, webhooks, admin
                endpoints. It protects your backend from the internet.
              </li>
              <li>
                <strong className="text-text">MCP gateway</strong> sits between
                your agents and external tools. It gives your AI layer access to{" "}
                <Link href="/tools" className="text-accent hover:underline">
                  87 tools across 14 categories
                </Link>{" "}
                through one key and one interface.
              </li>
            </ul>
            <p className="text-text-muted text-xs mt-4">
              They operate at different layers of your stack. The API gateway
              manages your API. The MCP gateway manages your agent&apos;s
              toolbox.
            </p>
          </div>

          <h2 className="text-xl font-bold pt-4">
            How ToolRoute Implements This
          </h2>
          <p>
            ToolRoute is an MCP gateway. It exposes{" "}
            <Link href="/tools" className="text-accent hover:underline">
              87 tools across 14 categories
            </Link>{" "}
            through five inbound protocols:
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
            <li>
              <strong className="text-text">SDKs:</strong> Python and TypeScript
              client libraries
            </li>
          </ul>
          <p>
            Each tool has a dedicated adapter. The adapter handles the
            upstream tool&apos;s specific API contract: authentication format,
            request shape, response parsing, error codes. When you call{" "}
            <code className="bg-bg-card px-1.5 py-0.5 rounded text-accent text-xs">
              {`{"tool": "firecrawl", "operation": "scrape"}`}
            </code>
            , the gateway resolves the Firecrawl adapter, injects the Firecrawl
            API key, transforms your input, makes the upstream call, normalizes
            the response, deducts credits, and returns a standard JSON
            envelope. Your agent never touches the Firecrawl API directly.
          </p>
          <p>
            Billing is credit-based with per-tool pricing. A web search
            costs different credits than a voice synthesis call. Users who
            already have their own API keys for specific tools can use{" "}
            <strong>BYOK</strong> (bring-your-own-key) to skip the credit
            charge for those tools.{" "}
            <Link href="/pricing" className="text-accent hover:underline">
              See pricing details
            </Link>
            .
          </p>

          <h2 className="text-xl font-bold pt-4">
            The Bottom Line
          </h2>
          <p>
            API gateways were designed for a world where developers write
            integrations and frontends make predictable HTTP calls. MCP
            gateways are designed for a world where AI agents pick their own
            tools at runtime and need a unified interface to call any of them.
          </p>
          <p>
            They share infrastructure DNA &mdash; single entry point, auth
            enforcement, rate limiting, logging. But MCP gateways add
            capability-based routing, schema discovery, credential injection,
            per-tool billing, and multi-protocol translation that traditional
            API gateways were never built to handle.
          </p>
          <p>
            Different problem. Different solution. If you are building AI
            agents that need external tools, you need an MCP gateway.
          </p>

          <h2 className="text-xl font-bold pt-4">
            Frequently Asked Questions
          </h2>

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-sm">
                Can I use Kong or Apigee as an MCP gateway?
              </h3>
              <p className="text-text-dim mt-1">
                They can proxy MCP traffic at the HTTP level, but they cannot
                interpret tool schemas, route by capability, meter per-tool
                usage, or translate between protocols like MCP Streamable HTTP,
                A2A, and OpenAI function calling. You would need to build all of
                that logic yourself on top of the gateway.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                What is the difference between an API gateway and an MCP
                gateway?
              </h3>
              <p className="text-text-dim mt-1">
                An API gateway routes HTTP requests to backend services based on
                URL paths and methods. An MCP gateway routes AI tool calls to
                the correct adapter based on tool name and operation, handling
                schema discovery, multi-protocol translation, per-tool billing,
                and credential management. API gateways think in endpoints; MCP
                gateways think in capabilities.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                Do MCP gateways replace API gateways?
              </h3>
              <p className="text-text-dim mt-1">
                No. They solve different problems. API gateways protect your
                backend services from the internet. MCP gateways give your AI
                agents access to external tools. Most production architectures
                will use both.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                How does an MCP gateway handle tools that use different
                protocols?
              </h3>
              <p className="text-text-dim mt-1">
                Through dedicated adapters. Each tool gets an adapter that knows
                the upstream tool&apos;s API contract. The gateway translates
                the agent&apos;s standard request into whatever the tool
                expects, executes it, and normalizes the response. The agent
                always sees the same interface.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                What protocols can agents use to connect to an MCP gateway?
              </h3>
              <p className="text-text-dim mt-1">
                ToolRoute supports five: REST API, MCP Streamable HTTP
                (JSON-RPC), Google A2A, OpenAI-compatible function calling,
                and native SDKs. Any AI framework can connect regardless of
                which protocol it prefers.
              </p>
            </div>
          </div>

          <div className="border-t border-border pt-8 mt-8">
            <h3 className="font-semibold text-sm mb-4">Related Articles</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/blog/what-is-an-mcp-gateway" className="text-accent hover:underline">What Is an MCP Gateway? The Infrastructure Layer AI Agents Need</Link></li>
              <li><Link href="/blog/use-mcp-tools-without-managing-servers" className="text-accent hover:underline">How to Use MCP Tools Without Managing Servers</Link></li>
              <li><Link href="/blog/build-ai-agent-multiple-tools" className="text-accent hover:underline">How to Build an AI Agent With Multiple Tools</Link></li>
            </ul>
          </div>

          <div className="border-t border-border pt-8 mt-8">
            <p className="text-text-dim">
              ToolRoute is an MCP gateway. One API key,{" "}
              <Link href="/tools" className="text-accent hover:underline">
                87 tools
              </Link>
              , five protocols.{" "}
              <Link href="/docs" className="text-accent hover:underline">
                Read the docs
              </Link>{" "}
              or{" "}
              <Link href="/pricing" className="text-accent hover:underline">
                see pricing
              </Link>
              .
            </p>
          </div>
        </div>
      </article>
    </>
  );
}
