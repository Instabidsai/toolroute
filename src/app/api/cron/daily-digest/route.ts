import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { CORS_HEADERS, supabaseAdmin } from "@/lib/gateway";
import {
  buildRevenueDigest,
  sendRevenueDigestEmail,
} from "@/lib/revenue-digest";

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

function getYesterdayWindow(now = new Date()) {
  const end = new Date(now);
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 1);
  return {
    start,
    end,
    label: start.toISOString().slice(0, 10),
  };
}

export async function GET(request: NextRequest) {
  if (!validateCron(request)) {
    return NextResponse.json(
      { error: { message: "Unauthorized", code: "cron_auth_required" } },
      { status: 401, headers: CRON_HEADERS }
    );
  }

  const window = getYesterdayWindow();
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("gateway_usage_log")
    .select("user_id, tool_slug, response_status, cost_to_user")
    .gte("created_at", window.start.toISOString())
    .lt("created_at", window.end.toISOString())
    .limit(20000);

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

  const digest = buildRevenueDigest(data ?? []);
  const sent = await sendRevenueDigestEmail(digest, window.label).catch(
    () => false
  );

  if (!sent) {
    return NextResponse.json(
      {
        error: {
          message: "Failed to send daily revenue digest email",
          code: "digest_email_failed",
        },
        digest,
      },
      { status: 503, headers: CRON_HEADERS }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      date: window.label,
      digest,
    },
    { headers: CRON_HEADERS }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CRON_HEADERS });
}
