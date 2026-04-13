import { NextRequest, NextResponse } from "next/server";
import {
  validateRequest,
  getUserFromSession,
  supabaseAdmin,
  CORS_HEADERS,
} from "@/lib/gateway";
import { GatewayError } from "@/lib/gateway-types";

async function resolveUserId(request: NextRequest): Promise<string> {
  const authHeader = request.headers.get("authorization");
  const rawToken = authHeader?.slice(7) ?? "";

  if (rawToken.startsWith("tr_live_") || rawToken.startsWith("tr_test_")) {
    const ctx = await validateRequest(authHeader);
    return ctx.userId;
  }

  const { userId } = await getUserFromSession(authHeader);
  return userId;
}

export async function GET(request: NextRequest) {
  try {
    const userId = await resolveUserId(request);
    const { searchParams } = new URL(request.url);

    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);
    const toolFilter = searchParams.get("tool");
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");

    const sb = supabaseAdmin();

    let query = sb
      .from("gateway_usage_log")
      .select(
        "id, tool_slug, provider_used, response_status, latency_ms, cost_to_user, error_message, created_at"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (toolFilter) {
      query = query.eq("tool_slug", toolFilter);
    }
    if (startDate) {
      query = query.gte("created_at", startDate);
    }
    if (endDate) {
      query = query.lte("created_at", endDate);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: { message: "Failed to fetch usage history", code: "usage_fetch_failed" } },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      {
        data: data ?? [],
        pagination: {
          limit,
          offset,
          count: data?.length ?? 0,
        },
      },
      { headers: CORS_HEADERS }
    );
  } catch (err) {
    if (err instanceof GatewayError) {
      return NextResponse.json(
        { error: { message: err.message, code: err.code } },
        { status: err.status, headers: CORS_HEADERS }
      );
    }

    console.error("Usage history error:", err);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "internal_error" } },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
