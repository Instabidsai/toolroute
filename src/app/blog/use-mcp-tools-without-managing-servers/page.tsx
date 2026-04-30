import type { Metadata } from "next";
import Link from "next/link";
import { safeJsonLd } from "@/lib/json-ld";

export const metadata: Metadata = {
  title: "How to Use MCP Tools Without Managing Servers",
  description:
    "Skip the server setup. Learn how unified tool APIs let AI agents execute MCP tools through a single endpoint with one API key, prepaid credits, and zero infrastructure.",
  alternates: { canonical: "/blog/use-mcp-tools-without-managing-servers" },
  openGraph: {
    title: "How to Use MCP Tools Without Managing Servers",
    description:
      "One API key. One endpoint. Zero server management. Here is how.",
    url: "https://toolroute.ai/blog/use-mcp-tools-without-managing-servers",
    type: "article",
    publishedTime: "2026-04-16T00:00:00Z",
  },
};

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "How to Use MCP Tools Without Managing Servers",
  description:
    "Skip the server setup. Unified tool APIs let AI agents execute MCP tools through a single endpoint.",
  datePublished: "2026-04-16T00:00:00Z",
  author: { "@type": "Organization", name: "ToolRoute" },
  publisher: {
    "@type": "Organization",
    name: "ToolRoute",
    url: "https://toolroute.ai",
  },
  mainEntityOfPage:
    "https://toolroute.ai/blog/use-mcp-tools-without-managing-servers",
};

const howToSchema = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to Use MCP Tools Without Managing Servers",
  description:
    "Use MCP tools through a unified API gateway instead of running individual MCP servers.",
  step: [
    {
      "@type": "HowToStep",
      name: "Get an API key",
      text: "Sign up at toolroute.ai and generate an API key. This single key authenticates against all 87 tools in the registry.",
    },
    {
      "@type": "HowToStep",
      name: "Find the tool you need",
      text: "Browse the tool catalog at /api/v1/tools or use the search endpoint. Each tool lists its operations, required inputs, and cost per call.",
    },
    {
      "@type": "HowToStep",
      name: "Execute via one endpoint",
      text: "Send a POST request to /api/v1/execute with the tool name, operation, and input. The gateway handles authentication, routing, and response normalization.",
    },
    {
      "@type": "HowToStep",
      name: "Add credits for paid tools",
      text: "Free tools cost nothing. Paid tools deduct from your prepaid credit balance. Add credits via /api/v1/checkout or bring your own API key with /api/v1/byok.",
    },
  ],
};

export default function Article() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(howToSchema) }}
      />
      <article className="max-w-3xl mx-auto">
        <header className="mb-12">
          <p className="text-accent text-xs font-medium mb-4">Guide</p>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">
            How to Use MCP Tools Without Managing Servers
          </h1>
          <p className="text-text-dim text-sm leading-relaxed mb-4">
            The standard way to use an MCP tool involves cloning a repo,
            installing dependencies, running a server process, and configuring
            your AI client to connect. There is a faster way.
          </p>
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <span>April 16, 2026</span>
            <span>6 min read</span>
            <span>ToolRoute Team</span>
          </div>
        </header>

        <div className="prose-custom space-y-8 text-sm leading-relaxed">
          <h2 className="text-xl font-bold pt-4">
            The Problem: MCP Server Management at Scale
          </h2>
          <p>
            The Model Context Protocol made it possible for AI agents to call
            external tools through a standard interface. But "standard interface"
            does not mean "zero infrastructure." To use a single MCP server, you
            typically need to:
          </p>
          <ol className="space-y-1.5 text-text-dim pl-4 list-decimal">
            <li>Clone the server repository</li>
            <li>Install Node.js, Python, or Rust dependencies</li>
            <li>Configure environment variables (API keys, secrets)</li>
            <li>Start the server process (stdio or HTTP transport)</li>
            <li>Point your AI client to the server endpoint</li>
            <li>Handle process management (restarts, port conflicts, memory)</li>
          </ol>
          <p>
            For one tool, this is manageable. For ten tools, you are running ten
            server processes. For fifty tools, you have a distributed systems
            problem that has nothing to do with the AI work you are trying to
            accomplish.
          </p>
          <p>
            We learned this firsthand. Running 17 companies with AI agents that
            collectively use 50+ tools, we hit a wall: 50 MCP servers running
            via stdio transport spawned one process per session. Eight concurrent
            sessions meant 400+ Node.js processes consuming 128 GB of RAM. The
            machine crashed.
          </p>

          <h2 className="text-xl font-bold pt-4">
            The Solution: Call Tools Through an API Gateway
          </h2>
          <p>
            An{" "}
            <Link
              href="/blog/what-is-an-mcp-gateway"
              className="text-accent hover:underline"
            >
              MCP gateway
            </Link>{" "}
            runs the tools on its side and exposes them through a unified API.
            You do not install, configure, or run anything. You make HTTP
            requests.
          </p>

          <h3 className="text-base font-semibold pt-2">
            Step 1: Get an API Key
          </h3>
          <p>
            Sign up and generate a key. This single key authenticates against
            every tool in the gateway.
          </p>
          <div className="bg-[#0d0d18] border border-border rounded-lg overflow-hidden my-4">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-card/50">
              <span className="text-[10px] text-text-muted">bash</span>
            </div>
            <pre className="p-4 text-xs leading-relaxed overflow-x-auto">
              <code className="text-text-dim">
                {`# Your single API key for all tools
export TOOLROUTE_KEY="tr_live_abc123..."`}
              </code>
            </pre>
          </div>

          <h3 className="text-base font-semibold pt-2">
            Step 2: Find the Tool You Need
          </h3>
          <p>
            The gateway exposes a catalog of every available tool, its
            operations, and its cost.
          </p>
          <div className="bg-[#0d0d18] border border-border rounded-lg overflow-hidden my-4">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-card/50">
              <span className="text-[10px] text-text-muted">bash</span>
            </div>
            <pre className="p-4 text-xs leading-relaxed overflow-x-auto">
              <code className="text-text-dim">
                {`# Browse all tools
curl https://toolroute.ai/api/v1/tools

# Search for a specific capability
curl "https://toolroute.ai/api/v1/tools?q=web+search"

# Get OpenAI function-calling format
curl "https://toolroute.ai/api/v1/tools?format=openai"`}
              </code>
            </pre>
          </div>

          <h3 className="text-base font-semibold pt-2">
            Step 3: Execute via One Endpoint
          </h3>
          <p>
            Every tool call goes through the same endpoint. The gateway handles
            routing, authentication with the upstream provider, and response
            normalization.
          </p>
          <div className="bg-[#0d0d18] border border-border rounded-lg overflow-hidden my-4">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-card/50">
              <span className="text-[10px] text-text-muted">bash</span>
            </div>
            <pre className="p-4 text-xs leading-relaxed overflow-x-auto">
              <code className="text-text-dim">
                {`# Search the web via Tavily
curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer $TOOLROUTE_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "tool": "tavily/search",
    "input": { "query": "MCP server security 2026" }
  }'

# Send an email via Resend (BYOK required)
curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer $TOOLROUTE_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "tool": "resend/send-email",
    "input": {
      "to": "user@example.com",
      "subject": "Report ready",
      "html": "<p>Your report is attached.</p>"
    }
  }'`}
              </code>
            </pre>
          </div>
          <p>
            Notice what is missing: no Tavily API key, no Resend API key, no
            server processes, no dependency management. The gateway holds the
            upstream credentials and routes the request.
          </p>

          <h3 className="text-base font-semibold pt-2">
            Step 4: Add Credits or Bring Your Own Key
          </h3>
          <p>
            Free tools (Context7, Playwright, Semgrep) cost nothing through the
            gateway. Paid tools deduct from your prepaid credit balance. If you
            already have an account with a specific provider, you can register
            your key via BYOK and skip the credit charge for that tool.
          </p>
          <div className="bg-bg-card border border-border rounded-lg p-6 my-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-green font-semibold">Free Tools</span>
                <p className="text-text-muted mt-1">
                  No credits needed. Context7, Playwright, Semgrep, GitHub MCP,
                  and 30+ others.
                </p>
              </div>
              <div>
                <span className="text-amber font-semibold">
                  Credits (Pay-As-You-Go)
                </span>
                <p className="text-text-muted mt-1">
                  Buy credits. Each call deducts based on the tool&apos;s cost.
                  Auto-top-up available.
                </p>
              </div>
              <div>
                <span className="text-cyan font-semibold">
                  BYOK (Your Own Key)
                </span>
                <p className="text-text-muted mt-1">
                  Register your existing API key. Calls go direct to the
                  provider at their rates.
                </p>
              </div>
            </div>
          </div>

          <h2 className="text-xl font-bold pt-4">
            Connecting Your AI Framework
          </h2>
          <p>
            The gateway speaks multiple protocols. Use whichever your framework
            supports:
          </p>

          <h3 className="text-base font-semibold pt-2">
            Claude Code / MCP Clients
          </h3>
          <p>
            Add the gateway as an MCP server in your configuration. Every tool
            becomes available as an MCP tool call.
          </p>
          <div className="bg-[#0d0d18] border border-border rounded-lg overflow-hidden my-4">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-card/50">
              <span className="text-[10px] text-text-muted">json</span>
            </div>
            <pre className="p-4 text-xs leading-relaxed overflow-x-auto">
              <code className="text-text-dim">
                {`// .mcp.json
{
  "toolroute": {
    "type": "http",
    "url": "https://toolroute.ai/mcp",
    "headers": {
      "Authorization": "Bearer tr_live_abc123..."
    }
  }
}`}
              </code>
            </pre>
          </div>

          <h3 className="text-base font-semibold pt-2">
            OpenAI Function Calling
          </h3>
          <p>
            Fetch the tool catalog in OpenAI format and pass it as function
            definitions.
          </p>
          <div className="bg-[#0d0d18] border border-border rounded-lg overflow-hidden my-4">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-card/50">
              <span className="text-[10px] text-text-muted">python</span>
            </div>
            <pre className="p-4 text-xs leading-relaxed overflow-x-auto">
              <code className="text-text-dim">
                {`import requests

# Get tools as OpenAI function definitions
tools = requests.get(
    "https://toolroute.ai/api/v1/tools?format=openai"
).json()

# Pass to OpenAI / any compatible LLM
response = client.chat.completions.create(
    model="gpt-4",
    messages=[...],
    tools=tools
)`}
              </code>
            </pre>
          </div>

          <h3 className="text-base font-semibold pt-2">
            Direct REST
          </h3>
          <p>
            For custom integrations, the REST endpoint works from any language
            that can make HTTP requests.
          </p>

          <h2 className="text-xl font-bold pt-4">
            What You Give Up (and What You Gain)
          </h2>
          <div className="bg-bg-card border border-border rounded-lg p-6 my-6">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-muted border-b border-border">
                  <th className="text-left pb-2 pr-4">Factor</th>
                  <th className="text-left pb-2 pr-4">Self-Hosted MCP</th>
                  <th className="text-left pb-2">Gateway</th>
                </tr>
              </thead>
              <tbody className="text-text-dim">
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Setup time per tool</td>
                  <td className="py-2 pr-4">5-30 min</td>
                  <td className="py-2 text-green">0 (already running)</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">API keys to manage</td>
                  <td className="py-2 pr-4">One per tool</td>
                  <td className="py-2 text-green">One total</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Server processes</td>
                  <td className="py-2 pr-4">One per tool</td>
                  <td className="py-2 text-green">Zero</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Latency</td>
                  <td className="py-2 pr-4 text-green">Direct (lowest)</td>
                  <td className="py-2">+50-100ms (gateway hop)</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Customization</td>
                  <td className="py-2 pr-4 text-green">Full control</td>
                  <td className="py-2">Standard operations only</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Cost at scale</td>
                  <td className="py-2 pr-4">Infrastructure + API fees</td>
                  <td className="py-2 text-green">Credits only</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            The tradeoff is clear: you gain zero infrastructure management and
            unified billing. You give up direct control and accept a small
            latency penalty. For most agent workflows where tool calls take
            seconds anyway, the 50-100ms gateway overhead is negligible.
          </p>

          <h2 className="text-xl font-bold pt-4">
            When to Self-Host Instead
          </h2>
          <p>
            A gateway is not always the right answer. Self-host when:
          </p>
          <ul className="space-y-1.5 text-text-dim pl-4">
            <li>
              You need sub-10ms latency (real-time voice, trading)
            </li>
            <li>
              You require custom tool modifications not available through the
              standard API
            </li>
            <li>
              Compliance requires that data never leaves your infrastructure
            </li>
            <li>
              You use only 1-2 tools and the setup cost is minimal
            </li>
          </ul>
          <p>
            For everything else, a gateway eliminates infrastructure complexity
            so you can focus on building the agent, not managing its
            dependencies.
          </p>

          <div className="border-t border-border pt-8 mt-8">
            <h3 className="font-semibold text-sm mb-4">Related Articles</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/blog/what-is-an-mcp-gateway" className="text-accent hover:underline">What Is an MCP Gateway? The Infrastructure Layer AI Agents Need</Link></li>
              <li><Link href="/blog/mcp-gateway-vs-api-gateway" className="text-accent hover:underline">MCP Gateway vs API Gateway: What AI Agents Actually Need</Link></li>
              <li><Link href="/blog/build-ai-agent-multiple-tools" className="text-accent hover:underline">How to Build an AI Agent With Multiple Tools</Link></li>
            </ul>
          </div>

          <div className="border-t border-border pt-8 mt-8">
            <p className="text-text-dim">
              ToolRoute provides 87 tools through one endpoint.{" "}
              <Link href="/docs" className="text-accent hover:underline">
                Read the quickstart
              </Link>
              ,{" "}
              <Link href="/playground" className="text-accent hover:underline">
                try the playground
              </Link>
              , or{" "}
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
