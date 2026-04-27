import { NextRequest, NextResponse } from "next/server";
import { CORS_HEADERS } from "@/lib/gateway";
import {
  checkAbuseRateLimit,
  getClientIp,
  sendAbuseReportEmail,
  validateAbuseReport,
  type AbuseReportInput,
} from "@/lib/abuse-report";

function jsonError(message: string, code: string, status: number) {
  return NextResponse.json(
    { error: { message, code } },
    { status, headers: CORS_HEADERS }
  );
}

function wantsJson(request: NextRequest) {
  return request.headers.get("content-type")?.includes("application/json");
}

function redirectToForm(request: NextRequest, params: Record<string, string>) {
  const url = new URL("/abuse", request.url);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url, { status: 303 });
}

async function parseBody(request: NextRequest): Promise<AbuseReportInput> {
  if (wantsJson(request)) {
    return (await request.json()) as AbuseReportInput;
  }

  const formData = await request.formData();
  return {
    contact_email: formData.get("contact_email"),
    report_type: formData.get("report_type"),
    target: formData.get("target"),
    description: formData.get("description"),
    evidence_url: formData.get("evidence_url"),
  };
}

export async function POST(request: NextRequest) {
  let body: AbuseReportInput;
  try {
    body = await parseBody(request);
  } catch {
    return wantsJson(request)
      ? jsonError("Invalid request body", "invalid_body", 400)
      : redirectToForm(request, { error: "invalid_body" });
  }

  const validation = validateAbuseReport(body);
  if (!validation.ok) {
    return wantsJson(request)
      ? jsonError(validation.message, validation.code, 400)
      : redirectToForm(request, { error: validation.code });
  }

  const ip = getClientIp(request.headers);
  const rateLimit = checkAbuseRateLimit(ip);
  if (!rateLimit.allowed) {
    return wantsJson(request)
      ? jsonError("Too many abuse reports. Try again later.", "rate_limited", 429)
      : redirectToForm(request, { error: "rate_limited" });
  }

  const sent = await sendAbuseReportEmail(validation.report, ip).catch(
    () => false
  );

  if (!sent) {
    return wantsJson(request)
      ? jsonError("Abuse report email could not be sent", "email_failed", 503)
      : redirectToForm(request, { error: "email_failed" });
  }

  if (!wantsJson(request)) {
    return redirectToForm(request, { sent: "1" });
  }

  return NextResponse.json(
    {
      ok: true,
      remaining: rateLimit.remaining,
      reset_at: new Date(rateLimit.resetAt).toISOString(),
    },
    { status: 202, headers: CORS_HEADERS }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
