import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ABUSE_REPORT_LIMIT,
  buildAbuseReportEmailText,
  checkAbuseRateLimit,
  resetAbuseRateLimitForTests,
  validateAbuseReport,
} from "@/lib/abuse-report";

describe("abuse report validation", () => {
  afterEach(() => {
    resetAbuseRateLimitForTests();
    vi.unstubAllEnvs();
  });

  it("accepts a valid abuse report", () => {
    const result = validateAbuseReport({
      contact_email: " Reporter@Example.com ",
      report_type: "security",
      target: "tr_live_abcd...",
      description: "This API key appears to be used for credential stuffing.",
      evidence_url: "https://example.com/evidence",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.report.contactEmail).toBe("reporter@example.com");
      expect(result.report.reportType).toBe("security");
    }
  });

  it("rejects invalid contact email and short descriptions", () => {
    expect(
      validateAbuseReport({
        contact_email: "not-email",
        description: "This is long enough to pass validation",
      })
    ).toMatchObject({ ok: false, code: "invalid_contact_email" });

    expect(validateAbuseReport({ description: "too short" })).toMatchObject({
      ok: false,
      code: "description_required",
    });
  });

  it("limits each IP to ten reports per hour", () => {
    for (let i = 0; i < ABUSE_REPORT_LIMIT; i += 1) {
      expect(checkAbuseRateLimit("203.0.113.10", 1000).allowed).toBe(true);
    }

    expect(checkAbuseRateLimit("203.0.113.10", 1000).allowed).toBe(false);
    expect(checkAbuseRateLimit("203.0.113.10", 3_700_001).allowed).toBe(true);
  });

  it("builds an email with report details", () => {
    const validation = validateAbuseReport({
      report_type: "spam",
      target: "/api/v1/execute",
      description: "This endpoint is being used for spam automation at scale.",
    });

    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    const text = buildAbuseReportEmailText(validation.report, "203.0.113.10");
    expect(text).toContain("Type: spam");
    expect(text).toContain("Target: /api/v1/execute");
    expect(text).toContain("Reporter IP: 203.0.113.10");
  });
});
