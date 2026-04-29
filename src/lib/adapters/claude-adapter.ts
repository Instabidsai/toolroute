import type { ToolAdapter, AdapterResult } from "../gateway-types";
import { fetchWithTimeout } from "../fetch-with-timeout";

const API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-4-20250514";
const DEFAULT_MAX_TOKENS = 1024;

function getApiKey(byokKey?: string): string | null {
  return byokKey || process.env.ANTHROPIC_API_KEY || null;
}

interface ChatMessage {
  role: string;
  content: string;
}

export const claudeAdapter: ToolAdapter = {
  slug: "claude",
  name: "Claude",
  description:
    "Anthropic Claude LLM — send chat and completion requests through the ToolRoute gateway",
  operations: ["chat", "complete"],

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
          "No API key configured. Provide your own key via BYOK or set ANTHROPIC_API_KEY.",
        provider: "claude",
      };
    }

    try {
      if (operation === "chat" || operation === "complete") {
        const messages = input.messages as ChatMessage[] | undefined;
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
          return {
            success: false,
            error: "Missing required field: messages (array of {role, content})",
            provider: "claude",
          };
        }

        const model = (input.model as string) ?? DEFAULT_MODEL;
        const maxTokens = (input.max_tokens as number) ?? DEFAULT_MAX_TOKENS;

        const body: Record<string, unknown> = {
          model,
          max_tokens: maxTokens,
          messages,
        };

        if (input.system) {
          body.system = input.system;
        }
        if (input.temperature !== undefined) {
          body.temperature = input.temperature;
        }

        const res = await fetchWithTimeout(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": ANTHROPIC_VERSION,
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: `Claude API error: ${res.status} ${errText}`,
            provider: "claude",
          };
        }

        const data = await res.json();

        return {
          success: true,
          data: {
            content: data.content,
            model: data.model,
            usage: data.usage,
            stop_reason: data.stop_reason,
          },
          provider: "claude",
        };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "claude",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "claude" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    const apiKey = getApiKey();
    if (!apiKey) {
      return { healthy: false, latency_ms: Date.now() - start };
    }

    try {
      const res = await fetchWithTimeout(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          max_tokens: 10,
          messages: [{ role: "user", content: "ping" }],
        }),
        timeoutMs: 15_000, // health check ping
      });

      return { healthy: res.ok, latency_ms: Date.now() - start };
    } catch {
      return { healthy: false, latency_ms: Date.now() - start };
    }
  },

  estimateCost(operation: string, input: Record<string, unknown>): number {
    if (operation === "chat" || operation === "complete") {
      const messages = input.messages as ChatMessage[] | undefined;
      if (messages && Array.isArray(messages)) {
        const totalChars = messages.reduce(
          (sum: number, m: ChatMessage) => sum + (m.content?.length ?? 0),
          0
        );
        // ~0.003 per 1K input chars (covers ~250 tokens at Sonnet pricing)
        return Math.max(0.003, (totalChars / 1000) * 0.003);
      }
      return 0.003;
    }
    return 0.003;
  },
};
