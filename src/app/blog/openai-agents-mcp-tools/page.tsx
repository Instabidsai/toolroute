import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title:
    "OpenAI Agents SDK + MCP Tools Integration: The Missing Bridge",
  description:
    "OpenAI's Agents SDK doesn't natively support MCP. Use ToolRoute's OpenAI-compatible endpoint to fetch MCP tools as function definitions, pass them to the SDK, and execute tool calls through one gateway.",
  alternates: { canonical: "/blog/openai-agents-mcp-tools" },
  openGraph: {
    title: "OpenAI Agents SDK + MCP Tools Integration",
    description:
      "Bridge MCP tools into OpenAI's Agents SDK using ToolRoute's OpenAI-compatible endpoint. Full Python walkthrough.",
    url: "https://toolroute.ai/blog/openai-agents-mcp-tools",
    type: "article",
    publishedTime: "2026-04-15T00:00:00Z",
  },
};

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline:
    "OpenAI Agents SDK + MCP Tools Integration: The Missing Bridge",
  description:
    "OpenAI's Agents SDK doesn't natively support MCP. Learn how to bridge MCP tools into OpenAI function calling using ToolRoute's OpenAI-compatible endpoint.",
  datePublished: "2026-04-15T00:00:00Z",
  author: { "@type": "Organization", name: "ToolRoute" },
  publisher: {
    "@type": "Organization",
    name: "ToolRoute",
    url: "https://toolroute.ai",
  },
  mainEntityOfPage:
    "https://toolroute.ai/blog/openai-agents-mcp-tools",
};

const howToSchema = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to Use MCP Tools with OpenAI Agents SDK",
  description:
    "A step-by-step guide to integrating MCP tools into OpenAI's Agents SDK using ToolRoute's OpenAI-compatible endpoint as the bridge layer.",
  step: [
    {
      "@type": "HowToStep",
      name: "Fetch MCP tools in OpenAI format",
      text: "Query ToolRoute's /api/v1/tools?format=openai endpoint to get every MCP tool as an OpenAI function definition with name, description, and JSON Schema parameters.",
    },
    {
      "@type": "HowToStep",
      name: "Pass tool definitions to the Agents SDK",
      text: "Feed the fetched function definitions into OpenAI's Agents SDK agent configuration so the model knows which tools it can call.",
    },
    {
      "@type": "HowToStep",
      name: "Handle tool calls through the gateway",
      text: "When the SDK produces a tool call, extract the function name and arguments, POST them to ToolRoute's /api/v1/execute endpoint, and feed the result back into the conversation.",
    },
    {
      "@type": "HowToStep",
      name: "Build a complete agent loop",
      text: "Wire the fetch-call-execute cycle into a loop so the agent can chain multiple MCP tool calls in a single conversation turn, handling errors and retries through one gateway.",
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
          <p className="text-accent text-xs font-medium mb-4">Integration Guide</p>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">
            OpenAI Agents SDK + MCP Tools Integration: The Missing Bridge
          </h1>
          <p className="text-text-dim text-sm leading-relaxed mb-4">
            OpenAI&apos;s Agents SDK gives you a clean framework for building
            tool-using agents. The{" "}
            <Link href="/blog/what-is-model-context-protocol" className="text-accent hover:underline">
              Model Context Protocol
            </Link>{" "}
            gives you access to hundreds of tools. But the SDK does not speak
            MCP natively. This guide shows how to bridge the gap: fetch MCP
            tools as OpenAI function definitions, pass them to the Agents SDK,
            and execute tool calls through a single gateway.
          </p>
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <span>April 15, 2026</span>
            <span>10 min read</span>
            <span>ToolRoute Team</span>
          </div>
        </header>

        <div className="prose-custom space-y-8 text-sm leading-relaxed">
          <h2 className="text-xl font-bold pt-4">
            The Problem: Two Ecosystems, No Native Bridge
          </h2>
          <p>
            OpenAI&apos;s Agents SDK is built around function calling. You define
            tools as JSON Schema objects, the model decides when to call them,
            and your code executes the call. It is a clean, well-documented
            pattern that works for any tool you define manually.
          </p>
          <p>
            The{" "}
            <Link href="/blog/what-is-model-context-protocol" className="text-accent hover:underline">
              Model Context Protocol (MCP)
            </Link>{" "}
            is a different ecosystem entirely. MCP servers expose tools through
            a JSON-RPC transport. Anthropic&apos;s Claude clients speak MCP
            natively. So does Cursor, Windsurf, and a growing list of IDE
            integrations. But OpenAI&apos;s SDK does not.
          </p>
          <p>
            This means if you are building agents with the OpenAI Agents SDK,
            you are locked out of the MCP tool ecosystem by default. You cannot
            call a Semgrep scan, query Context7 documentation, send an email
            through Resend, or manage DNS records through GoDaddy&apos;s MCP
            server. Not without writing your own adapter for each one.
          </p>
          <p>
            The bridge is a translation layer: something that takes MCP tools
            and presents them as OpenAI function definitions, then routes the
            SDK&apos;s tool calls back to the MCP servers that own them.
          </p>

          <h2 className="text-xl font-bold pt-4">
            How the Translation Works
          </h2>
          <p>
            An MCP tool definition and an OpenAI function definition are
            structurally similar. Both have a name, a description, and a JSON
            Schema for the input parameters. The difference is the transport:
            MCP uses JSON-RPC, OpenAI uses REST with a specific function-calling
            format.
          </p>
          <div className="bg-bg-card border border-border rounded-lg p-6 my-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
              <div>
                <span className="text-cyan font-semibold">MCP Tool Definition</span>
                <pre className="text-text-muted mt-2 leading-relaxed">{`{
  "name": "tavily_search",
  "description": "Search the web",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": { "type": "string" }
    },
    "required": ["query"]
  }
}`}</pre>
              </div>
              <div>
                <span className="text-green font-semibold">OpenAI Function Definition</span>
                <pre className="text-text-muted mt-2 leading-relaxed">{`{
  "type": "function",
  "function": {
    "name": "tavily_search",
    "description": "Search the web",
    "parameters": {
      "type": "object",
      "properties": {
        "query": { "type": "string" }
      },
      "required": ["query"]
    }
  }
}`}</pre>
              </div>
            </div>
          </div>
          <p>
            The mapping is mechanical: wrap the MCP definition in an outer{" "}
            <code className="text-accent">{"{ type: \"function\", function: {...} }"}</code>{" "}
            envelope and rename <code className="text-accent">inputSchema</code> to{" "}
            <code className="text-accent">parameters</code>. ToolRoute&apos;s{" "}
            <code className="text-accent">/api/v1/tools?format=openai</code>{" "}
            endpoint does this automatically for every tool in the{" "}
            <Link href="/tools" className="text-accent hover:underline">
              registry
            </Link>
            .
          </p>

          <h2 className="text-xl font-bold pt-4">
            Step 1: Fetch MCP Tools as OpenAI Function Definitions
          </h2>
          <p>
            One API call gives you every MCP tool in the gateway, already
            formatted for OpenAI&apos;s function calling interface. No manual
            schema writing. No per-tool adapters.
          </p>
          <div className="bg-[#0d0d18] border border-border rounded-lg overflow-hidden my-4">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-card/50">
              <span className="text-[10px] text-text-muted">python</span>
            </div>
            <pre className="p-4 text-xs leading-relaxed overflow-x-auto">
              <code className="text-text-dim">
                {`import requests
import os

TOOLROUTE_KEY = os.environ["TOOLROUTE_KEY"]
BASE = "https://toolroute.ai/api/v1"

# Fetch all MCP tools formatted as OpenAI function definitions
tools = requests.get(f"{BASE}/tools?format=openai").json()

print(f"Loaded {len(tools)} tools as OpenAI function definitions")
# Loaded 87 tools as OpenAI function definitions

# Each tool is already in the right shape:
# { "type": "function", "function": { "name": "...", "parameters": {...} } }
print(tools[0]["function"]["name"])
# e.g. "tavily_search"`}
              </code>
            </pre>
          </div>
          <p>
            You can also filter by category to give your agent a focused toolset
            instead of all 87:
          </p>
          <div className="bg-[#0d0d18] border border-border rounded-lg overflow-hidden my-4">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-card/50">
              <span className="text-[10px] text-text-muted">python</span>
            </div>
            <pre className="p-4 text-xs leading-relaxed overflow-x-auto">
              <code className="text-text-dim">
                {`# Only fetch security tools
security_tools = requests.get(
    f"{BASE}/tools?format=openai&category=security"
).json()

# Only fetch research and communication tools
research_tools = requests.get(
    f"{BASE}/tools?format=openai&category=research,communication"
).json()`}
              </code>
            </pre>
          </div>

          <h2 className="text-xl font-bold pt-4">
            Step 2: Pass Tool Definitions to the OpenAI Agents SDK
          </h2>
          <p>
            The Agents SDK expects tool definitions in the{" "}
            <code className="text-accent">tools</code> parameter of a chat
            completion call. Since the gateway already returns the correct
            format, you pass them directly:
          </p>
          <div className="bg-[#0d0d18] border border-border rounded-lg overflow-hidden my-4">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-card/50">
              <span className="text-[10px] text-text-muted">python</span>
            </div>
            <pre className="p-4 text-xs leading-relaxed overflow-x-auto">
              <code className="text-text-dim">
                {`from openai import OpenAI
import json

client = OpenAI()

# Fetch MCP tools in OpenAI format
tools = requests.get(f"{BASE}/tools?format=openai").json()

# Create the initial completion with MCP tools available
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {
            "role": "system",
            "content": "You are a research assistant with access to web search, "
                       "code scanning, email, DNS management, and 80+ other tools."
        },
        {
            "role": "user",
            "content": "Search for the latest MCP protocol updates and email "
                       "me a summary at team@example.com"
        }
    ],
    tools=tools,
    tool_choice="auto"
)

# The model will generate tool_calls for the tools it wants to use
message = response.choices[0].message
print(f"Model wants to call: {[tc.function.name for tc in message.tool_calls]}")
# Model wants to call: ['tavily_search']`}
              </code>
            </pre>
          </div>
          <p>
            The model sees the full catalog of MCP tools as if they were
            native OpenAI functions. It picks the right tool based on the
            user&apos;s request, generates the arguments, and returns a{" "}
            <code className="text-accent">tool_calls</code> array.
          </p>

          <h2 className="text-xl font-bold pt-4">
            Step 3: Execute Tool Calls Through the Gateway
          </h2>
          <p>
            When the model produces a tool call, your code needs to actually
            execute it. Instead of connecting to each MCP server individually,
            route every call through ToolRoute&apos;s{" "}
            <code className="text-accent">POST /api/v1/execute</code> endpoint.
            One key, one endpoint, any tool.
          </p>
          <div className="bg-[#0d0d18] border border-border rounded-lg overflow-hidden my-4">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-card/50">
              <span className="text-[10px] text-text-muted">python</span>
            </div>
            <pre className="p-4 text-xs leading-relaxed overflow-x-auto">
              <code className="text-text-dim">
                {`HEADERS = {
    "Authorization": f"Bearer {TOOLROUTE_KEY}",
    "Content-Type": "application/json"
}

def execute_tool_call(tool_call) -> str:
    """Route an OpenAI tool call through the ToolRoute gateway."""
    name = tool_call.function.name
    args = json.loads(tool_call.function.arguments)

    # Every MCP tool executes through the same endpoint
    resp = requests.post(f"{BASE}/execute", headers=HEADERS, json={
        "tool": name,
        "input": args
    })
    resp.raise_for_status()
    return json.dumps(resp.json())

# Execute each tool call the model requested
tool_results = []
for tc in message.tool_calls:
    result = execute_tool_call(tc)
    tool_results.append({
        "role": "tool",
        "tool_call_id": tc.id,
        "content": result
    })

print(f"Executed {len(tool_results)} tool calls through the gateway")`}
              </code>
            </pre>
          </div>
          <p>
            The gateway handles the MCP transport, authentication with the
            upstream provider, and response normalization. Your code never
            touches JSON-RPC, never manages per-provider API keys, and never
            parses provider-specific error formats. For a deeper comparison of
            how MCP differs from traditional REST APIs in agent architectures,
            see{" "}
            <Link href="/blog/mcp-vs-rest-api-ai-agents" className="text-accent hover:underline">
              MCP vs REST APIs for AI Agents
            </Link>
            .
          </p>

          <h2 className="text-xl font-bold pt-4">
            Step 4: Close the Loop — Full Agent Cycle
          </h2>
          <p>
            A real agent does not stop after one tool call. It feeds the tool
            results back into the model, which may call more tools or produce
            a final answer. Here is the complete loop:
          </p>
          <div className="bg-[#0d0d18] border border-border rounded-lg overflow-hidden my-4">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-card/50">
              <span className="text-[10px] text-text-muted">python</span>
            </div>
            <pre className="p-4 text-xs leading-relaxed overflow-x-auto">
              <code className="text-text-dim">
                {`from openai import OpenAI
import requests, json, os

client = OpenAI()
TOOLROUTE_KEY = os.environ["TOOLROUTE_KEY"]
BASE = "https://toolroute.ai/api/v1"
HEADERS = {
    "Authorization": f"Bearer {TOOLROUTE_KEY}",
    "Content-Type": "application/json"
}

def execute_tool_call(tool_call) -> str:
    """Route any tool call through the ToolRoute gateway."""
    resp = requests.post(f"{BASE}/execute", headers=HEADERS, json={
        "tool": tool_call.function.name,
        "input": json.loads(tool_call.function.arguments)
    })
    resp.raise_for_status()
    return json.dumps(resp.json())

def run_agent(user_message: str, max_turns: int = 5) -> str:
    """Run a full agent loop with MCP tools via OpenAI Agents SDK."""

    # 1. Fetch MCP tools as OpenAI function definitions
    tools = requests.get(f"{BASE}/tools?format=openai").json()

    messages = [
        {"role": "system", "content": (
            "You are an assistant with access to web search, code scanning, "
            "email, DNS management, database queries, and 80+ other tools. "
            "Use them to complete the user's request."
        )},
        {"role": "user", "content": user_message}
    ]

    for turn in range(max_turns):
        # 2. Call the model with MCP tools available
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            tools=tools,
            tool_choice="auto"
        )

        message = response.choices[0].message
        messages.append(message)

        # 3. If no tool calls, we have our final answer
        if not message.tool_calls:
            return message.content

        # 4. Execute each tool call through the gateway
        for tc in message.tool_calls:
            result = execute_tool_call(tc)
            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": result
            })

        print(f"Turn {turn + 1}: executed "
              f"{len(message.tool_calls)} tool calls")

    return messages[-1].content if messages[-1].role == "assistant" \\
        else "Max turns reached"

# Run it
answer = run_agent(
    "Search for the latest OpenAI Agents SDK release notes, "
    "then check if toolroute.ai has valid DNS records"
)
print(answer)`}
              </code>
            </pre>
          </div>
          <p>
            That is about 50 lines for a fully functional agent that can use
            any of the 87 MCP tools in the gateway. No MCP client library. No
            per-provider SDKs. No credential management beyond one environment
            variable.
          </p>

          <h2 className="text-xl font-bold pt-4">
            Filtering Tools for Focused Agents
          </h2>
          <p>
            Giving an agent 87 tools can dilute its decision-making. A security
            auditor does not need email tools. A content writer does not need
            DNS management. Filter the catalog to match the agent&apos;s role:
          </p>
          <div className="bg-[#0d0d18] border border-border rounded-lg overflow-hidden my-4">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-card/50">
              <span className="text-[10px] text-text-muted">python</span>
            </div>
            <pre className="p-4 text-xs leading-relaxed overflow-x-auto">
              <code className="text-text-dim">
                {`# Security auditor — only gets security + code analysis tools
security_agent_tools = requests.get(
    f"{BASE}/tools?format=openai&category=security"
).json()

# Research assistant — search + documentation tools
research_agent_tools = requests.get(
    f"{BASE}/tools?format=openai&category=research,documentation"
).json()

# DevOps agent — infrastructure + monitoring tools
devops_agent_tools = requests.get(
    f"{BASE}/tools?format=openai&category=infrastructure,monitoring"
).json()

# Each agent gets a focused toolset
print(f"Security agent: {len(security_agent_tools)} tools")
print(f"Research agent: {len(research_agent_tools)} tools")
print(f"DevOps agent: {len(devops_agent_tools)} tools")`}
              </code>
            </pre>
          </div>
          <p>
            Fewer tools means faster model decisions, fewer hallucinated tool
            calls, and lower token costs (since tool definitions count as input
            tokens).
          </p>

          <h2 className="text-xl font-bold pt-4">
            Error Handling and Retries
          </h2>
          <p>
            Production agents need to handle failures gracefully. The gateway
            normalizes error responses across all providers, so you write one
            error handler that works for every tool:
          </p>
          <div className="bg-[#0d0d18] border border-border rounded-lg overflow-hidden my-4">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-card/50">
              <span className="text-[10px] text-text-muted">python</span>
            </div>
            <pre className="p-4 text-xs leading-relaxed overflow-x-auto">
              <code className="text-text-dim">
                {`import time

def execute_tool_call_safe(tool_call, retries: int = 1) -> str:
    """Execute with retry logic and standardized error handling."""
    name = tool_call.function.name
    args = json.loads(tool_call.function.arguments)

    for attempt in range(retries + 1):
        try:
            resp = requests.post(f"{BASE}/execute", headers=HEADERS, json={
                "tool": name,
                "input": args
            })
            resp.raise_for_status()
            return json.dumps(resp.json())

        except requests.HTTPError as e:
            error = e.response.json().get("error", {})

            # Gateway returns uniform error shape across all 47 adapters:
            # { "error": { "code": "rate_limited", "message": "...", "retry_after": 30 } }
            if error.get("code") == "rate_limited" and attempt < retries:
                wait = error.get("retry_after", 10)
                time.sleep(wait)
                continue

            # Return error as tool result — let the model adapt
            return json.dumps({
                "error": True,
                "code": error.get("code", "unknown"),
                "message": error.get("message", str(e))
            })

    return json.dumps({"error": True, "message": "Max retries exceeded"})`}
              </code>
            </pre>
          </div>
          <p>
            Returning the error as a tool result instead of raising an exception
            lets the model recover. It might retry with different arguments,
            choose an alternative tool, or explain the failure to the user.
          </p>

          <h2 className="text-xl font-bold pt-4">
            Why Not Just Build MCP Adapters Yourself?
          </h2>
          <p>
            You can. Connect to each MCP server directly, translate the
            schemas manually, manage the transport, handle auth per provider.
            Here is what that looks like at scale:
          </p>
          <div className="bg-bg-card border border-border rounded-lg p-6 my-6">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-muted border-b border-border">
                  <th className="text-left pb-2 pr-4">Concern</th>
                  <th className="text-left pb-2 pr-4">DIY (per tool)</th>
                  <th className="text-left pb-2">Via Gateway</th>
                </tr>
              </thead>
              <tbody className="text-text-dim">
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Schema translation</td>
                  <td className="py-2 pr-4">Write MCP-to-OpenAI mapper</td>
                  <td className="py-2 text-green">?format=openai</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Authentication</td>
                  <td className="py-2 pr-4">Manage N API keys</td>
                  <td className="py-2 text-green">One ToolRoute key</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Transport</td>
                  <td className="py-2 pr-4">JSON-RPC client per server</td>
                  <td className="py-2 text-green">REST POST to /execute</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Error normalization</td>
                  <td className="py-2 pr-4">Parse each provider&apos;s format</td>
                  <td className="py-2 text-green">Uniform error shape</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">New tools</td>
                  <td className="py-2 pr-4">Write adapter + deploy</td>
                  <td className="py-2 text-green">Available on next fetch</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Billing</td>
                  <td className="py-2 pr-4">Track per provider</td>
                  <td className="py-2 text-green">Prepaid credits or BYOK</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            For one or two tools, the DIY approach is fine. For ten or more,
            the engineering overhead of maintaining adapters, rotating keys,
            and normalizing errors across providers eclipses the time spent on
            the actual agent logic.
          </p>

          <h2 className="text-xl font-bold pt-4">
            What About Claude and Other MCP-Native Clients?
          </h2>
          <p>
            If you are using Claude, Cursor, or another MCP-native client, you
            do not need this translation layer at all. Those clients speak MCP
            directly and can connect to the gateway as an MCP server:
          </p>
          <div className="bg-[#0d0d18] border border-border rounded-lg overflow-hidden my-4">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-card/50">
              <span className="text-[10px] text-text-muted">json</span>
            </div>
            <pre className="p-4 text-xs leading-relaxed overflow-x-auto">
              <code className="text-text-dim">
                {`// .mcp.json — MCP-native clients connect directly
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
            The OpenAI-compatible endpoint exists specifically to bridge the
            gap for frameworks and SDKs that speak function calling but not
            MCP. The gateway serves both protocols from the same tool catalog,
            so an MCP-native client and an OpenAI Agents SDK agent see the
            exact same tools.
          </p>

          <h2 className="text-xl font-bold pt-4">
            The Bottom Line
          </h2>
          <p>
            OpenAI&apos;s Agents SDK is a solid foundation for building
            tool-using agents. MCP is the fastest-growing ecosystem of AI
            tools. The two do not talk to each other natively, but the bridge
            is straightforward: a translation endpoint that serves MCP tools
            as OpenAI function definitions, and an execution endpoint that
            routes tool calls back through the MCP infrastructure.
          </p>
          <p>
            With ToolRoute, the integration is four lines of code: fetch the
            tools, pass them to the SDK, execute calls through the gateway,
            feed results back. Your agent gets access to 87 MCP tools without
            importing a single MCP library.
          </p>

          <div className="border-t border-border pt-8 mt-8">
            <h3 className="font-semibold text-sm mb-4">Related Articles</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/blog/what-is-model-context-protocol" className="text-accent hover:underline">What Is Model Context Protocol (MCP)? The Complete Guide for 2026</Link></li>
              <li><Link href="/blog/mcp-vs-rest-api-ai-agents" className="text-accent hover:underline">MCP vs REST APIs for AI Agents: When to Use Which</Link></li>
              <li><Link href="/blog/build-ai-agent-multiple-tools" className="text-accent hover:underline">How to Build an AI Agent With Multiple Tools</Link></li>
            </ul>
          </div>

          <div className="border-t border-border pt-8 mt-8">
            <p className="text-text-dim">
              ToolRoute bridges MCP tools into any framework that speaks
              OpenAI function calling.{" "}
              <Link href="/tools" className="text-accent hover:underline">
                Browse the tool catalog
              </Link>
              ,{" "}
              <Link href="/docs" className="text-accent hover:underline">
                read the API docs
              </Link>
              , or{" "}
              <Link href="/pricing" className="text-accent hover:underline">
                get started with a free key
              </Link>
              .
            </p>
          </div>
        </div>
      </article>
    </>
  );
}
