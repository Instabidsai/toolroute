export const ABUSE_REPORT_LIMIT = 10;
export const ABUSE_REPORT_WINDOW_MS = 60 * 60 * 1000;

const DEFAULT_FROM_EMAIL = "ToolRoute <onboarding@resend.dev>";
const DEFAULT_ADMIN_EMAIL = "support@toolroute.ai";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type AbuseBucket = {
  count: number;
  resetAt: number;
};

const abuseBuckets = new Map<string, AbuseBucket>();

export type AbuseReportInput = {
  contact_email?: unknown;
  report_type?: unknown;
  target?: unknown;
  description?: unknown;
  evidence_url?: unknown;
};

export type AbuseReport = {
  contactEmail: string | null;
  reportType: string;
  target: string | null;
  description: string;
  evidenceUrl: string | null;
};

export type AbuseValidationResult =
  | { ok: true; report: AbuseReport }
  | { ok: false; message: string; code: string };

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function validateAbuseReport(
  input: AbuseReportInput
): AbuseValidationResult {
  const contactEmail = normalizeString(input.contact_email).toLowerCase();
  const reportType = normalizeString(input.report_type) || "abuse";
  const target = normalizeString(input.target);
  const description = normalizeString(input.description);
  const evidenceUrl = normalizeString(input.evidence_url);

  if (contactEmail && !EMAIL_PATTERN.test(contactEmail)) {
    return {
      ok: false,
      message: "Enter a valid contact email or leave it blank",
      code: "invalid_contact_email",
    };
  }

  if (description.length < 20) {
    return {
      ok: false,
      message: "Describe the abuse report in at least 20 characters",
      code: "description_required",
    };
  }

  if (description.length > 5000) {
    return {
      ok: false,
      message: "Description must be 5,000 characters or fewer",
      code: "description_too_long",
    };
  }

  if (evidenceUrl) {
    try {
      const parsed = new URL(evidenceUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error("Unsupported URL protocol");
      }
    } catch {
      return {
        ok: false,
        message: "Evidence URL must be a valid http or https URL",
        code: "invalid_evidence_url",
      };
    }
  }

  return {
    ok: true,
    report: {
      contactEmail: contactEmail || null,
      reportType,
      target: target || null,
      description,
      evidenceUrl: evidenceUrl || null,
    },
  };
}

export function getClientIp(headers: Headers) {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return (
    headers.get("cf-connecting-ip") ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}

export function checkAbuseRateLimit(ip: string, now = Date.now()) {
  const existing = abuseBuckets.get(ip);
  if (!existing || existing.resetAt <= now) {
    abuseBuckets.set(ip, {
      count: 1,
      resetAt: now + ABUSE_REPORT_WINDOW_MS,
    });
    return {
      allowed: true,
      remaining: ABUSE_REPORT_LIMIT - 1,
      resetAt: now + ABUSE_REPORT_WINDOW_MS,
    };
  }

  if (existing.count >= ABUSE_REPORT_LIMIT) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: ABUSE_REPORT_LIMIT - existing.count,
    resetAt: existing.resetAt,
  };
}

export function buildAbuseReportEmailText(report: AbuseReport, ip: string) {
  return [
    "New ToolRoute abuse report.",
    "",
    `Type: ${report.reportType}`,
    `Contact: ${report.contactEmail || "not provided"}`,
    `Target: ${report.target || "not provided"}`,
    `Evidence: ${report.evidenceUrl || "not provided"}`,
    `Reporter IP: ${ip}`,
    "",
    "Description:",
    report.description,
  ].join("\n");
}

export async function sendAbuseReportEmail(report: AbuseReport, ip: string) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return false;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM_EMAIL,
      to:
        process.env.ABUSE_REPORT_TO_EMAIL ||
        process.env.ADMIN_EMAIL ||
        DEFAULT_ADMIN_EMAIL,
      reply_to: report.contactEmail || undefined,
      subject: `ToolRoute abuse report: ${report.reportType}`,
      text: buildAbuseReportEmailText(report, ip),
    }),
  });

  return response.ok;
}

export function resetAbuseRateLimitForTests() {
  abuseBuckets.clear();
}
