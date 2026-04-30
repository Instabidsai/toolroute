import type { ToolAdapter, AdapterResult } from "../gateway-types";
import { fetchWithTimeout } from "../fetch-with-timeout";
import { redactCreds } from "../redact-creds";

const BASE_URL = "https://api.openai.com/v1";

function getApiKey(byokKey?: string): string | null {
  return byokKey || process.env.OPENAI_API_KEY || null;
}

export const openaiAdapter: ToolAdapter = {
  slug: "openai",
  name: "OpenAI",
  description:
    "GPT chat completions, DALL-E image generation, text embeddings, and content moderation",
  operations: ["chat", "image", "embeddings", "moderation"],

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
          "No API key configured. Set OPENAI_API_KEY or provide your own key via BYOK.",
        provider: "openai",
      };
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };

    try {
      if (operation === "chat") {
        const messages = input.messages as
          | { role: string; content: string }[]
          | undefined;
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
          return {
            success: false,
            error: "Missing required field: messages (array of {role, content})",
            provider: "openai",
          };
        }

        const model = (input.model as string) || "gpt-4o";
        const max_tokens = (input.max_tokens as number) || 1024;
        const temperature =
          input.temperature !== undefined
            ? (input.temperature as number)
            : 0.7;

        const res = await fetchWithTimeout(`${BASE_URL}/chat/completions`, {
          method: "POST",
          headers,
          body: JSON.stringify({ model, messages, max_tokens, temperature }),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`OpenAI chat failed: ${res.status} ${errText}`),
            provider: "openai",
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
          provider: "openai",
        };
      }

      if (operation === "image") {
        const prompt = input.prompt as string;
        if (!prompt) {
          return {
            success: false,
            error: "Missing required field: prompt",
            provider: "openai",
          };
        }

        const model = (input.model as string) || "dall-e-3";
        const size = (input.size as string) || "1024x1024";
        const n = (input.n as number) || 1;

        const res = await fetchWithTimeout(`${BASE_URL}/images/generations`, {
          method: "POST",
          headers,
          body: JSON.stringify({ model, prompt, size, n }),
          timeoutMs: 120_000, // image generation takes longer
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`OpenAI image generation failed: ${res.status} ${errText}`),
            provider: "openai",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data: {
            images: data.data?.map(
              (img: { url?: string; revised_prompt?: string }) => ({
                url: img.url,
                revised_prompt: img.revised_prompt,
              })
            ),
          },
          provider: "openai",
        };
      }

      if (operation === "embeddings") {
        const inputText = input.input as string;
        if (!inputText) {
          return {
            success: false,
            error: "Missing required field: input",
            provider: "openai",
          };
        }

        const model = (input.model as string) || "text-embedding-3-small";

        const res = await fetchWithTimeout(`${BASE_URL}/embeddings`, {
          method: "POST",
          headers,
          body: JSON.stringify({ model, input: inputText }),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`OpenAI embeddings failed: ${res.status} ${errText}`),
            provider: "openai",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data: {
            embedding: data.data?.[0]?.embedding,
            model: data.model,
            usage: data.usage,
          },
          provider: "openai",
        };
      }

      if (operation === "moderation") {
        const inputText = input.input as string;
        if (!inputText) {
          return {
            success: false,
            error: "Missing required field: input",
            provider: "openai",
          };
        }

        const res = await fetchWithTimeout(`${BASE_URL}/moderations`, {
          method: "POST",
          headers,
          body: JSON.stringify({ input: inputText }),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`OpenAI moderation failed: ${res.status} ${errText}`),
            provider: "openai",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data: {
            flagged: data.results?.[0]?.flagged,
            categories: data.results?.[0]?.categories,
            category_scores: data.results?.[0]?.category_scores,
          },
          provider: "openai",
        };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "openai",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "openai" };
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
    if (operation === "chat") return 0.005;
    if (operation === "image") return 0.04;
    if (operation === "embeddings") return 0.0001;
    if (operation === "moderation") return 0;
    return 0.005;
  },
};
