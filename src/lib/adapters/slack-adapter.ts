import type { ToolAdapter, AdapterResult } from "../gateway-types";
import { redactCreds } from "../redact-creds";
import { fetchWithTimeout } from "../fetch-with-timeout";

const SLACK_API_URL = "https://slack.com/api";

function getBotToken(byokKey?: string): string | null {
  return byokKey || process.env.SLACK_BOT_TOKEN || null;
}

export const slackAdapter: ToolAdapter = {
  slug: "slack",
  name: "Slack",
  description:
    "Send messages, read channels, reply to threads, list channels via the Slack Web API.",
  operations: ["send-message", "read-channel", "list-channels", "reply-thread"],

  async execute(
    operation: string,
    input: Record<string, unknown>,
    byokKey?: string
  ): Promise<AdapterResult> {
    const token = getBotToken(byokKey);
    if (!token) {
      return {
        success: false,
        error:
          "No API key configured. Set SLACK_BOT_TOKEN or provide your own key via BYOK.",
        provider: "slack",
      };
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    try {
      if (operation === "send-message") {
        const channel = input.channel as string;
        const text = input.text as string;
        if (!channel) {
          return {
            success: false,
            error: "Missing required field: channel (channel ID or name like #general)",
            provider: "slack",
          };
        }
        if (!text) {
          return {
            success: false,
            error: "Missing required field: text",
            provider: "slack",
          };
        }

        const body: Record<string, unknown> = { channel, text };
        if (input.blocks && Array.isArray(input.blocks)) {
          body.blocks = input.blocks;
        }

        const res = await fetchWithTimeout(`${SLACK_API_URL}/chat.postMessage`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Slack send-message HTTP failed: ${res.status} ${errText}`),
            provider: "slack",
          };
        }

        const data = await res.json();
        if (!data.ok) {
          return {
            success: false,
            error: `Slack send-message API error: ${data.error}`,
            provider: "slack",
          };
        }

        return {
          success: true,
          data,
          provider: "slack",
          units_consumed: 1,
        };
      }

      if (operation === "reply-thread") {
        const channel = input.channel as string;
        const threadTs = input.thread_ts as string;
        const text = input.text as string;

        if (!channel) {
          return {
            success: false,
            error: "Missing required field: channel",
            provider: "slack",
          };
        }
        if (!threadTs) {
          return {
            success: false,
            error: "Missing required field: thread_ts",
            provider: "slack",
          };
        }
        if (!text) {
          return {
            success: false,
            error: "Missing required field: text",
            provider: "slack",
          };
        }

        const body: Record<string, unknown> = {
          channel,
          text,
          thread_ts: threadTs,
        };

        const res = await fetchWithTimeout(`${SLACK_API_URL}/chat.postMessage`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Slack reply-thread HTTP failed: ${res.status} ${errText}`),
            provider: "slack",
          };
        }

        const data = await res.json();
        if (!data.ok) {
          return {
            success: false,
            error: `Slack reply-thread API error: ${data.error}`,
            provider: "slack",
          };
        }

        return {
          success: true,
          data,
          provider: "slack",
          units_consumed: 1,
        };
      }

      if (operation === "read-channel") {
        const channel = input.channel as string;
        if (!channel) {
          return {
            success: false,
            error: "Missing required field: channel (channel ID)",
            provider: "slack",
          };
        }

        const limit = (input.limit as number) ?? 10;
        const params = new URLSearchParams({
          channel,
          limit: String(limit),
        });

        const res = await fetchWithTimeout(
          `${SLACK_API_URL}/conversations.history?${params}`,
          { headers }
        );

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Slack read-channel HTTP failed: ${res.status} ${errText}`),
            provider: "slack",
          };
        }

        const data = await res.json();
        if (!data.ok) {
          return {
            success: false,
            error: `Slack read-channel API error: ${data.error}`,
            provider: "slack",
          };
        }

        return {
          success: true,
          data,
          provider: "slack",
          units_consumed: 1,
        };
      }

      if (operation === "list-channels") {
        const limit = (input.limit as number) ?? 100;
        const params = new URLSearchParams({
          limit: String(limit),
          types: "public_channel",
        });

        const res = await fetchWithTimeout(
          `${SLACK_API_URL}/conversations.list?${params}`,
          { headers }
        );

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Slack list-channels HTTP failed: ${res.status} ${errText}`),
            provider: "slack",
          };
        }

        const data = await res.json();
        if (!data.ok) {
          return {
            success: false,
            error: `Slack list-channels API error: ${data.error}`,
            provider: "slack",
          };
        }

        return {
          success: true,
          data,
          provider: "slack",
          units_consumed: 1,
        };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "slack",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "slack" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    const token = getBotToken();
    if (!token) {
      return { healthy: false, latency_ms: Date.now() - start };
    }

    try {
      const res = await fetchWithTimeout(`${SLACK_API_URL}/auth.test`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        return { healthy: false, latency_ms: Date.now() - start };
      }
      const data = await res.json();
      return { healthy: data.ok === true, latency_ms: Date.now() - start };
    } catch {
      return { healthy: false, latency_ms: Date.now() - start };
    }
  },

  estimateCost(operation: string): number {
    if (operation === "send-message") return 0.002;
    if (operation === "reply-thread") return 0.002;
    if (operation === "read-channel") return 0.001;
    if (operation === "list-channels") return 0.001;
    return 0.002;
  },
};
