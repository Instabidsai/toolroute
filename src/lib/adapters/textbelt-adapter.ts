import type { ToolAdapter, AdapterResult } from "../gateway-types";
import { redactCreds } from "../redact-creds";
import { fetchWithTimeout } from "../fetch-with-timeout";
import { assertSafePublicUrl, SSRFError } from "../ssrf-guard";

const BASE_URL = "https://textbelt.com";
const DEFAULT_OPT_OUT_TEXT = "Reply STOP to opt out.";
const MAX_WEBHOOK_DATA_LENGTH = 100;

function getApiKey(byokKey?: string): string | null {
  return byokKey || process.env.TEXTBELT_API_KEY || null;
}

function withTestMode(apiKey: string, testMode: boolean): string {
  if (!testMode || apiKey.endsWith("_test")) return apiKey;
  return `${apiKey}_test`;
}

function normalizeMessage(message: string, sender: string): string {
  const trimmedSender = sender.trim();
  const trimmedMessage = message.trim();
  const identifiesSender = trimmedMessage
    .toLowerCase()
    .includes(trimmedSender.toLowerCase());
  const identifiedMessage = identifiesSender
    ? trimmedMessage
    : `${trimmedSender}: ${trimmedMessage}`;

  if (/\bSTOP\b/i.test(identifiedMessage)) {
    return identifiedMessage;
  }

  return `${identifiedMessage} ${DEFAULT_OPT_OUT_TEXT}`;
}

export const textbeltAdapter: ToolAdapter = {
  slug: "textbelt",
  name: "Textbelt",
  description:
    "Simple SMS sending with sender identity, consent attestation, STOP opt-out language, and delivery status checks",
  operations: ["send-sms", "check-status"],

  async execute(
    operation: string,
    input: Record<string, unknown>,
    byokKey?: string
  ): Promise<AdapterResult> {
    const apiKey = getApiKey(byokKey);
    if (!apiKey) {
      return {
        success: false,
        error:
          "No API key configured. Set TEXTBELT_API_KEY or provide your own key via BYOK.",
        provider: "textbelt",
      };
    }

    try {
      if (operation === "send-sms") {
        const phone = input.phone as string | undefined;
        const message = input.message as string | undefined;
        const sender = input.sender as string | undefined;
        const consentConfirmed = input.consent_confirmed === true;
        const testMode = input.test_mode === true;
        const replyWebhookUrl = input.replyWebhookUrl as string | undefined;
        const webhookData = input.webhookData as string | undefined;

        if (!phone || !message?.trim() || !sender?.trim()) {
          return {
            success: false,
            error: "Missing required fields: phone, message, sender",
            provider: "textbelt",
          };
        }

        if (!consentConfirmed) {
          return {
            success: false,
            error:
              "Missing required field: consent_confirmed must be true before sending SMS",
            provider: "textbelt",
          };
        }

        if (webhookData && webhookData.length > MAX_WEBHOOK_DATA_LENGTH) {
          return {
            success: false,
            error: "webhookData must be 100 characters or fewer",
            provider: "textbelt",
          };
        }

        if (replyWebhookUrl) {
          try {
            assertSafePublicUrl(replyWebhookUrl);
          } catch (err) {
            if (err instanceof SSRFError) {
              return {
                success: false,
                error: `Refused replyWebhookUrl: ${err.message}`,
                provider: "textbelt",
              };
            }
            throw err;
          }
        }

        const textbeltKey = withTestMode(apiKey, testMode);
        const normalizedMessage = normalizeMessage(message, sender);
        const body: Record<string, string> = {
          phone,
          message: normalizedMessage,
          key: textbeltKey,
          sender,
        };
        if (replyWebhookUrl) {
          body.replyWebhookUrl = replyWebhookUrl;
        }
        if (webhookData) {
          body.webhookData = webhookData;
        }

        const res = await fetchWithTimeout(`${BASE_URL}/text`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(
              `Textbelt send-sms failed: ${res.status} ${errText}`
            ),
            provider: "textbelt",
          };
        }

        const data = await res.json();
        if (!data.success) {
          return {
            success: false,
            error: redactCreds(
              `Textbelt send-sms rejected: ${data.error || "unknown error"}`
            ),
            provider: "textbelt",
          };
        }

        return {
          success: true,
          data: {
            textId: data.textId,
            quotaRemaining: data.quotaRemaining,
            test_mode: testMode,
            opt_out_included: true,
            reply_webhook_requested: Boolean(replyWebhookUrl),
          },
          provider: "textbelt",
          units_consumed: 1,
        };
      }

      if (operation === "check-status") {
        const text_id = input.text_id as string | undefined;
        if (!text_id) {
          return {
            success: false,
            error: "Missing required field: text_id",
            provider: "textbelt",
          };
        }

        const res = await fetchWithTimeout(
          `${BASE_URL}/status/${encodeURIComponent(text_id)}`
        );

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(
              `Textbelt check-status failed: ${res.status} ${errText}`
            ),
            provider: "textbelt",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data,
          provider: "textbelt",
          units_consumed: 0,
        };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "textbelt",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "textbelt" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    try {
      // Textbelt quota check endpoint works without a real key
      const res = await fetchWithTimeout(`${BASE_URL}/quota/textbelt`);
      return { healthy: res.ok, latency_ms: Date.now() - start };
    } catch {
      return { healthy: false, latency_ms: Date.now() - start };
    }
  },

  estimateCost(operation: string): number {
    if (operation === "send-sms") return 0.005;
    if (operation === "check-status") return 0;
    return 0.005;
  },
};
