import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const TEXTBELT_ADAPTER = resolve(
  process.cwd(),
  "src/lib/adapters/textbelt-adapter.ts"
);

describe("Textbelt SMS compliance guardrails", () => {
  const source = readFileSync(TEXTBELT_ADAPTER, "utf8");

  it("requires sender identity and consent attestation before send-sms", () => {
    expect(source).toContain("const sender = input.sender");
    expect(source).toContain("const consentConfirmed = input.consent_confirmed === true");
    expect(source).toContain("Missing required fields: phone, message, sender");
    expect(source).toContain("consent_confirmed must be true before sending SMS");
  });

  it("adds sender identification and STOP opt-out language to outbound messages", () => {
    expect(source).toContain("DEFAULT_OPT_OUT_TEXT = \"Reply STOP to opt out.\"");
    expect(source).toContain("normalizeMessage(message, sender)");
    expect(source).toContain("`${trimmedSender}: ${trimmedMessage}`");
    expect(source).toMatch(/\/\\bSTOP\\b\/i\.test\(identifiedMessage\)/);
  });

  it("supports Textbelt test keys and reply webhooks with SSRF protection", () => {
    expect(source).toContain("withTestMode(apiKey, testMode)");
    expect(source).toContain("`${apiKey}_test`");
    expect(source).toContain("const replyWebhookUrl = input.replyWebhookUrl");
    expect(source).toContain("assertSafePublicUrl(replyWebhookUrl)");
    expect(source).toContain("body.replyWebhookUrl = replyWebhookUrl");
  });

  it("keeps webhookData within Textbelt's documented 100 character limit", () => {
    expect(source).toContain("MAX_WEBHOOK_DATA_LENGTH = 100");
    expect(source).toContain("webhookData must be 100 characters or fewer");
    expect(source).toContain("body.webhookData = webhookData");
  });
});
