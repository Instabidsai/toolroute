import type { ToolAdapter, AdapterResult } from "../gateway-types";
import { redactCreds } from "../redact-creds";
import { fetchWithTimeout } from "../fetch-with-timeout";

const BASE_URL = "https://textbelt.com";

function getApiKey(byokKey?: string): string | null {
  return byokKey || process.env.TEXTBELT_API_KEY || null;
}

export const textbeltAdapter: ToolAdapter = {
  slug: "textbelt",
  name: "Textbelt",
  description: "Simple cheap SMS sending and delivery status checking",
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
        if (!phone || !message) {
          return {
            success: false,
            error: "Missing required fields: phone, message",
            provider: "textbelt",
          };
        }

        const res = await fetchWithTimeout(`${BASE_URL}/text`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, message, key: apiKey }),
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
            error: `Textbelt send-sms rejected: ${data.error || "unknown error"}`,
            provider: "textbelt",
          };
        }

        return {
          success: true,
          data: {
            textId: data.textId,
            quotaRemaining: data.quotaRemaining,
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
