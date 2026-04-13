import { NextResponse } from "next/server";
import { supabaseAdmin, CORS_HEADERS } from "@/lib/gateway";

export async function GET() {
  try {
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

      const formatted = (fallback ?? []).map((t) => ({
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
      }));

      return NextResponse.json({ data: formatted }, { headers: CORS_HEADERS });
    }

    return NextResponse.json({ data: tools ?? [] }, { headers: CORS_HEADERS });
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

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
