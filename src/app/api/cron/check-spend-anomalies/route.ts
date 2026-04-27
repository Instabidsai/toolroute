import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { CORS_HEADERS, supabaseAdmin } from "@/lib/gateway";
import {
  buildSpendAnomalyAlerts,
  filterDedupedSpendAlerts,
  sendSpendAnomalyEmail,
} from "@/lib/spend-anomalies";

export const runtime = "nodejs";

const CRON_HEADERS = { ...CORS_HEADERS, "Content-Type": "application/json" };

function validateCron(request: NextRequest) {
  const expected = process.env.CRON_SECRET || process.env.TOOLROUTE_CRON_SECRET;
  if (!expected) {
    return true;
  }

  const authorization = request.headers.get("authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (token.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

export async function GET(request: NextRequest) {
  if (!validateCron(request)) {
    return NextResponse.json(
      { error: { message: "Unauthorized", code: "cron_auth_required" } },
      { status: 401, headers: CRON_HEADERS }
    );
  }

  const now = new Date();
  const since = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("gateway_usage_log")
    .select("user_id, cost_to_user, created_at")
    .gte("created_at", since.toISOString())
    .lt("created_at", now.toISOString())
    .limit(50000);

  if (error) {
    return NextResponse.json(
      {
        error: {
          message: "Failed to read gateway usage log",
          code: "usage_query_failed",
        },
      },
      { status: 500, headers: CRON_HEADERS }
    );
  }

  const alerts = buildSpendAnomalyAlerts(data ?? [], now);
  const { fresh, suppressed } = filterDedupedSpendAlerts(alerts);
  const sent = fresh.length ? await sendSpendAnomalyEmail(fresh) : true;

  if (fresh.length && !sent) {
    return NextResponse.json(
      {
        error: {
          message: "Failed to send spend anomaly alert email",
          code: "spend_alert_email_failed",
        },
        alert_count: fresh.length,
        suppressed_count: suppressed.length,
      },
      { status: 503, headers: CRON_HEADERS }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      since: since.toISOString(),
      checked_rows: data?.length ?? 0,
      alert_count: fresh.length,
      suppressed_count: suppressed.length,
      alerts: fresh,
    },
    { headers: CRON_HEADERS }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CRON_HEADERS });
}
