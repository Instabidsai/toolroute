import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, CORS_HEADERS } from "@/lib/gateway";
import { listAdapters } from "@/lib/adapters/index";
import {
  getToolAvailability,
  listAvailableAdapters,
} from "@/lib/adapter-availability";
import { getToolOfferability } from "@/lib/provider-offerability";
import {
  AMBIGUOUS_DEFAULT_BYOK_SLUGS,
  BYOK_REQUIRED_SLUGS,
  BYOK_INSUFFICIENT_SLUGS,
} from "@/lib/byok-required-slugs";

function byokSuffix(slug: string): string {
  if (BYOK_REQUIRED_SLUGS.has(slug)) return " (BYOK required)";
  if (AMBIGUOUS_DEFAULT_BYOK_SLUGS.has(slug)) return " (BYOK required)";
  if (BYOK_INSUFFICIENT_SLUGS.has(slug)) return " (BYOK required)";
  return "";
}

function byokRequired(slug: string | null): boolean {
  if (!slug) return false;
  return (
    BYOK_REQUIRED_SLUGS.has(slug) ||
    AMBIGUOUS_DEFAULT_BYOK_SLUGS.has(slug) ||
    BYOK_INSUFFICIENT_SLUGS.has(slug)
  );
}

export async function GET(request: NextRequest) {
  try {
    const format = request.nextUrl.searchParams.get("format");

    // OpenAI function-calling format: generate from adapter registry
    if (format === "openai") {
      const adapters = listAvailableAdapters(listAdapters());
      const functions = [];

      for (const adapter of adapters) {
        for (const op of adapter.operations) {
          const funcName = `toolroute_${adapter.slug}_${op}`.replace(
            /[^a-zA-Z0-9_]/g,
            "_"
          );

          functions.push({
            type: "function" as const,
            function: {
              name: funcName,
              description: `${adapter.name}: ${op} — ${adapter.description}${byokSuffix(adapter.slug)}`,
              parameters: {
                type: "object" as const,
                properties: {
                  input: {
                    type: "object" as const,
                    description: `Input parameters for ${adapter.slug}/${op}`,
                  },
                },
                required: ["input"],
              },
            },
          });
        }
      }

      return NextResponse.json(functions, { headers: CORS_HEADERS });
    }

    // MCP tools/list format (JSON-RPC result shape)
    if (format === "mcp") {
      const adapters = listAvailableAdapters(listAdapters());
      const tools = [];
      for (const adapter of adapters) {
        for (const op of adapter.operations) {
          const toolName = `${adapter.slug}_${op}`.replace(
            /[^a-zA-Z0-9_-]/g,
            "_"
          );
          tools.push({
            name: toolName,
            description: `${adapter.name}: ${op}. ${adapter.description}${byokSuffix(adapter.slug)}`,
            inputSchema: {
              type: "object",
              properties: {
                input: {
                  type: "object",
                  description: `Input parameters for ${adapter.slug}/${op}`,
                  additionalProperties: true,
                },
              },
              required: ["input"],
              additionalProperties: false,
            },
          });
        }
      }
      return NextResponse.json(
        {
          protocolVersion: "2025-03-26",
          serverInfo: {
            name: "ToolRoute",
            version: "1.2.0",
            description:
              "The OpenRouter for Tools — 51 adapters, 150+ operations via one API",
          },
          tools,
        },
        { headers: CORS_HEADERS }
      );
    }

    // Anthropic tool-use format (messages.create tools param)
    if (format === "anthropic") {
      const adapters = listAvailableAdapters(listAdapters());
      const tools = [];
      for (const adapter of adapters) {
        for (const op of adapter.operations) {
          const toolName = `${adapter.slug}_${op}`.replace(
            /[^a-zA-Z0-9_-]/g,
            "_"
          );
          tools.push({
            name: toolName,
            description: `${adapter.name}: ${op} — ${adapter.description}${byokSuffix(adapter.slug)}`,
            input_schema: {
              type: "object",
              properties: {
                input: {
                  type: "object",
                  description: `Input parameters for ${adapter.slug}/${op}`,
                  additionalProperties: true,
                },
              },
              required: ["input"],
            },
          });
        }
      }
      return NextResponse.json(tools, { headers: CORS_HEADERS });
    }

    // Default: Supabase catalog format
    const sb = supabaseAdmin();

    const { data: tools, error } = await sb.rpc("get_tool_catalog");

    if (error) {
      const { data: fallback, error: fallbackErr } = await sb
        .from("tools")
        .select(
          "id, name, slug, description, capabilities, cost, status, super_category, sub_category"
        )
        .eq("status", "active")
        .order("rating", { ascending: false });

      if (fallbackErr) {
        return NextResponse.json(
          { error: { message: "Failed to fetch tool catalog", code: "catalog_error" } },
          { status: 500, headers: CORS_HEADERS }
        );
      }

      const formatted = (fallback ?? []).map((t) =>
        withAvailability({
          id: t.slug,
          name: t.name,
          description: t.description,
          operations: t.capabilities ?? [],
          pricing: parseCostString(t.cost),
          health: t.status === "active" ? "healthy" : "degraded",
          avg_latency_ms: null,
          category: {
            super: t.super_category,
            sub: t.sub_category,
          },
        })
      );

      return NextResponse.json(
        { data: formatted, tools: formatted },
        { headers: CORS_HEADERS }
      );
    }

    const formatted = (tools ?? []).map(withAvailability);

    return NextResponse.json(
      { data: formatted, tools: formatted },
      { headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("Tool catalog error:", err);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "internal_error" } },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

function parseCostString(cost: string | null): Record<string, unknown> {
  if (!cost) return { model: "free", free_tier: 0 };
  const lower = cost.toLowerCase();
  if (lower === "free" || lower === "free tier") {
    return { model: "free", free_tier: 0 };
  }
  if (lower.includes("per")) {
    return { model: "per_unit", description: cost, free_tier: 0 };
  }
  return { model: "paid", description: cost, free_tier: 0 };
}

function withAvailability<
  T extends {
    id?: unknown;
    slug?: unknown;
    tool_slug?: unknown;
    description?: unknown;
  },
>(tool: T) {
  const toolSlug =
    typeof tool.slug === "string"
      ? tool.slug
      : typeof tool.id === "string"
        ? tool.id
        : typeof tool.tool_slug === "string"
          ? tool.tool_slug
          : null;
  const availability = getToolAvailability(toolSlug);
  const offerability = getToolOfferability(toolSlug);
  // Disclose BYOK requirement on the canonical slug (not tool.id, which may
  // be a per-tool ID like "brave-search" mapping to adapter "search").
  const adapterSlug = availability.adapter_slug ?? toolSlug;
  const isByokRequired = byokRequired(adapterSlug);
  const baseDescription =
    typeof tool.description === "string" ? tool.description : null;
  const description =
    baseDescription !== null && isByokRequired
      ? `${baseDescription}${byokSuffix(adapterSlug ?? "")}`
      : baseDescription;

  return {
    ...tool,
    description: description ?? tool.description,
    status: availability.status,
    adapter_slug: availability.adapter_slug,
    access_mode: availability.access_mode,
    pool_available: availability.pool_available,
    byok_required: isByokRequired,
    offerability,
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
