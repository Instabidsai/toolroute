import { NextRequest, NextResponse } from "next/server";
import { validateRequest, checkRateLimit, supabaseAdmin, AUTHED_RESPONSE_HEADERS } from "@/lib/gateway";
import { GatewayError } from "@/lib/gateway-types";

const SCORE_DIMS = [
  "capability",
  "protocols",
  "cost",
  "maturity",
  "resale",
  "reliability",
  "ecosystem",
  "agent_native",
] as const;

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

    const { challenger_slug, sub_category, scores } = body as Record<string, unknown>;
    if (!challenger_slug || !sub_category || !scores || typeof scores !== "object") {
      return NextResponse.json(
        {
          error: {
            message: "Missing required fields: challenger_slug, sub_category, scores",
            code: "missing_fields",
          },
        },
        { status: 400, headers: AUTHED_RESPONSE_HEADERS }
      );
    }
    const s = scores as Record<string, number>;
    for (const dim of SCORE_DIMS) {
      const v = s[dim];
      if (typeof v !== "number" || v < 1 || v > 10) {
        return NextResponse.json(
          {
            error: {
              message: `scores.${dim} must be a number 1-10`,
              code: "invalid_score",
            },
          },
          { status: 400, headers: AUTHED_RESPONSE_HEADERS }
        );
      }
    }

    const sb = supabaseAdmin();
    const { data, error } = await sb.rpc("challenge_tool", {
      p_challenger_slug: challenger_slug,
      p_sub_category: sub_category,
      p_scores: scores,
    });

    if (error) {
      console.error("registry/challenge RPC error:", error.message);
      return NextResponse.json(
        { error: { message: "Challenge failed", code: "rpc_error" } },
        { status: 500, headers: AUTHED_RESPONSE_HEADERS }
      );
    }

    return NextResponse.json(
      { ok: true, challenged_by: ctx.keyId, data },
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
