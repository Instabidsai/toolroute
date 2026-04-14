import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin, CORS_HEADERS } from "@/lib/gateway";

const ADMIN_HEADERS = { ...CORS_HEADERS, "Content-Type": "application/json" };

function validateAdmin(request: NextRequest): boolean {
  const secret = request.headers.get("x-admin-secret");
  const expected = process.env.TOOLROUTE_ADMIN_SECRET;
  if (!expected || !secret) return false;
  if (secret.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(secret), Buffer.from(expected));
}

/**
 * POST /api/admin/providers — Register or update a master provider key
 */
export async function POST(request: NextRequest) {
  if (!validateAdmin(request)) {
    return NextResponse.json(
      { error: { message: "Unauthorized", code: "admin_auth_required" } },
      { status: 401, headers: ADMIN_HEADERS }
    );
  }

  try {
    const body = await request.json();
    const {
      tool_slug,
      provider_name,
      api_key,
      api_base_url,
      auth_type,
      auth_header_name,
      cost_per_call,
      cost_model,
      cost_unit,
      markup_percent,
    } = body;

    if (!tool_slug) {
      return NextResponse.json(
        { error: { message: "tool_slug is required", code: "missing_field" } },
        { status: 400, headers: ADMIN_HEADERS }
      );
    }

    if (!api_key) {
      return NextResponse.json(
        { error: { message: "api_key is required", code: "missing_field" } },
        { status: 400, headers: ADMIN_HEADERS }
      );
    }

    const sb = supabaseAdmin();

    // Check if provider already exists (active or inactive)
    const { data: existing } = await sb
      .from("tool_providers")
      .select("id")
      .eq("tool_slug", tool_slug)
      .single();

    if (existing) {
      // Update existing provider
      const updateFields: Record<string, unknown> = {
        auth_key_encrypted: api_key,
        is_active: true,
        updated_at: new Date().toISOString(),
      };
      if (provider_name !== undefined) updateFields.provider_name = provider_name;
      if (api_base_url !== undefined) updateFields.api_base_url = api_base_url;
      if (auth_type !== undefined) updateFields.auth_type = auth_type;
      if (auth_header_name !== undefined) updateFields.auth_header_name = auth_header_name;
      if (cost_per_call !== undefined) updateFields.cost_per_call = cost_per_call;
      if (cost_model !== undefined) updateFields.cost_model = cost_model;
      if (cost_unit !== undefined) updateFields.cost_unit = cost_unit;
      if (markup_percent !== undefined) updateFields.markup_percent = markup_percent;

      const { error } = await sb
        .from("tool_providers")
        .update(updateFields)
        .eq("id", existing.id);

      if (error) {
        return NextResponse.json(
          { error: { message: "Failed to update provider: " + error.message, code: "update_failed" } },
          { status: 500, headers: ADMIN_HEADERS }
        );
      }

      return NextResponse.json(
        { success: true, action: "updated", tool_slug },
        { headers: ADMIN_HEADERS }
      );
    }

    // Insert new provider
    const { error } = await sb.from("tool_providers").insert({
      tool_slug,
      provider_name: provider_name || tool_slug,
      api_base_url: api_base_url || null,
      auth_type: auth_type || "bearer",
      auth_key_encrypted: api_key,
      auth_header_name: auth_header_name || "Authorization",
      cost_per_call: cost_per_call ?? 0,
      cost_model: cost_model || "per_call",
      cost_unit: cost_unit || null,
      markup_percent: markup_percent ?? 10,
      is_active: true,
    });

    if (error) {
      return NextResponse.json(
        { error: { message: "Failed to insert provider: " + error.message, code: "insert_failed" } },
        { status: 500, headers: ADMIN_HEADERS }
      );
    }

    return NextResponse.json(
      { success: true, action: "created", tool_slug },
      { status: 201, headers: ADMIN_HEADERS }
    );
  } catch (err) {
    console.error("Admin providers POST error:", err);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "internal_error" } },
      { status: 500, headers: ADMIN_HEADERS }
    );
  }
}

/**
 * GET /api/admin/providers — List all registered providers (keys redacted)
 */
export async function GET(request: NextRequest) {
  if (!validateAdmin(request)) {
    return NextResponse.json(
      { error: { message: "Unauthorized", code: "admin_auth_required" } },
      { status: 401, headers: ADMIN_HEADERS }
    );
  }

  try {
    const sb = supabaseAdmin();

    const { data, error } = await sb
      .from("tool_providers")
      .select(
        "id, tool_slug, provider_name, api_base_url, auth_type, auth_header_name, " +
        "cost_per_call, cost_model, cost_unit, markup_percent, is_active, " +
        "health_status, last_health_check, avg_latency_ms, error_rate_24h, " +
        "created_at, updated_at"
      )
      .order("tool_slug");

    if (error) {
      return NextResponse.json(
        { error: { message: "Failed to fetch providers: " + error.message, code: "fetch_failed" } },
        { status: 500, headers: ADMIN_HEADERS }
      );
    }

    // Redact keys — just indicate whether one is set
    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    const providers = rows.map((p) => ({
      ...p,
      has_master_key: true, // all rows in tool_providers have keys
    }));

    return NextResponse.json(
      { data: providers, count: providers.length },
      { headers: ADMIN_HEADERS }
    );
  } catch (err) {
    console.error("Admin providers GET error:", err);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "internal_error" } },
      { status: 500, headers: ADMIN_HEADERS }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: ADMIN_HEADERS });
}
