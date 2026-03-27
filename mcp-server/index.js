#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://isbratmfnnzipzyoefbo.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzYnJhdG1mbm56aXB6eW9lZmJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MzY0MTYsImV4cCI6MjA5MDIxMjQxNn0.GI565bgr2HCQfeRYMVrTUyB2gUlncdb6mx-DEoL9_Fs";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const server = new McpServer({
  name: "toolroute",
  version: "1.0.0",
  description:
    "ToolRoute — The OpenRouter for Tools. 50 curated best-in-class tools for AI agents.",
});

// ── check_before_build ──────────────────────────────────────────────
server.tool(
  "check_before_build",
  "Check ToolRoute before building anything. Returns matching tools, installed inventory, category beliefs, and composites for a given task.",
  { task: z.string().describe("Describe what you need to build or accomplish") },
  async ({ task }) => {
    const { data, error } = await supabase.rpc("check_before_build", {
      p_task: task,
    });
    if (error)
      return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  }
);

// ── search_tools ────────────────────────────────────────────────────
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
    if (error)
      return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  }
);

// ── get_category_champion ───────────────────────────────────────────
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
    if (error)
      return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  }
);

// ── record_usage ────────────────────────────────────────────────────
server.tool(
  "record_usage",
  "Record a tool usage event. Feeds the belief system — success reinforces, failure weakens.",
  {
    tool_slug: z.string().describe("Slug of the tool used"),
    company: z.string().describe("Company name"),
    action: z.string().describe("What action was performed"),
    outcome: z
      .enum(["success", "failure", "degraded", "partial"])
      .describe("Outcome of the usage"),
    duration_ms: z
      .number()
      .optional()
      .describe("Duration in milliseconds"),
  },
  async ({ tool_slug, company, action, outcome, duration_ms }) => {
    const { data, error } = await supabase.rpc("record_usage", {
      p_tool_slug: tool_slug,
      p_company: company,
      p_action: action,
      p_outcome: outcome,
      p_duration_ms: duration_ms || null,
    });
    if (error)
      return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  }
);

// ── challenge_tool ──────────────────────────────────────────────────
server.tool(
  "challenge_tool",
  "Challenge the current champion of a sub-category with a new tool. 8-dimension scoring, must win 5 to dethrone.",
  {
    challenger_slug: z.string().describe("Slug of the challenger tool"),
    sub_category: z
      .string()
      .describe("Sub category to challenge in"),
    scores: z
      .object({
        capability: z.number().min(1).max(10),
        protocols: z.number().min(1).max(10),
        cost: z.number().min(1).max(10),
        maturity: z.number().min(1).max(10),
        resale: z.number().min(1).max(10),
        reliability: z.number().min(1).max(10),
        ecosystem: z.number().min(1).max(10),
        agent_native: z.number().min(1).max(10),
      })
      .describe("8-dimension scores for the challenger"),
  },
  async ({ challenger_slug, sub_category, scores }) => {
    const { data, error } = await supabase.rpc("challenge_tool", {
      p_challenger_slug: challenger_slug,
      p_sub_category: sub_category,
      p_scores: scores,
    });
    if (error)
      return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  }
);

// ── librarian_status ────────────────────────────────────────────────
server.tool(
  "librarian_status",
  "Get full ToolRoute system status: tool count, beliefs, composites, inventory, recent usage.",
  {},
  async () => {
    const { data, error } = await supabase.rpc("librarian_startup");
    if (error)
      return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  }
);

// ── log_tool_request ────────────────────────────────────────────────
server.tool(
  "log_tool_request",
  "Log a gap — when no tool exists for a need. Tracks unmet demands.",
  {
    requested_by: z.string().describe("Who needs this (session/agent name)"),
    company: z.string().describe("Which company needs it"),
    need: z.string().describe("What capability is needed"),
  },
  async ({ requested_by, company, need }) => {
    const { data, error } = await supabase.rpc("log_tool_request", {
      p_requested_by: requested_by,
      p_company: company,
      p_need: need,
    });
    if (error)
      return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return {
      content: [
        {
          type: "text",
          text: data
            ? JSON.stringify(data, null, 2)
            : "Tool request logged successfully.",
        },
      ],
    };
  }
);

// ── Start ────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
