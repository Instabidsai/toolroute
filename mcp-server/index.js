#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://isbratmfnnzipzyoefbo.supabase.co";
// Public anon key — read-only. All write paths now go through the api-key-gated
// HTTPS gateway (see TOOLROUTE_BASE_URL/api/v1/registry/*).
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzYnJhdG1mbm56aXB6eW9lZmJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MzY0MTYsImV4cCI6MjA5MDIxMjQxNn0.GI565bgr2HCQfeRYMVrTUyB2gUlncdb6mx-DEoL9_Fs";

const TOOLROUTE_BASE_URL =
  process.env.TOOLROUTE_BASE_URL || "https://toolroute.ai";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const server = new McpServer({
  name: "toolroute",
  version: "1.1.0",
  description:
    "ToolRoute — The OpenRouter for Tools. 87+ curated tools for AI agents.",
});

function getApiKey(passed) {
  return passed || process.env.TOOLROUTE_API_KEY;
}

async function gatewayPost(path, body, apiKey) {
  const key = getApiKey(apiKey);
  if (!key) {
    return {
      content: [
        {
          type: "text",
          text: "Error: No ToolRoute API key. Pass api_key or set TOOLROUTE_API_KEY env var. Get one at https://toolroute.ai.",
        },
      ],
    };
  }
  try {
    const res = await fetch(`${TOOLROUTE_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      const errorMsg = data?.error?.message || `HTTP ${res.status}`;
      return {
        content: [
          {
            type: "text",
            text: `Error (${res.status}): ${errorMsg}\n\n${JSON.stringify(data, null, 2)}`,
          },
        ],
      };
    }
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  } catch (err) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
    };
  }
}

// ── check_before_build (read) ───────────────────────────────────────
server.tool(
  "check_before_build",
  "Check ToolRoute before building anything. Returns matching tools, installed inventory, category beliefs, and composites for a given task.",
  { task: z.string().describe("Describe what you need to build or accomplish") },
  async ({ task }) => {
    const { data, error } = await supabase.rpc("check_before_build", {
      p_task: task,
    });
    if (error) {
      console.error("mcp:check_before_build RPC error:", error.message);
      return { content: [{ type: "text", text: "Error: check_before_build failed" }] };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  }
);

// ── search_tools (read) ─────────────────────────────────────────────
server.tool(
  "search_tools",
  "Search the curated tool registry by name or capability.",
  {
    query: z.string().describe("Search query"),
    limit: z.number().optional().default(10).describe("Max results"),
  },
  async ({ query, limit }) => {
    const { data, error } = await supabase.rpc("search_tools_text", {
      p_query: query,
      p_limit: limit,
    });
    if (error) {
      console.error("mcp:search_tools RPC error:", error.message);
      return { content: [{ type: "text", text: "Error: search_tools failed" }] };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  }
);

// ── get_category_champion (read) ────────────────────────────────────
server.tool(
  "get_category_champion",
  "Get the champion tool for a specific category with belief confidence.",
  {
    super_category: z
      .string()
      .describe(
        "Super category: communication, crm_sales, scheduling, analytics, ecommerce, devops, finance, content, marketing, operations, security, infrastructure"
      ),
    sub_category: z
      .string()
      .describe("Sub category (e.g., browser_automation, payment_processing)"),
  },
  async ({ super_category, sub_category }) => {
    const { data, error } = await supabase.rpc("get_category_champion", {
      p_super: super_category,
      p_sub: sub_category,
    });
    if (error) {
      console.error("mcp:get_category_champion RPC error:", error.message);
      return { content: [{ type: "text", text: "Error: get_category_champion failed" }] };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  }
);

// ── librarian_status (read) ─────────────────────────────────────────
server.tool(
  "librarian_status",
  "Get full ToolRoute system status: tool count, beliefs, composites, inventory, recent usage.",
  {},
  async () => {
    const { data, error } = await supabase.rpc("librarian_startup");
    if (error) {
      console.error("mcp:librarian_status RPC error:", error.message);
      return { content: [{ type: "text", text: "Error: librarian_status failed" }] };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  }
);

// ── record_usage (write — gated) ────────────────────────────────────
server.tool(
  "record_usage",
  "Record a tool usage event — feeds the belief system. Requires a ToolRoute API key (Bearer-validated server-side).",
  {
    tool_slug: z.string().describe("Slug of the tool used"),
    company: z.string().describe("Company name"),
    action: z.string().describe("What action was performed"),
    outcome: z.enum(["success", "failure", "degraded", "partial"]),
    duration_ms: z.number().optional(),
    api_key: z
      .string()
      .optional()
      .describe("ToolRoute API key (tr_live_... / tr_test_...) — falls back to TOOLROUTE_API_KEY env"),
  },
  async ({ tool_slug, company, action, outcome, duration_ms, api_key }) =>
    gatewayPost(
      "/api/v1/registry/usage",
      { tool_slug, company, action, outcome, duration_ms },
      api_key
    )
);

// ── challenge_tool (write — gated) ──────────────────────────────────
server.tool(
  "challenge_tool",
  "Challenge a category champion. 8-dimension scores; must win 5 to dethrone. Requires a ToolRoute API key.",
  {
    challenger_slug: z.string(),
    sub_category: z.string(),
    scores: z.object({
      capability: z.number().min(1).max(10),
      protocols: z.number().min(1).max(10),
      cost: z.number().min(1).max(10),
      maturity: z.number().min(1).max(10),
      resale: z.number().min(1).max(10),
      reliability: z.number().min(1).max(10),
      ecosystem: z.number().min(1).max(10),
      agent_native: z.number().min(1).max(10),
    }),
    api_key: z.string().optional(),
  },
  async ({ challenger_slug, sub_category, scores, api_key }) =>
    gatewayPost(
      "/api/v1/registry/challenge",
      { challenger_slug, sub_category, scores },
      api_key
    )
);

// ── log_tool_request (write — gated) ────────────────────────────────
server.tool(
  "log_tool_request",
  "Log a tool gap — a need with no existing match. Requires a ToolRoute API key.",
  {
    requested_by: z.string().describe("Who needs this (session/agent name)"),
    company: z.string().describe("Which company needs it"),
    need: z.string().describe("What capability is needed"),
    api_key: z.string().optional(),
  },
  async ({ requested_by, company, need, api_key }) =>
    gatewayPost(
      "/api/v1/registry/request",
      { requested_by, company, need },
      api_key
    )
);

// ── execute (write — gated) ─────────────────────────────────────────
server.tool(
  "execute",
  "Execute any tool through the ToolRoute gateway. Supports all registered adapters. Use 'auto/route' with a task description for auto-routing.",
  {
    tool: z
      .string()
      .describe(
        'Tool path: "provider/operation" (e.g. "firecrawl/scrape", "auto/route", "claude/chat")'
      ),
    input: z.record(z.unknown()),
    api_key: z.string().optional(),
  },
  async ({ tool, input, api_key }) =>
    gatewayPost("/api/v1/execute", { tool, input }, api_key)
);

// ── Start ────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
