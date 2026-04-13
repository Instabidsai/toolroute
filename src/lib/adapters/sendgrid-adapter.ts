import type { ToolAdapter, AdapterResult } from "../gateway-types";

const BASE_URL = "https://api.sendgrid.com/v3";

function getApiKey(byokKey?: string): string | null {
  return byokKey || process.env.SENDGRID_API_KEY || null;
}

export const sendgridAdapter: ToolAdapter = {
  slug: "sendgrid",
  name: "SendGrid",
  description: "Email sending — deliver transactional and marketing emails",
  operations: ["send-email"],

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
          "No API key configured. Provide your own key via BYOK or contact support.",
        provider: "sendgrid",
      };
    }

    try {
      if (operation === "send-email") {
        const to = input.to as string;
        const from = input.from as string;
        const subject = input.subject as string;

        if (!to) {
          return {
            success: false,
            error: "Missing required field: to",
            provider: "sendgrid",
          };
        }
        if (!from) {
          return {
            success: false,
            error: "Missing required field: from",
            provider: "sendgrid",
          };
        }
        if (!subject) {
          return {
            success: false,
            error: "Missing required field: subject",
            provider: "sendgrid",
          };
        }

        const content: Array<{ type: string; value: string }> = [];
        if (input.text) {
          content.push({ type: "text/plain", value: input.text as string });
        }
        if (input.html) {
          content.push({ type: "text/html", value: input.html as string });
        }
        if (content.length === 0) {
          return {
            success: false,
            error:
              "At least one of 'text' or 'html' must be provided for email content",
            provider: "sendgrid",
          };
        }

        const body = {
          personalizations: [{ to: [{ email: to }] }],
          from: { email: from },
          subject,
          content,
        };

        const res = await fetch(`${BASE_URL}/mail/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
        });

        // SendGrid returns 202 on success with no body
        if (res.status === 202 || res.ok) {
          return {
            success: true,
            data: {
              message: "Email sent successfully",
              status: res.status,
            },
            provider: "sendgrid",
            units_consumed: 1,
          };
        }

        const errText = await res.text().catch(() => res.statusText);
        return {
          success: false,
          error: `SendGrid send-email failed: ${res.status} ${errText}`,
          provider: "sendgrid",
        };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "sendgrid",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "sendgrid" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    const apiKey = getApiKey();
    if (!apiKey) {
      return { healthy: false, latency_ms: Date.now() - start };
    }

    try {
      const res = await fetch(`${BASE_URL}/scopes`, {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
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
