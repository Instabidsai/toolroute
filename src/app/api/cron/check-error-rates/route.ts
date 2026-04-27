import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { CORS_HEADERS, supabaseAdmin } from "@/lib/gateway";
import {
  buildErrorRateAlerts,
  filterDedupedErrorAlerts,
  sendErrorRateAlertEmail,
} from "@/lib/error-alerts";

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

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("gateway_usage_log")
    .select("tool_slug, response_status")
    .gte("created_at", since)
    .limit(10000);

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

  const alerts = buildErrorRateAlerts(data ?? []);
  const { fresh, suppressed } = filterDedupedErrorAlerts(alerts);
  const sent = fresh.length ? await sendErrorRateAlertEmail(fresh) : true;

  if (fresh.length && !sent) {
    return NextResponse.json(
      {
        error: {
          message: "Failed to send error-rate alert email",
          code: "alert_email_failed",
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
      since,
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
