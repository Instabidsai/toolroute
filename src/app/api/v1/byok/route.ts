import { NextRequest, NextResponse } from "next/server";
import { getUserFromSession, supabaseAdmin, AUTHED_RESPONSE_HEADERS } from "@/lib/gateway";
import { GatewayError } from "@/lib/gateway-types";
import { assertBodyUnder, BODY_LIMITS } from "@/lib/body-limit";

export async function POST(request: NextRequest) {
  try {
    assertBodyUnder(request, BODY_LIMITS.byok);

    const authHeader = request.headers.get("authorization");
    const { userId } = await getUserFromSession(authHeader);

    const body = await request.json();
    const { tool_slug, api_key } = body as { tool_slug?: string; api_key?: string };

    if (!tool_slug || !api_key) {
      return NextResponse.json(
        { error: { message: "Missing required fields: tool_slug, api_key", code: "missing_fields" } },
        { status: 400, headers: AUTHED_RESPONSE_HEADERS }
      );
    }

    const sb = supabaseAdmin();

    const { data, error } = await sb
      .from("user_provider_keys")
      .upsert(
        {
          user_id: userId,
          tool_slug,
          api_key_encrypted: api_key, // TODO: encrypt with KMS
          is_active: true,
          prefer_own_key: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,tool_slug" }
      )
      .select("id, tool_slug, is_active, prefer_own_key, created_at")
      .single();

    if (error) {
      console.error("BYOK save error:", error);
      return NextResponse.json(
        { error: { message: "Failed to save provider key", code: "save_failed" } },
        { status: 500, headers: AUTHED_RESPONSE_HEADERS }
      );
    }

    return NextResponse.json(
      { message: "Provider key saved", data },
      { status: 201, headers: AUTHED_RESPONSE_HEADERS }
    );
  } catch (err) {
    if (err instanceof GatewayError) {
      return NextResponse.json(
        { error: { message: err.message, code: err.code } },
        { status: err.status, headers: AUTHED_RESPONSE_HEADERS }
      );
    }
    console.error("BYOK error:", err);
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

    const { data, error } = await sb
      .from("user_provider_keys")
      .select("id, tool_slug, is_active, prefer_own_key, created_at, updated_at")
      .eq("user_id", userId)
      .order("tool_slug");

    if (error) {
      return NextResponse.json(
        { error: { message: "Failed to list provider keys", code: "list_failed" } },
        { status: 500, headers: AUTHED_RESPONSE_HEADERS }
      );
    }

    return NextResponse.json({ data: data ?? [] }, { headers: AUTHED_RESPONSE_HEADERS });
  } catch (err) {
    if (err instanceof GatewayError) {
      return NextResponse.json(
        { error: { message: err.message, code: err.code } },
        { status: err.status, headers: AUTHED_RESPONSE_HEADERS }
      );
    }
    return NextResponse.json(
      { error: { message: "Internal server error", code: "internal_error" } },
      { status: 500, headers: AUTHED_RESPONSE_HEADERS }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    assertBodyUnder(request, BODY_LIMITS.byok);

    const authHeader = request.headers.get("authorization");
    const { userId } = await getUserFromSession(authHeader);

    const body = await request.json();
    const { tool_slug } = body as { tool_slug?: string };

    if (!tool_slug) {
      return NextResponse.json(
        { error: { message: "Missing required field: tool_slug", code: "missing_field" } },
        { status: 400, headers: AUTHED_RESPONSE_HEADERS }
      );
    }

    const sb = supabaseAdmin();

    await sb
      .from("user_provider_keys")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("tool_slug", tool_slug);

    return NextResponse.json(
      { message: "Provider key removed", tool_slug },
      { headers: AUTHED_RESPONSE_HEADERS }
    );
  } catch (err) {
    if (err instanceof GatewayError) {
      return NextResponse.json(
        { error: { message: err.message, code: err.code } },
        { status: err.status, headers: AUTHED_RESPONSE_HEADERS }
      );
    }
    return NextResponse.json(
      { error: { message: "Internal server error", code: "internal_error" } },
      { status: 500, headers: AUTHED_RESPONSE_HEADERS }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: AUTHED_RESPONSE_HEADERS });
}
