import type { ToolAdapter, AdapterResult } from "../gateway-types";
import { fetchWithTimeout } from "../fetch-with-timeout";
import { redactCreds } from "../redact-creds";

const BASE_URL = "https://api.novita.ai/openai/v1";
const DEFAULT_MODEL = "deepseek/deepseek-v4-pro-0813";

function getApiKey(byokKey?: string): string | null {
  return byokKey || process.env.NOVITA_API_KEY || null;
}

export const novitaAdapter: ToolAdapter = {
  slug: "novita",
  name: "Novita AI",
  description:
    "Novita AI LLM chat completions via an OpenAI-compatible API — open-weight and proprietary models, one key",
  operations: ["chat"],

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
          "No API key configured. Set NOVITA_API_KEY or provide your own key via BYOK.",
        provider: "novita",
      };
    }

    if (operation !== "chat") {
      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "novita",
      };
    }

    const messages = input.messages as
      | { role: string; content: string }[]
      | undefined;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return {
        success: false,
        error: "Missing required field: messages (array of {role, content})",
        provider: "novita",
      };
    }

    const model = (input.model as string) || DEFAULT_MODEL;
    const max_tokens = (input.max_tokens as number) || 1024;
    const temperature =
      input.temperature !== undefined ? (input.temperature as number) : 0.7;

    try {
      const res = await fetchWithTimeout(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, messages, max_tokens, temperature }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        return {
          success: false,
          error: redactCreds(`Novita chat failed: ${res.status} ${errText}`),
          provider: "novita",
        };
      }

      const data = await res.json();
      return {
        success: true,
        data: {
          message: data.choices?.[0]?.message,
          model: data.model,
          usage: data.usage,
        },
        provider: "novita",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "novita" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    const apiKey = getApiKey();
    if (!apiKey) {
      return { healthy: false, latency_ms: Date.now() - start };
    }

    try {
      const res = await fetchWithTimeout(`${BASE_URL}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeoutMs: 10_000, // health check is short
      });
      return { healthy: res.ok, latency_ms: Date.now() - start };
    } catch {
      return { healthy: false, latency_ms: Date.now() - start };
    }
  },

  estimateCost(operation: string): number {
    if (operation === "chat") return 0.003;
    return 0.003;
  },
};
