"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, FileJson, Network, Terminal } from "lucide-react";

type TabId = "curl" | "mcp" | "openai";

interface ToolCatalogResponse {
  count?: number;
  tools?: Array<{ status?: string }>;
  data?: Array<{ status?: string }>;
}

function readToolCount(payload: ToolCatalogResponse) {
  const tools = payload.tools ?? payload.data;
  if (Array.isArray(tools)) return tools.length;
  if (typeof payload.count === "number") return payload.count;
  return null;
}

function buildExamples(toolCount: number | null) {
  const countLine =
    typeof toolCount === "number"
      ? `# Live catalog currently reports ${toolCount} tools`
      : "# Live catalog count loads from /api/v1/tools";

  return {
    curl: {
      label: "curl",
      icon: Terminal,
      description: "List tools, then execute one provider operation.",
      code: `${countLine}
curl -s https://toolroute.ai/api/v1/tools

curl -s -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer $TOOLROUTE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "tool": "tavily/search",
    "input": {
      "query": "best MCP servers for AI agents",
      "max_results": 5
    }
  }'`,
    },
    mcp: {
      label: "MCP HTTP config",
      icon: Network,
      description: "Point any Streamable HTTP MCP client at the public gateway.",
      code: `{
  "mcpServers": {
    "toolroute": {
      "type": "streamable-http",
      "url": "https://toolroute.ai/mcp",
      "headers": {
        "Authorization": "Bearer \${TOOLROUTE_API_KEY}"
      }
    }
  }
}`,
    },
    openai: {
      label: "OpenAI Functions format",
      icon: FileJson,
      description: "Fetch ToolRoute's OpenAI-compatible tool schema at runtime.",
      code: `const tools = await fetch(
  "https://toolroute.ai/api/v1/tools?format=openai"
).then((response) => response.json());

// Pass tools into your OpenAI-compatible agent runtime.
// Tool names map to ToolRoute providers and operations.
console.log(tools[0].function.name);`,
    },
  };
}

export function AgentIntegrationTabs() {
  const [activeTab, setActiveTab] = useState<TabId>("curl");
  const [toolCount, setToolCount] = useState<number | null>(null);
  const [copiedTab, setCopiedTab] = useState<TabId | null>(null);
  const examples = useMemo(() => buildExamples(toolCount), [toolCount]);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/v1/tools")
      .then((response) => response.json())
      .then((payload: ToolCatalogResponse) => {
        if (!cancelled) setToolCount(readToolCount(payload));
      })
      .catch(() => {
        if (!cancelled) setToolCount(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const activeExample = examples[activeTab];

  async function copyActiveCode() {
    await navigator.clipboard.writeText(activeExample.code);
    setCopiedTab(activeTab);
    window.setTimeout(() => setCopiedTab(null), 1200);
  }

  return (
    <section
      aria-labelledby="agent-integration-examples"
      className="mb-16 border border-border rounded-lg bg-bg-card overflow-hidden"
    >
      <div className="p-5 border-b border-border flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            id="agent-integration-examples"
            className="text-2xl font-bold mb-2 flex items-center gap-2"
          >
            <Terminal className="w-5 h-5 text-accent" />
            Agent Copy-Paste Surface
          </h2>
          <p className="text-sm text-text-dim leading-relaxed">
            Three production entry points backed by the live tool catalog.
          </p>
        </div>
        <div className="inline-flex w-fit items-center rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
          {typeof toolCount === "number"
            ? `${toolCount} tools live`
            : "Live count loading"}
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Agent integration examples"
        className="grid grid-cols-1 sm:grid-cols-3 border-b border-border"
      >
        {(Object.keys(examples) as TabId[]).map((id) => {
          const example = examples[id];
          const Icon = example.icon;
          const selected = activeTab === id;

          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`agent-example-${id}`}
              id={`agent-example-tab-${id}`}
              onClick={() => setActiveTab(id)}
              className={`flex min-h-12 items-center justify-center gap-2 border-b sm:border-b-0 sm:border-r border-border px-4 py-3 text-sm font-medium transition-colors last:border-r-0 ${
                selected
                  ? "bg-accent/10 text-accent"
                  : "text-text-dim hover:bg-bg-surface hover:text-text"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{example.label}</span>
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`agent-example-${activeTab}`}
        aria-labelledby={`agent-example-tab-${activeTab}`}
      >
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-text-dim">{activeExample.description}</p>
          <button
            type="button"
            onClick={copyActiveCode}
            className="inline-flex w-fit items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-medium text-text-dim hover:border-accent/40 hover:text-accent transition-colors"
          >
            {copiedTab === activeTab ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            {copiedTab === activeTab ? "Copied" : "Copy"}
          </button>
        </div>
        <pre className="bg-[#0d0d18] border-t border-border px-5 py-4 text-xs leading-relaxed overflow-x-auto">
          <code className="text-text">{activeExample.code}</code>
        </pre>
      </div>
    </section>
  );
}
