import { NextRequest, NextResponse } from "next/server";
import { validateRequest, checkRateLimit, supabaseAdmin, AUTHED_RESPONSE_HEADERS } from "@/lib/gateway";
import { GatewayError } from "@/lib/gateway-types";

export async function POST(request: NextRequest) {
  try {
    const ctx = await validateRequest(request.headers.get("authorization"));
    await checkRateLimit(ctx);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: { message: "Invalid JSON body", code: "invalid_json" } },
        { status: 400, headers: AUTHED_RESPONSE_HEADERS }
      );
    }

    const { tool_slug, company, action, outcome, duration_ms } = body as Record<string, unknown>;
    if (!tool_slug || !company || !action || !outcome) {
      return NextResponse.json(
        {
          error: {
            message: "Missing required fields: tool_slug, company, action, outcome",
            code: "missing_fields",
          },
        },
        { status: 400, headers: AUTHED_RESPONSE_HEADERS }
      );
    }
    if (!["success", "failure", "degraded", "partial"].includes(outcome as string)) {
      return NextResponse.json(
        { error: { message: "outcome must be success|failure|degraded|partial", code: "invalid_outcome" } },
        { status: 400, headers: AUTHED_RESPONSE_HEADERS }
      );
    }

    const sb = supabaseAdmin();
    const { data, error } = await sb.rpc("record_usage", {
      p_tool_slug: tool_slug,
      p_company: company,
      p_action: action,
      p_outcome: outcome,
      p_duration_ms: duration_ms ?? null,
    });

    if (error) {
      console.error("registry/usage RPC error:", error.message);
      return NextResponse.json(
        { error: { message: "Usage record failed", code: "rpc_error" } },
        { status: 500, headers: AUTHED_RESPONSE_HEADERS }
      );
    }

    return NextResponse.json(
      { ok: true, recorded_by: ctx.keyId, data },
      { status: 200, headers: AUTHED_RESPONSE_HEADERS }
    );
  } catch (err) {
    if (err instanceof GatewayError) {
      return NextResponse.json(
        { error: { message: err.message, code: err.code } },
        { status: err.status, headers: AUTHED_RESPONSE_HEADERS }
      );
    }
    return NextResponse.json(
      { error: { message: "Internal error", code: "internal_error" } },
      { status: 500, headers: AUTHED_RESPONSE_HEADERS }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: AUTHED_RESPONSE_HEADERS });
}
