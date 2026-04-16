import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Key,
  Code2,
  Copy,
  Terminal,
  Cpu,
  Link2,
  Bot,
  Boxes,
  Globe,
  Braces,
  Workflow,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Integrations — Connect Any AI Framework | ToolRoute",
  description:
    "Connect ToolRoute to Claude Code, Cursor, OpenAI Agents SDK, LangChain, CrewAI, AutoGen, Google A2A, and any REST client. MCP integrations for every AI framework.",
  keywords: [
    "mcp integrations ai frameworks",
    "claude code mcp",
    "cursor mcp",
    "openai agents sdk tools",
    "langchain mcp tools",
    "crewai tools",
    "autogen tools",
    "google a2a protocol",
    "ai agent integrations",
  ],
  alternates: {
    canonical: "/integrations",
  },
  openGraph: {
    title: "Integrations — Connect Any AI Framework | ToolRoute",
    description:
      "One endpoint, every framework. Connect ToolRoute to Claude Code, Cursor, OpenAI, LangChain, CrewAI, AutoGen, A2A, or raw REST.",
    url: "https://toolroute.ai/integrations",
  },
};

const integrations = [
  {
    icon: Terminal,
    name: "Claude Code",
    color: "text-orange-400",
    bgColor: "bg-orange-400/10",
    borderColor: "border-orange-400/20",
    description:
      "Add ToolRoute as an MCP server in your .mcp.json and every tool is available instantly. Streamable HTTP means zero process management — one URL, all 70+ tools.",
    docsHref: "/docs",
    filename: ".mcp.json",
    snippet: `{
  "mcpServers": {
    "toolroute": {
      "type": "http",
      "url": "https://toolroute.ai/mcp",
      "headers": {
        "Authorization": "Bearer tr_your_api_key"
      }
    }
  }
}`,
  },
  {
    icon: Code2,
    name: "Cursor",
    color: "text-sky-400",
    bgColor: "bg-sky-400/10",
    borderColor: "border-sky-400/20",
    description:
      "Same MCP endpoint works in Cursor. Add the server in Settings > MCP Servers and every ToolRoute tool appears as a native action your Cursor agent can call.",
    docsHref: "/docs",
    filename: "cursor-settings.json",
    snippet: `// Settings > MCP Servers > Add Server
{
  "name": "toolroute",
  "type": "http",
  "url": "https://toolroute.ai/mcp",
  "headers": {
    "Authorization": "Bearer tr_your_api_key"
  }
}`,
  },
  {
    icon: Bot,
    name: "OpenAI Agents SDK",
    color: "text-green-400",
    bgColor: "bg-green-400/10",
    borderColor: "border-green-400/20",
    description:
      "Fetch the tool catalog in OpenAI function-calling format and pass it straight to the Agents SDK. ToolRoute handles execution — your agent just calls functions.",
    docsHref: "/docs",
    filename: "openai-agent.py",
    snippet: `import httpx, json
from agents import Agent, FunctionTool

# Fetch tools in OpenAI format
tools_resp = httpx.get(
    "https://toolroute.ai/api/v1/tools?format=openai"
).json()

# Register each as a FunctionTool
def call_tool(name: str, args: dict):
    return httpx.post(
        "https://toolroute.ai/api/v1/execute",
        headers={"Authorization": "Bearer tr_your_api_key"},
        json={"tool": name, "input": args},
    ).json()

agent = Agent(
    name="researcher",
    tools=[FunctionTool.from_dict(t, call_tool) for t in tools_resp],
)`,
  },
  {
    icon: Link2,
    name: "LangChain",
    color: "text-emerald-400",
    bgColor: "bg-emerald-400/10",
    borderColor: "border-emerald-400/20",
    description:
      "Wrap the /api/v1/execute endpoint as a LangChain StructuredTool. Your chains and agents call ToolRoute tools like any other LangChain tool — no adapter library needed.",
    docsHref: "/docs",
    filename: "langchain_tool.py",
    snippet: `import httpx
from langchain_core.tools import StructuredTool

def toolroute_execute(tool: str, input: dict) -> dict:
    resp = httpx.post(
        "https://toolroute.ai/api/v1/execute",
        headers={"Authorization": "Bearer tr_your_api_key"},
        json={"tool": tool, "input": input},
    )
    return resp.json()

tavily = StructuredTool.from_function(
    func=lambda query: toolroute_execute(
        "tavily/search", {"query": query}
    ),
    name="tavily_search",
    description="Search the web via Tavily",
)`,
  },
  {
    icon: Boxes,
    name: "CrewAI",
    color: "text-violet-400",
    bgColor: "bg-violet-400/10",
    borderColor: "border-violet-400/20",
    description:
      "Create a CrewAI Tool class that wraps the ToolRoute REST endpoint. Your crew members use it like any other tool — works with any ToolRoute adapter out of the box.",
    docsHref: "/docs",
    filename: "crewai_tool.py",
    snippet: `import httpx
from crewai.tools import BaseTool

class ToolRouteTool(BaseTool):
    name: str = "toolroute"
    description: str = "Execute any tool via ToolRoute"

    def _run(self, tool: str, input: dict) -> dict:
        resp = httpx.post(
            "https://toolroute.ai/api/v1/execute",
            headers={
                "Authorization": "Bearer tr_your_api_key"
            },
            json={"tool": tool, "input": input},
        )
        return resp.json()

# Usage in a crew
search = ToolRouteTool()
result = search._run("tavily/search", {"query": "MCP tools"})`,
  },
  {
    icon: Workflow,
    name: "AutoGen",
    color: "text-amber-400",
    bgColor: "bg-amber-400/10",
    borderColor: "border-amber-400/20",
    description:
      "Register ToolRoute functions directly from the OpenAI-format catalog. AutoGen agents discover and call them through the standard function-calling interface.",
    docsHref: "/docs",
    filename: "autogen_agent.py",
    snippet: `import httpx
from autogen import AssistantAgent, UserProxyAgent

# Fetch OpenAI-format tool definitions
tools = httpx.get(
    "https://toolroute.ai/api/v1/tools?format=openai"
).json()

def execute_tool(name: str, **kwargs):
    return httpx.post(
        "https://toolroute.ai/api/v1/execute",
        headers={"Authorization": "Bearer tr_your_api_key"},
        json={"tool": name, "input": kwargs},
    ).json()

assistant = AssistantAgent("assistant", llm_config={
    "tools": tools,
})
# Register the execution function
for tool in tools:
    assistant.register_function({
        tool["function"]["name"]: execute_tool
    })`,
  },
  {
    icon: Globe,
    name: "Google A2A",
    color: "text-blue-400",
    bgColor: "bg-blue-400/10",
    borderColor: "border-blue-400/20",
    description:
      "ToolRoute speaks the Agent-to-Agent protocol natively. Point any A2A client at the /api/a2a endpoint to discover capabilities via the agent card and send tasks.",
    docsHref: "/docs",
    filename: "a2a-client.ts",
    snippet: `// Discover the agent card
const card = await fetch(
  "https://toolroute.ai/.well-known/agent.json"
).then(r => r.json());

// Send a task via A2A
const task = await fetch("https://toolroute.ai/api/a2a", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer tr_your_api_key",
  },
  body: JSON.stringify({
    jsonrpc: "2.0",
    method: "tasks/send",
    params: {
      message: {
        role: "user",
        parts: [{ text: "Search for MCP tools" }],
      },
    },
  }),
}).then(r => r.json());`,
  },
  {
    icon: Braces,
    name: "Direct REST / curl",
    color: "text-rose-400",
    bgColor: "bg-rose-400/10",
    borderColor: "border-rose-400/20",
    description:
      "No SDK required. The REST API works from any language, any platform — curl, fetch, httpx, whatever you have. One POST with your API key and the tool name.",
    docsHref: "/docs",
    filename: "terminal",
    snippet: `# List all available tools
curl https://toolroute.ai/api/v1/tools

# Execute a tool
curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "tool": "tavily/search",
    "input": { "query": "best MCP servers 2026" }
  }'

# Check your key & balance
curl https://toolroute.ai/api/v1/key \\
  -H "Authorization: Bearer tr_your_api_key"`,
  },
];

export default function IntegrationsPage() {
  return (
    <div className="space-y-16 pb-16">
      {/* Hero */}
      <section className="text-center pt-12 pb-4">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4 leading-[1.1]">
          Works with <span className="text-accent">everything</span>
        </h1>
        <p className="text-text-dim max-w-2xl mx-auto text-sm sm:text-base leading-relaxed mb-8">
          One endpoint, every framework. Connect via MCP, OpenAI functions, A2A,
          or plain REST. Your agent calls tools the same way regardless of which
          framework it runs on.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold px-6 py-3 rounded-lg transition-colors text-sm"
          >
            <Key className="w-4 h-4" />
            Get Your API Key
          </Link>
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 border border-border hover:border-accent/40 text-text px-6 py-3 rounded-lg transition-colors text-sm"
          >
            <Code2 className="w-4 h-4" />
            Full API Reference
          </Link>
        </div>
      </section>

      {/* Protocol badges */}
      <section className="flex flex-wrap items-center justify-center gap-3">
        {[
          "MCP Streamable HTTP",
          "OpenAI Functions",
          "Google A2A",
          "REST / HTTP",
        ].map((proto) => (
          <span
            key={proto}
            className="text-[11px] font-mono border border-border rounded-full px-3 py-1 text-text-dim"
          >
            {proto}
          </span>
        ))}
      </section>

      {/* Integration Cards */}
      <section className="space-y-8">
        {integrations.map((intg, i) => {
          const Icon = intg.icon;
          return (
            <div
              key={i}
              className="border border-border rounded-lg bg-bg-card overflow-hidden"
            >
              <div className="grid lg:grid-cols-2 gap-0">
                {/* Left: info */}
                <div className="p-6 sm:p-8 flex flex-col">
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className={`w-10 h-10 rounded-lg ${intg.bgColor} border ${intg.borderColor} flex items-center justify-center shrink-0`}
                    >
                      <Icon className={`w-5 h-5 ${intg.color}`} />
                    </div>
                    <div>
                      <div className="text-[10px] text-accent font-mono mb-0.5">
                        {String(i + 1).padStart(2, "0")}
                      </div>
                      <h2 className="font-semibold text-base">{intg.name}</h2>
                    </div>
                  </div>
                  <p className="text-sm text-text-dim leading-relaxed mb-6">
                    {intg.description}
                  </p>

                  <div className="mt-auto">
                    <Link
                      href={intg.docsHref}
                      className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
                    >
                      View full docs <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>

                {/* Right: code snippet */}
                <div className="bg-[#0d0d18] border-t lg:border-t-0 lg:border-l border-border">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-bg-card/50">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red/40" />
                      <div className="w-2.5 h-2.5 rounded-full bg-amber/40" />
                      <div className="w-2.5 h-2.5 rounded-full bg-green/40" />
                    </div>
                    <span className="text-[10px] text-text-muted ml-2">
                      {intg.filename}
                    </span>
                    <button
                      className="ml-auto text-text-muted hover:text-text transition-colors"
                      title="Copy snippet"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <pre className="p-4 text-xs leading-relaxed overflow-x-auto max-h-[360px] overflow-y-auto">
                    <code className="text-text-dim">{intg.snippet}</code>
                  </pre>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* Bottom CTA */}
      <section className="border border-border rounded-lg bg-bg-card p-8 text-center">
        <h2 className="text-2xl font-bold mb-3">
          Don&apos;t see your framework?
        </h2>
        <p className="text-text-dim text-sm max-w-xl mx-auto leading-relaxed mb-6">
          The REST API works everywhere. If your framework can make an HTTP POST,
          it can use ToolRoute. No SDK, no adapter, no lock-in.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold px-6 py-3 rounded-lg transition-colors text-sm"
          >
            <Key className="w-4 h-4" />
            Get Started Free
          </Link>
          <Link
            href="/tools"
            className="inline-flex items-center gap-2 border border-border hover:border-accent/40 text-text px-6 py-3 rounded-lg transition-colors text-sm"
          >
            Browse All Tools
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
