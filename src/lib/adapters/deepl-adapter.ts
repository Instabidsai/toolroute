import type { ToolAdapter, AdapterResult } from "../gateway-types";
import { redactCreds } from "../redact-creds";

const DEEPL_FREE_URL = "https://api-free.deepl.com/v2";
const DEEPL_PRO_URL = "https://api.deepl.com/v2";

function getApiKey(byokKey?: string): string | null {
  return byokKey || process.env.DEEPL_API_KEY || null;
}

function getBaseUrl(apiKey: string): string {
  // DeepL free keys end with ":fx"
  return apiKey.endsWith(":fx") ? DEEPL_FREE_URL : DEEPL_PRO_URL;
}

export const deeplAdapter: ToolAdapter = {
  slug: "translate",
  name: "DeepL Translation",
  description:
    "High-quality text translation and language detection via DeepL API",
  operations: ["text", "detect-language"],

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
          "No API key configured. Set DEEPL_API_KEY or provide your own key via BYOK.",
        provider: "deepl",
      };
    }

    const baseUrl = getBaseUrl(apiKey);

    const headers: Record<string, string> = {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    };

    try {
      if (operation === "text") {
        const text = input.text as string;
        if (!text) {
          return {
            success: false,
            error: "Missing required field: text",
            provider: "deepl",
          };
        }

        const targetLang = input.target_lang as string;
        if (!targetLang) {
          return {
            success: false,
            error: "Missing required field: target_lang",
            provider: "deepl",
          };
        }

        const params = new URLSearchParams();
        params.append("text", text);
        params.append("target_lang", targetLang.toUpperCase());
        if (input.source_lang) {
          params.append(
            "source_lang",
            (input.source_lang as string).toUpperCase()
          );
        }

        const res = await fetch(`${baseUrl}/translate`, {
          method: "POST",
          headers,
          body: params.toString(),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`DeepL translate failed: ${res.status} ${errText}`),
            provider: "deepl",
          };
        }

        const data = await res.json();

        return {
          success: true,
          data: {
            translations: (
              data.translations as Array<Record<string, unknown>>
            ).map((t) => ({
              detected_source_language: t.detected_source_language,
              text: t.text,
            })),
          },
          provider: "deepl",
        };
      }

      if (operation === "detect-language") {
        const text = input.text as string;
        if (!text) {
          return {
            success: false,
            error: "Missing required field: text",
            provider: "deepl",
          };
        }

        // Use translate endpoint with target EN to detect source language
        const params = new URLSearchParams();
        params.append("text", text);
        params.append("target_lang", "EN");

        const res = await fetch(`${baseUrl}/translate`, {
          method: "POST",
          headers,
          body: params.toString(),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`DeepL detect-language failed: ${res.status} ${errText}`),
            provider: "deepl",
          };
        }

        const data = await res.json();
        const detected =
          (data.translations as Array<Record<string, unknown>>)?.[0]
            ?.detected_source_language ?? "UNKNOWN";

        return {
          success: true,
          data: { detected_language: detected },
          provider: "deepl",
        };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "deepl",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "deepl" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    const apiKey = getApiKey();
    if (!apiKey) {
      return { healthy: false, latency_ms: Date.now() - start };
    }

    try {
      const baseUrl = getBaseUrl(apiKey);
      const res = await fetch(`${baseUrl}/usage`, {
        headers: { Authorization: `DeepL-Auth-Key ${apiKey}` },
      });
      return { healthy: res.ok, latency_ms: Date.now() - start };
    } catch {
      return { healthy: false, latency_ms: Date.now() - start };
    }
  },

  estimateCost(operation: string, input: Record<string, unknown>): number {
    const text = (input.text as string) ?? "";
    const cost = Math.max(text.length * 0.00005, 0.001);
    if (operation === "detect-language") return Math.min(cost, 0.005);
    return cost;
  },
};
