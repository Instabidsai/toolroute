import type { ToolAdapter, AdapterResult } from "../gateway-types";
import { fetchWithTimeout } from "../fetch-with-timeout";
import { redactCreds } from "../redact-creds";

const BASE_URL = "https://api.resend.com";

function getApiKey(byokKey?: string): string | null {
  return byokKey || process.env.RESEND_API_KEY || null;
}

export const resendAdapter: ToolAdapter = {
  slug: "resend",
  name: "Resend",
  description:
    "Resend email delivery — send transactional emails and list sent email history",
  operations: ["send-email", "list-emails"],

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
          "No API key configured. Provide your own key via BYOK or set RESEND_API_KEY.",
        provider: "resend",
      };
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };

    try {
      if (operation === "send-email") {
        const from = input.from as string;
        const to = input.to as string | string[];
        const subject = input.subject as string;

        if (!from || !to || !subject) {
          return {
            success: false,
            error: "Missing required fields: from, to, subject",
            provider: "resend",
          };
        }

        const body: Record<string, unknown> = { from, to, subject };
        if (input.html) body.html = input.html;
        if (input.text) body.text = input.text;
        if (input.reply_to) body.reply_to = input.reply_to;
        if (input.cc) body.cc = input.cc;
        if (input.bcc) body.bcc = input.bcc;
        if (input.tags) body.tags = input.tags;

        const res = await fetchWithTimeout(`${BASE_URL}/emails`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          timeoutMs: 20_000,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Resend send-email failed: ${res.status} ${errText}`),
            provider: "resend",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data,
          provider: "resend",
          units_consumed: 1,
        };
      }

      if (operation === "list-emails") {
        const res = await fetchWithTimeout(`${BASE_URL}/emails`, {
          method: "GET",
          headers,
          timeoutMs: 15_000,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Resend list-emails failed: ${res.status} ${errText}`),
            provider: "resend",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data,
          provider: "resend",
          units_consumed: 1,
        };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "resend",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "resend" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    const apiKey = getApiKey();
    if (!apiKey) {
      return { healthy: false, latency_ms: Date.now() - start };
    }

    try {
      const res = await fetchWithTimeout(`${BASE_URL}/domains`, {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
        timeoutMs: 10_000,
      });
      return { healthy: res.ok, latency_ms: Date.now() - start };
    } catch {
      return { healthy: false, latency_ms: Date.now() - start };
    }
  },

  estimateCost(): number {
    return 0.001;
  },
};
