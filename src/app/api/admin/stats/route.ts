import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, CORS_HEADERS } from "@/lib/gateway";

const ADMIN_HEADERS = { ...CORS_HEADERS, "Content-Type": "application/json" };

function validateAdmin(request: NextRequest): boolean {
  const secret = request.headers.get("x-admin-secret");
  const expected = process.env.TOOLROUTE_ADMIN_SECRET;
  if (!expected || !secret) return false;
  return secret === expected;
}

/**
 * GET /api/admin/stats — Platform-wide revenue, COGS, margin, and usage breakdown
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
    const { searchParams } = new URL(request.url);
    const days = Math.min(parseInt(searchParams.get("days") ?? "30", 10), 365);
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceISO = since.toISOString();

    // Run all queries in parallel
    const [
      totalsResult,
      byToolResult,
      byKeySourceResult,
      topUsersResult,
    ] = await Promise.all([
      // 1. Total revenue, COGS, request count
      sb.rpc("admin_stats_totals", { p_since: sinceISO }),

      // 2. Requests by tool
      sb.rpc("admin_stats_by_tool", { p_since: sinceISO }),

      // 3. Key source split
      sb.rpc("admin_stats_by_key_source", { p_since: sinceISO }),

      // 4. Top users by spend
      sb.rpc("admin_stats_top_users", { p_since: sinceISO, p_limit: 20 }),
    ]);

    // If RPCs don't exist yet, fall back to direct queries
    let totals = totalsResult.data;
    let byTool = byToolResult.data;
    let byKeySource = byKeySourceResult.data;
    let topUsers = topUsersResult.data;

    // Fallback: if any RPC failed, do inline SQL via raw queries
    if (totalsResult.error || !totals) {
      const { data } = await sb
        .from("gateway_usage_log")
        .select("cost_to_user, cost_to_us, id")
        .gte("created_at", sinceISO);

      const rows = data ?? [];
      const totalRevenue = rows.reduce(
        (s, r) => s + (Number(r.cost_to_user) || 0), 0
      );
      const totalCogs = rows.reduce(
        (s, r) => s + (Number(r.cost_to_us) || 0), 0
      );
      totals = {
        total_requests: rows.length,
        total_revenue: totalRevenue,
        total_cogs: totalCogs,
        margin: totalRevenue - totalCogs,
      };
    }

    if (byToolResult.error || !byTool) {
      const { data } = await sb
        .from("gateway_usage_log")
        .select("tool_slug, cost_to_user, cost_to_us, response_status")
        .gte("created_at", sinceISO);

      const toolMap = new Map<
        string,
        { requests: number; revenue: number; cogs: number; errors: number }
      >();
      for (const row of data ?? []) {
        const entry = toolMap.get(row.tool_slug) ?? {
          requests: 0, revenue: 0, cogs: 0, errors: 0,
        };
        entry.requests++;
        entry.revenue += Number(row.cost_to_user) || 0;
        entry.cogs += Number(row.cost_to_us) || 0;
        if (row.response_status !== 200) entry.errors++;
        toolMap.set(row.tool_slug, entry);
      }
      byTool = Array.from(toolMap.entries())
        .map(([tool_slug, stats]) => ({ tool_slug, ...stats }))
        .sort((a, b) => b.requests - a.requests);
    }

    if (byKeySourceResult.error || !byKeySource) {
      const { data } = await sb
        .from("gateway_usage_log")
        .select("key_source, cost_to_user, cost_to_us")
        .gte("created_at", sinceISO);

      const srcMap = new Map<
        string,
        { requests: number; revenue: number; cogs: number }
      >();
      for (const row of data ?? []) {
        const src = row.key_source || "env_var";
        const entry = srcMap.get(src) ?? { requests: 0, revenue: 0, cogs: 0 };
        entry.requests++;
        entry.revenue += Number(row.cost_to_user) || 0;
        entry.cogs += Number(row.cost_to_us) || 0;
        srcMap.set(src, entry);
      }
      byKeySource = Array.from(srcMap.entries())
        .map(([key_source, stats]) => ({ key_source, ...stats }))
        .sort((a, b) => b.requests - a.requests);
    }

    if (topUsersResult.error || !topUsers) {
      const { data } = await sb
        .from("gateway_usage_log")
        .select("user_id, cost_to_user")
        .gte("created_at", sinceISO);

      const userMap = new Map<
        string,
        { requests: number; total_spend: number }
      >();
      for (const row of data ?? []) {
        const entry = userMap.get(row.user_id) ?? {
          requests: 0, total_spend: 0,
        };
        entry.requests++;
        entry.total_spend += Number(row.cost_to_user) || 0;
        userMap.set(row.user_id, entry);
      }
      topUsers = Array.from(userMap.entries())
        .map(([user_id, stats]) => ({ user_id, ...stats }))
        .sort((a, b) => b.total_spend - a.total_spend)
        .slice(0, 20);
    }

    return NextResponse.json(
      {
        period_days: days,
        since: sinceISO,
        totals,
        by_tool: byTool,
        by_key_source: byKeySource,
        top_users: topUsers,
      },
      { headers: ADMIN_HEADERS }
    );
  } catch (err) {
    console.error("Admin stats error:", err);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "internal_error" } },
      { status: 500, headers: ADMIN_HEADERS }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: ADMIN_HEADERS });
}
