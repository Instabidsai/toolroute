import { NextRequest, NextResponse } from "next/server";
import {
  getUserFromSession,
  generateApiKey,
  generateTestApiKey,
  supabaseAdmin,
  AUTHED_RESPONSE_HEADERS,
} from "@/lib/gateway";
import { GatewayError } from "@/lib/gateway-types";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const { userId } = await getUserFromSession(authHeader);

    let body: { name?: string; allowed_tools?: string[]; expires_in_days?: number };
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const keyName = body.name || "Default Key";

    const sb = supabaseAdmin();

    const { data: planRow, error: planError } = await sb
      .from("gateway_users")
      .select("plan_slug")
      .eq("id", userId)
      .single();

    if (planError || !planRow) {
      return NextResponse.json(
        { error: { message: "User not found", code: "user_not_found" } },
        { status: 404, headers: AUTHED_RESPONSE_HEADERS }
      );
    }

    const planSlug = (planRow.plan_slug as string | null) ?? "free";
    const isPaidPlan = planSlug !== "free";
    const { raw, hash, prefix } = isPaidPlan ? generateApiKey() : generateTestApiKey();

    let expiresAt: string | null = null;
    if (body.expires_in_days && body.expires_in_days > 0) {
      const d = new Date();
      d.setDate(d.getDate() + body.expires_in_days);
      expiresAt = d.toISOString();
    }

    const { data: keyRow, error } = await sb
      .from("api_keys")
      .insert({
        user_id: userId,
        name: keyName,
        key_hash: hash,
        key_prefix: prefix,
        allowed_tools: body.allowed_tools ?? null,
        is_active: true,
        expires_at: expiresAt,
      })
      .select("id, name, key_prefix, allowed_tools, is_active, created_at, expires_at")
      .single();

    if (error) {
      console.error("API key creation error:", error);
      return NextResponse.json(
        { error: { message: "Failed to create API key", code: "key_creation_failed" } },
        { status: 500, headers: AUTHED_RESPONSE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        key: raw,
        id: keyRow.id,
        name: keyRow.name,
        prefix: keyRow.key_prefix,
        allowed_tools: keyRow.allowed_tools,
        expires_at: keyRow.expires_at,
        created_at: keyRow.created_at,
        warning: "Store this key securely. It cannot be retrieved again.",
      },
      { status: 201, headers: AUTHED_RESPONSE_HEADERS }
    );
  } catch (err) {
    if (err instanceof GatewayError) {
      return NextResponse.json(
        { error: { message: err.message, code: err.code } },
        { status: err.status, headers: AUTHED_RESPONSE_HEADERS }
      );
    }

    console.error("Key creation error:", err);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "internal_error" } },
      { status: 500, headers: AUTHED_RESPONSE_HEADERS }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const { userId } = await getUserFromSession(authHeader);

    const sb = supabaseAdmin();

    const { data: keys, error } = await sb
      .from("api_keys")
      .select(
        "id, name, key_prefix, allowed_tools, is_active, last_used_at, created_at, expires_at"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: { message: "Failed to list API keys", code: "list_keys_failed" } },
        { status: 500, headers: AUTHED_RESPONSE_HEADERS }
      );
    }

    return NextResponse.json({ data: keys ?? [] }, { headers: AUTHED_RESPONSE_HEADERS });
  } catch (err) {
    if (err instanceof GatewayError) {
      return NextResponse.json(
        { error: { message: err.message, code: err.code } },
        { status: err.status, headers: AUTHED_RESPONSE_HEADERS }
      );
    }

    console.error("Key list error:", err);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "internal_error" } },
      { status: 500, headers: AUTHED_RESPONSE_HEADERS }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const { userId } = await getUserFromSession(authHeader);

    let body: { key_id?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { message: "Invalid JSON body", code: "invalid_json" } },
        { status: 400, headers: AUTHED_RESPONSE_HEADERS }
      );
    }

    if (!body.key_id) {
      return NextResponse.json(
        { error: { message: 'Missing required field: "key_id"', code: "missing_key_id" } },
        { status: 400, headers: AUTHED_RESPONSE_HEADERS }
      );
    }

    const sb = supabaseAdmin();

    const { data: existing } = await sb
      .from("api_keys")
      .select("id")
      .eq("id", body.key_id)
      .eq("user_id", userId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: { message: "API key not found", code: "key_not_found" } },
        { status: 404, headers: AUTHED_RESPONSE_HEADERS }
      );
    }

    const { error } = await sb
      .from("api_keys")
      .update({ is_active: false })
      .eq("id", body.key_id)
      .eq("user_id", userId);

    if (error) {
      return NextResponse.json(
        { error: { message: "Failed to revoke API key", code: "revoke_failed" } },
        { status: 500, headers: AUTHED_RESPONSE_HEADERS }
      );
    }

    return NextResponse.json(
      { message: "API key revoked", key_id: body.key_id },
      { headers: AUTHED_RESPONSE_HEADERS }
    );
  } catch (err) {
    if (err instanceof GatewayError) {
      return NextResponse.json(
        { error: { message: err.message, code: err.code } },
        { status: err.status, headers: AUTHED_RESPONSE_HEADERS }
      );
    }

    console.error("Key revoke error:", err);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "internal_error" } },
      { status: 500, headers: AUTHED_RESPONSE_HEADERS }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const { userId } = await getUserFromSession(authHeader);

    let body: { key_id?: string; name?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { message: "Invalid JSON body", code: "invalid_json" } },
        { status: 400, headers: AUTHED_RESPONSE_HEADERS }
      );
    }

    const keyId = typeof body.key_id === "string" ? body.key_id.trim() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!keyId) {
      return NextResponse.json(
        { error: { message: 'Missing required field: "key_id"', code: "missing_key_id" } },
        { status: 400, headers: AUTHED_RESPONSE_HEADERS }
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: { message: 'Missing required field: "name"', code: "missing_name" } },
        { status: 400, headers: AUTHED_RESPONSE_HEADERS }
      );
    }

    if (name.length > 80) {
      return NextResponse.json(
        { error: { message: "Key name must be 80 characters or fewer", code: "name_too_long" } },
        { status: 400, headers: AUTHED_RESPONSE_HEADERS }
      );
    }

    const sb = supabaseAdmin();

    const { data: existing } = await sb
      .from("api_keys")
      .select("id")
      .eq("id", keyId)
      .eq("user_id", userId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: { message: "API key not found", code: "key_not_found" } },
        { status: 404, headers: AUTHED_RESPONSE_HEADERS }
      );
    }

    const { data: keyRow, error } = await sb
      .from("api_keys")
      .update({ name })
      .eq("id", keyId)
      .eq("user_id", userId)
      .select("id, name, key_prefix, allowed_tools, is_active, last_used_at, created_at, expires_at")
      .single();

    if (error) {
      return NextResponse.json(
        { error: { message: "Failed to rename API key", code: "rename_failed" } },
        { status: 500, headers: AUTHED_RESPONSE_HEADERS }
      );
    }

    return NextResponse.json({ data: keyRow }, { headers: AUTHED_RESPONSE_HEADERS });
  } catch (err) {
    if (err instanceof GatewayError) {
      return NextResponse.json(
        { error: { message: err.message, code: err.code } },
        { status: err.status, headers: AUTHED_RESPONSE_HEADERS }
      );
    }

    console.error("Key rename error:", err);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "internal_error" } },
      { status: 500, headers: AUTHED_RESPONSE_HEADERS }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: AUTHED_RESPONSE_HEADERS });
}
