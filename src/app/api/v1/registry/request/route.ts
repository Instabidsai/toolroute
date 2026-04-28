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

    const { requested_by, company, need } = body as Record<string, unknown>;
    if (!requested_by || !company || !need) {
      return NextResponse.json(
        {
          error: {
            message: "Missing required fields: requested_by, company, need",
            code: "missing_fields",
          },
        },
        { status: 400, headers: AUTHED_RESPONSE_HEADERS }
      );
    }

    const sb = supabaseAdmin();
    const { data, error } = await sb.rpc("log_tool_request", {
      p_requested_by: requested_by,
      p_company: company,
      p_need: need,
    });

    if (error) {
      console.error("registry/request RPC error:", error.message);
      return NextResponse.json(
        { error: { message: "Request log failed", code: "rpc_error" } },
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
