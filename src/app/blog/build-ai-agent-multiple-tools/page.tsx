import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title:
    "How to Build an AI Agent With Multiple Tools — Architecture That Scales",
  description:
    "Building an AI agent that uses one tool is easy. Building one that uses 50 tools is an infrastructure problem. Learn the architecture: tool discovery, authentication, routing, error handling, and billing through one gateway.",
  alternates: { canonical: "/blog/build-ai-agent-multiple-tools" },
  openGraph: {
    title: "How to Build an AI Agent With Multiple Tools",
    description:
      "Tool discovery, auth, routing, error handling, billing — the full architecture for multi-tool AI agents.",
    url: "https://toolroute.ai/blog/build-ai-agent-multiple-tools",
    type: "article",
    publishedTime: "2026-04-15T00:00:00Z",
  },
};

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline:
    "How to Build an AI Agent With Multiple Tools — Architecture That Scales",
  description:
    "Building an AI agent that uses one tool is easy. Building one that uses 50 tools is an infrastructure problem. Learn the full architecture for multi-tool agents.",
  datePublished: "2026-04-15T00:00:00Z",
  author: { "@type": "Organization", name: "ToolRoute" },
  publisher: {
    "@type": "Organization",
    name: "ToolRoute",
    url: "https://toolroute.ai",
  },
  mainEntityOfPage:
    "https://toolroute.ai/blog/build-ai-agent-multiple-tools",
};

const howToSchema = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to Build an AI Agent That Uses Multiple Tools",
  description:
    "A step-by-step guide to building an AI agent that discovers, authenticates, routes, and orchestrates 50+ tools through a single gateway.",
  step: [
    {
      "@type": "HowToStep",
      name: "Set up tool discovery",
      text: "Query the tool catalog API to let your agent know what tools exist, what they do, and what inputs they require. Use GET /api/v1/tools with optional format and category filters.",
    },
    {
      "@type": "HowToStep",
      name: "Authenticate with one key",
      text: "Generate a single API key that authenticates against all 87 tools. No per-tool credential management required.",
    },
    {
      "@type": "HowToStep",
      name: "Execute tools through a unified endpoint",
      text: "Send POST requests to /api/v1/execute with the tool name, operation, and input. The gateway handles routing to the correct provider and normalizing the response.",
    },
    {
      "@type": "HowToStep",
      name: "Chain multiple tools in workflows",
      text: "Build multi-step workflows by piping tool outputs into subsequent tool inputs. Research, analyze, email, and track — all through the same endpoint.",
    },
    {
      "@type": "HowToStep",
      name: "Handle billing and rate limits",
      text: "Use prepaid credits for gateway-managed tools or register your own API keys via BYOK for tools you already pay for. The gateway tracks usage and enforces rate limits per key.",
    },
    {
      "@type": "HowToStep",
      name: "Add error handling and fallbacks",
      text: "Implement retry logic for transient failures and fallback tools for critical operations. The gateway returns standardized error codes across all 47 adapters.",
    },
  ],
};

export default function Article() {
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
      <article className="max-w-3xl mx-auto">
        <header className="mb-12">
          <p className="text-accent text-xs font-medium mb-4">Architecture Guide</p>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">
            How to Build an AI Agent With Multiple Tools
          </h1>
          <p className="text-text-dim text-sm leading-relaxed mb-4">
            Connecting an AI agent to one tool takes an afternoon. Connecting it
            to fifty tools is a distributed systems problem. This guide walks
            through the architecture — tool discovery, authentication, routing,
            error handling, and billing — and shows how a gateway collapses that
            complexity into a single endpoint.
          </p>
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <span>April 15, 2026</span>
            <span>9 min read</span>
            <span>ToolRoute Team</span>
          </div>
        </header>

        <div className="prose-custom space-y-8 text-sm leading-relaxed">
          <h2 className="text-xl font-bold pt-4">
            One Tool Is Easy. Fifty Tools Is Infrastructure.
          </h2>
          <p>
            Every tutorial on building AI agents makes it look simple. Import a
            library, define a tool, call it from the LLM. And for a single tool,
            it is simple. The agent searches the web, summarizes the results,
            and you ship it.
          </p>
          <p>
            Then the requirements grow. The agent needs to search the web{" "}
            <em>and</em> send emails <em>and</em> query a database <em>and</em>{" "}
            generate images <em>and</em> check DNS records <em>and</em> scan
            code for vulnerabilities. Each tool has its own API key, its own
            authentication scheme, its own rate limits, its own error format, and
            its own SDK. You are no longer building an agent — you are building
            a tool management platform.
          </p>
          <p>
            This is the gap between a demo and a production agent. The
            intelligence is in the LLM. The hard engineering is in the tool
            infrastructure.
          </p>

          <h2 className="text-xl font-bold pt-4">
            The Five Problems of Multi-Tool Agents
          </h2>
          <p>
            Before looking at solutions, name the problems. Every multi-tool
            agent hits these five:
          </p>
          <ol className="space-y-3 text-text-dim pl-4 list-decimal">
            <li>
              <span className="text-text font-semibold">Tool discovery.</span>{" "}
              The agent needs to know what tools exist, what they do, and what
              inputs they accept. Hardcoding tool definitions does not scale past
              a handful.
            </li>
            <li>
              <span className="text-text font-semibold">Authentication.</span>{" "}
              Each tool provider issues its own API key. Managing 50 keys — rotation,
              scoping, secure storage — becomes a security project.
            </li>
            <li>
              <span className="text-text font-semibold">Routing.</span>{" "}
              Different tools speak different protocols: REST, GraphQL, MCP,
              gRPC. The agent needs a uniform way to call any of them.
            </li>
            <li>
              <span className="text-text font-semibold">Error handling.</span>{" "}
              Tavily returns errors differently than Resend, which returns errors
              differently than Stripe. Without normalization, every tool needs
              its own error parser.
            </li>
            <li>
              <span className="text-text font-semibold">Billing.</span>{" "}
              Some tools are free, some charge per call, some charge monthly. If
              the agent runs autonomously, you need spend controls or it will
              drain every account it touches.
            </li>
          </ol>

          <h2 className="text-xl font-bold pt-4">
            The Architecture: How a Gateway Solves All Five
          </h2>
          <p>
            An{" "}
            <Link
              href="/blog/what-is-an-mcp-gateway"
              className="text-accent hover:underline"
            >
              MCP gateway
            </Link>{" "}
            sits between the agent and the tool providers. It handles discovery,
            auth, routing, error normalization, and billing so the agent code
            stays clean. Here is how to build on top of one, step by step.
          </p>

          <h3 className="text-base font-semibold pt-2">
            Step 1: Tool Discovery — Let the Agent Browse the Catalog
          </h3>
          <p>
            Instead of hardcoding tool definitions, query the catalog at
            runtime. The agent learns what is available, what each tool costs,
            and what inputs it needs.
          </p>
          <div className="bg-[#0d0d18] border border-border rounded-lg overflow-hidden my-4">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-card/50">
              <span className="text-[10px] text-text-muted">bash</span>
            </div>
            <pre className="p-4 text-xs leading-relaxed overflow-x-auto">
              <code className="text-text-dim">
                {`# List all 87 tools across 14 categories
curl https://toolroute.ai/api/v1/tools

# Filter by category
curl "https://toolroute.ai/api/v1/tools?category=security"

# Get tool definitions in OpenAI function-calling format
curl "https://toolroute.ai/api/v1/tools?format=openai"

# Search for a specific capability
curl "https://toolroute.ai/api/v1/tools?q=dns+records"`}
              </code>
            </pre>
          </div>
          <p>
            In Python, you can fetch the catalog and pass it directly to your
            LLM as function definitions:
          </p>
          <div className="bg-[#0d0d18] border border-border rounded-lg overflow-hidden my-4">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-card/50">
              <span className="text-[10px] text-text-muted">python</span>
            </div>
            <pre className="p-4 text-xs leading-relaxed overflow-x-auto">
              <code className="text-text-dim">
                {`import requests, os

TOOLROUTE_KEY = os.environ["TOOLROUTE_KEY"]
BASE = "https://toolroute.ai/api/v1"

# Fetch every tool the agent can use
catalog = requests.get(f"{BASE}/tools?format=openai").json()

print(f"Agent has access to {len(catalog)} tools")
# Agent has access to 87 tools

# Pass to any OpenAI-compatible LLM
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Find DNS records for example.com"}],
    tools=catalog
)`}
              </code>
            </pre>
          </div>
          <p>
            The agent never needs a hardcoded tool list. When new tools are
            added to the{" "}
            <Link href="/tools" className="text-accent hover:underline">
              registry
            </Link>
            , every agent that queries the catalog picks them up automatically.
          </p>

          <h3 className="text-base font-semibold pt-2">
            Step 2: Authentication — One Key for Everything
          </h3>
          <p>
            Instead of managing 50 API keys, generate one ToolRoute key. It
            authenticates against all 87 tools through 47 adapters. The gateway
            holds the upstream credentials.
          </p>
          <div className="bg-[#0d0d18] border border-border rounded-lg overflow-hidden my-4">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-card/50">
              <span className="text-[10px] text-text-muted">bash</span>
            </div>
            <pre className="p-4 text-xs leading-relaxed overflow-x-auto">
              <code className="text-text-dim">
                {`export TOOLROUTE_KEY="tr_live_abc123..."

# This one key works for Tavily, Resend, Stripe, GoDaddy,
# Semgrep, Playwright, and 81 other tools.
# No per-provider key management.`}
              </code>
            </pre>
          </div>
          <p>
            If you already have an API key with a specific provider — say you
            are on a Tavily enterprise plan — register it via BYOK and the
            gateway routes calls through your key instead:
          </p>
          <div className="bg-[#0d0d18] border border-border rounded-lg overflow-hidden my-4">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-card/50">
              <span className="text-[10px] text-text-muted">bash</span>
            </div>
            <pre className="p-4 text-xs leading-relaxed overflow-x-auto">
              <code className="text-text-dim">
                {`# Register your own Tavily key — calls use your key, not credits
curl -X POST https://toolroute.ai/api/v1/byok \\
  -H "Authorization: Bearer $TOOLROUTE_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "provider": "tavily",
    "api_key": "tvly-your-enterprise-key..."
  }'`}
              </code>
            </pre>
          </div>

          <h3 className="text-base font-semibold pt-2">
            Step 3: Execution — One Endpoint, Any Tool
          </h3>
          <p>
            Every tool call goes through <code className="text-accent">POST /api/v1/execute</code>.
            The gateway routes to the correct provider across all 47 adapters
            and normalizes the response into a consistent format.
          </p>
          <div className="bg-[#0d0d18] border border-border rounded-lg overflow-hidden my-4">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-card/50">
              <span className="text-[10px] text-text-muted">bash</span>
            </div>
            <pre className="p-4 text-xs leading-relaxed overflow-x-auto">
              <code className="text-text-dim">
                {`# Search the web
curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer $TOOLROUTE_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "tool": "tavily",
    "operation": "search",
    "input": { "query": "multi-tool AI agent architecture 2026" }
  }'

# Scan code for vulnerabilities
curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer $TOOLROUTE_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "tool": "semgrep",
    "operation": "scan",
    "input": { "code": "eval(user_input)", "language": "python" }
  }'

# Send an email
curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer $TOOLROUTE_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "tool": "resend",
    "operation": "send_email",
    "input": {
      "to": "team@company.com",
      "subject": "Scan complete",
      "html": "<p>No critical vulnerabilities found.</p>"
    }
  }'`}
              </code>
            </pre>
          </div>
          <p>
            Same endpoint, same auth header, same response shape. Whether the
            tool is a free open-source scanner or a paid third-party API, the
            calling code is identical.
          </p>

          <h3 className="text-base font-semibold pt-2">
            Step 4: Chaining Tools in a Workflow
          </h3>
          <p>
            Real agents do not call one tool. They chain multiple tools into a
            workflow: research a topic, analyze the results, generate a report,
            email it to a stakeholder. Here is a Python example that chains four
            tools:
          </p>
          <div className="bg-[#0d0d18] border border-border rounded-lg overflow-hidden my-4">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-card/50">
              <span className="text-[10px] text-text-muted">python</span>
            </div>
            <pre className="p-4 text-xs leading-relaxed overflow-x-auto">
              <code className="text-text-dim">
                {`import requests, os

KEY = os.environ["TOOLROUTE_KEY"]
BASE = "https://toolroute.ai/api/v1"
HEADERS = {
    "Authorization": f"Bearer {KEY}",
    "Content-Type": "application/json"
}

def execute(tool: str, operation: str, input_data: dict) -> dict:
    """Execute any tool through the gateway."""
    resp = requests.post(f"{BASE}/execute", headers=HEADERS, json={
        "tool": tool,
        "operation": operation,
        "input": input_data
    })
    resp.raise_for_status()
    return resp.json()

# Step 1: Research — search for competitor pricing
research = execute("tavily", "search", {
    "query": "AI security scanning pricing 2026"
})

# Step 2: Analyze — extract structured data from search results
analysis = execute("openai", "chat", {
    "model": "gpt-4o-mini",
    "messages": [{
        "role": "user",
        "content": f"Extract competitor names and prices: {research['result']}"
    }]
})

# Step 3: Store — save to a database
execute("supabase", "insert", {
    "table": "competitor_intel",
    "data": {"analysis": analysis["result"], "source": "tavily"}
})

# Step 4: Notify — email the team
execute("resend", "send_email", {
    "to": "strategy@company.com",
    "subject": "Competitor pricing update",
    "html": f"<pre>{analysis['result']}</pre>"
})

print("4-tool workflow complete")`}
              </code>
            </pre>
          </div>
          <p>
            Four different providers — Tavily, OpenAI, Supabase, Resend — all
            through the same <code className="text-accent">execute()</code>{" "}
            function. No SDK imports, no per-provider error handling, no
            credential juggling.
          </p>

          <h3 className="text-base font-semibold pt-2">
            Step 5: Billing and Spend Controls
          </h3>
          <p>
            Autonomous agents need guardrails. Without spend controls, a loop
            that calls a paid tool 10,000 times will drain your account before
            you notice.
          </p>
          <div className="bg-bg-card border border-border rounded-lg p-6 my-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-green font-semibold">Free Tools</span>
                <p className="text-text-muted mt-1">
                  Context7, Playwright, Semgrep, GitHub MCP, and 30+ others
                  cost nothing. No credits needed.
                </p>
              </div>
              <div>
                <span className="text-amber font-semibold">
                  Prepaid Credits
                </span>
                <p className="text-text-muted mt-1">
                  Each paid tool call deducts from your balance. When credits
                  hit zero, calls stop. No surprise bills.
                </p>
              </div>
              <div>
                <span className="text-cyan font-semibold">BYOK</span>
                <p className="text-text-muted mt-1">
                  Register your own API key for any provider. Calls route
                  through your key at the provider&apos;s rates.
                </p>
              </div>
            </div>
          </div>
          <p>
            Check your balance and usage programmatically to build spend alerts
            into your agent:
          </p>
          <div className="bg-[#0d0d18] border border-border rounded-lg overflow-hidden my-4">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-card/50">
              <span className="text-[10px] text-text-muted">python</span>
            </div>
            <pre className="p-4 text-xs leading-relaxed overflow-x-auto">
              <code className="text-text-dim">
                {`# Check balance before expensive operations
key_info = requests.get(
    f"{BASE}/key",
    headers={"Authorization": f"Bearer {KEY}"}
).json()

if key_info["credits_remaining"] < 100:
    print("Low credits — pausing paid tool calls")
    # Fall back to free tools only`}
              </code>
            </pre>
          </div>

          <h3 className="text-base font-semibold pt-2">
            Step 6: Error Handling Across 47 Adapters
          </h3>
          <p>
            Every provider returns errors differently. The gateway normalizes
            them into a consistent format so your agent needs exactly one error
            handler:
          </p>
          <div className="bg-[#0d0d18] border border-border rounded-lg overflow-hidden my-4">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-card/50">
              <span className="text-[10px] text-text-muted">python</span>
            </div>
            <pre className="p-4 text-xs leading-relaxed overflow-x-auto">
              <code className="text-text-dim">
                {`def safe_execute(tool: str, operation: str, input_data: dict) -> dict:
    """Execute with standardized error handling."""
    try:
        resp = requests.post(f"{BASE}/execute", headers=HEADERS, json={
            "tool": tool,
            "operation": operation,
            "input": input_data
        })
        resp.raise_for_status()
        return {"ok": True, "result": resp.json()}
    except requests.HTTPError as e:
        body = e.response.json()
        # Every adapter returns the same error shape:
        # { "error": { "code": "rate_limited", "message": "...", "retry_after": 30 } }
        error = body.get("error", {})
        if error.get("code") == "rate_limited":
            time.sleep(error.get("retry_after", 10))
            return safe_execute(tool, operation, input_data)  # retry once
        return {"ok": False, "error": error}

# Works identically whether the tool is Tavily, Resend, or Stripe
result = safe_execute("tavily", "search", {"query": "MCP tools"})`}
              </code>
            </pre>
          </div>

          <h2 className="text-xl font-bold pt-4">
            Architecture Diagram: What This Looks Like in Production
          </h2>
          <div className="bg-bg-card border border-border rounded-lg p-6 my-6">
            <pre className="text-xs text-text-dim leading-relaxed overflow-x-auto">
              {`  Your Agent (Python / Node / Any Language)
       |
       | Single API key
       v
  ToolRoute Gateway (/api/v1/execute)
       |
       +-- Tool Discovery (87 tools, 14 categories)
       +-- Auth Router (47 adapters, BYOK support)
       +-- Response Normalizer
       +-- Credit Tracker + Rate Limiter
       |
       +----+------+------+------+------+
       |    |      |      |      |      |
    Tavily Resend Stripe Semgrep  ...  +81 more`}
            </pre>
          </div>
          <p>
            The agent talks to one endpoint. The gateway fans out to whichever
            provider the tool maps to. The agent code never changes when tools
            are added, updated, or swapped out underneath.
          </p>

          <h2 className="text-xl font-bold pt-4">
            Connecting via MCP Protocol (for Claude Code and MCP Clients)
          </h2>
          <p>
            If your agent speaks MCP natively, you can skip the REST layer
            entirely. Add the gateway as an MCP server and every tool appears as
            a native MCP tool call:
          </p>
          <div className="bg-[#0d0d18] border border-border rounded-lg overflow-hidden my-4">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-card/50">
              <span className="text-[10px] text-text-muted">json</span>
            </div>
            <pre className="p-4 text-xs leading-relaxed overflow-x-auto">
              <code className="text-text-dim">
                {`// .mcp.json — one entry gives your agent 87 tools
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
          <p>
            No individual server processes. No dependency management. No port
            conflicts. The gateway handles all of it, and your MCP client sees a
            flat list of tools it can call.
          </p>

          <h2 className="text-xl font-bold pt-4">
            When to Build Your Own vs. Use a Gateway
          </h2>
          <div className="bg-bg-card border border-border rounded-lg p-6 my-6">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-muted border-b border-border">
                  <th className="text-left pb-2 pr-4">Scenario</th>
                  <th className="text-left pb-2 pr-4">Build Your Own</th>
                  <th className="text-left pb-2">Use a Gateway</th>
                </tr>
              </thead>
              <tbody className="text-text-dim">
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">1-3 tools</td>
                  <td className="py-2 pr-4 text-green">Simple, full control</td>
                  <td className="py-2">Overkill</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">10+ tools</td>
                  <td className="py-2 pr-4">Key management headache</td>
                  <td className="py-2 text-green">One key, one endpoint</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Autonomous agents</td>
                  <td className="py-2 pr-4">Build your own billing</td>
                  <td className="py-2 text-green">Spend controls built in</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Sub-10ms latency</td>
                  <td className="py-2 pr-4 text-green">Direct connection</td>
                  <td className="py-2">+50-100ms per hop</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Custom tool logic</td>
                  <td className="py-2 pr-4 text-green">Modify anything</td>
                  <td className="py-2">Standard operations only</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Compliance (data residency)</td>
                  <td className="py-2 pr-4 text-green">Self-hosted infra</td>
                  <td className="py-2">Depends on gateway provider</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Most production agents land in the 10-50 tool range. That is exactly
            where the infrastructure tax becomes the bottleneck and a gateway
            pays for itself in engineering time saved.
          </p>

          <h2 className="text-xl font-bold pt-4">
            The Bottom Line
          </h2>
          <p>
            Building an AI agent that uses multiple tools is not an intelligence
            problem — it is an infrastructure problem. The LLM already knows how
            to decide which tool to call. What it needs is a clean interface to
            discover, authenticate, execute, and handle errors across dozens of
            providers without your codebase turning into a credential management
            system.
          </p>
          <p>
            A gateway gives you that interface. One API key. One endpoint. One
            error format. Eighty-seven tools. The agent code stays focused on
            what it should be focused on: the task, not the plumbing.
          </p>

          <div className="border-t border-border pt-8 mt-8">
            <h3 className="font-semibold text-sm mb-4">Related Articles</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/blog/what-is-an-mcp-gateway" className="text-accent hover:underline">What Is an MCP Gateway? The Infrastructure Layer AI Agents Need</Link></li>
              <li><Link href="/blog/use-mcp-tools-without-managing-servers" className="text-accent hover:underline">How to Use MCP Tools Without Managing Servers</Link></li>
              <li><Link href="/blog/best-mcp-servers-ai-agents-2026" className="text-accent hover:underline">Best MCP Servers for AI Agents in 2026: 87 Tools Rated and Compared</Link></li>
            </ul>
          </div>

          <div className="border-t border-border pt-8 mt-8">
            <p className="text-text-dim">
              ToolRoute provides 87 tools across 14 categories through one
              endpoint.{" "}
              <Link href="/tools" className="text-accent hover:underline">
                Browse the catalog
              </Link>
              ,{" "}
              <Link href="/docs" className="text-accent hover:underline">
                read the docs
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
