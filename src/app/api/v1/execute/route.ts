import { NextRequest, NextResponse } from "next/server";
import {
  validateRequest,
  checkRateLimit,
  executeToolRequest,
  AUTHED_RESPONSE_HEADERS,
} from "@/lib/gateway";
import { GatewayError } from "@/lib/gateway-types";
import type { ExecuteRequest } from "@/lib/gateway-types";
import { assertBodyUnder, BODY_LIMITS } from "@/lib/body-limit";

export async function POST(request: NextRequest) {
  try {
    assertBodyUnder(request, BODY_LIMITS.execute);

    const authHeader = request.headers.get("authorization");
    const ctx = await validateRequest(authHeader);

    await checkRateLimit(ctx);

    let body: ExecuteRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { message: "Invalid JSON body", code: "invalid_json" } },
        { status: 400, headers: AUTHED_RESPONSE_HEADERS }
      );
    }

    if (!body.tool) {
      return NextResponse.json(
        {
          error: {
            message: 'Missing required field: "tool"',
            code: "missing_tool",
          },
        },
        { status: 400, headers: AUTHED_RESPONSE_HEADERS }
      );
    }

    if (!body.input || typeof body.input !== "object") {
      return NextResponse.json(
        {
          error: {
            message: 'Missing or invalid field: "input" must be an object',
            code: "missing_input",
          },
        },
        { status: 400, headers: AUTHED_RESPONSE_HEADERS }
      );
    }

    const result = await executeToolRequest(ctx, body.tool, body.input);

    if (!result.success) {
      return NextResponse.json(
        {
          id: result.request_id,
          tool: result.tool,
          provider: result.provider,
          error: { message: result.error, code: "adapter_error" },
          usage: {
            cost: 0,
            balance_remaining: ctx.creditBalance,
            latency_ms: result.latency_ms,
          },
        },
        { status: 500, headers: AUTHED_RESPONSE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        id: result.request_id,
        tool: result.tool,
        provider: result.provider,
        data: result.data,
        usage: {
          cost: result.cost,
          balance_remaining: ctx.creditBalance - result.cost,
          latency_ms: result.latency_ms,
        },
      },
      { status: 200, headers: AUTHED_RESPONSE_HEADERS }
    );
  } catch (err) {
    if (err instanceof GatewayError) {
      const headers = { ...AUTHED_RESPONSE_HEADERS };
      if (
        err.status === 429 &&
        "retryAfter" in (err as GatewayError & { retryAfter?: number })
      ) {
        headers["Retry-After"] = String(
          (err as GatewayError & { retryAfter: number }).retryAfter
        );
      }
      return NextResponse.json(
        { error: { message: err.message, code: err.code } },
        { status: err.status, headers }
      );
    }

    console.error("Gateway execute error:", err);
    return NextResponse.json(
      {
        error: {
          message: "Internal server error",
          code: "internal_error",
        },
      },
      { status: 500, headers: AUTHED_RESPONSE_HEADERS }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: AUTHED_RESPONSE_HEADERS });
}
