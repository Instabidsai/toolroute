import type { ToolAdapter, AdapterResult } from "../gateway-types";
import { redactCreds } from "../redact-creds";

const BASE_URL = "https://api.creatify.ai/api";

function getApiCredentials(byokKey?: string): {
  apiId: string;
  apiKey: string;
} | null {
  if (byokKey) {
    // BYOK format: "API_ID:API_KEY"
    const parts = byokKey.split(":");
    if (parts.length === 2) {
      return { apiId: parts[0], apiKey: parts[1] };
    }
    return null;
  }

  const apiId = process.env.CREATIFY_API_ID;
  const apiKey = process.env.CREATIFY_API_KEY;
  if (apiId && apiKey) return { apiId, apiKey };

  return null;
}

export const creatifyAdapter: ToolAdapter = {
  slug: "creatify",
  name: "Creatify",
  description:
    "AI ad generation — create video ads from product URLs with AI avatars and voiceovers",
  operations: ["create-ad", "list-ads", "get-ad"],

  async execute(
    operation: string,
    input: Record<string, unknown>,
    byokKey?: string
  ): Promise<AdapterResult> {
    const creds = getApiCredentials(byokKey);
    if (!creds) {
      return {
        success: false,
        error:
          "No API credentials configured. Set CREATIFY_API_ID and CREATIFY_API_KEY, or provide BYOK as 'ID:KEY'.",
        provider: "creatify",
      };
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-API-ID": creds.apiId,
      "X-API-KEY": creds.apiKey,
    };

    try {
      if (operation === "create-ad") {
        const url = input.url as string;
        if (!url) {
          return {
            success: false,
            error: "Missing required field: url (product page URL)",
            provider: "creatify",
          };
        }

        const body: Record<string, unknown> = { url };
        if (input.ad_format) body.ad_format = input.ad_format;
        if (input.duration) body.duration = input.duration;
        if (input.voice_id) body.voice_id = input.voice_id;

        const res = await fetch(`${BASE_URL}/ads/`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Creatify create-ad failed: ${res.status} ${errText}`),
            provider: "creatify",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data,
          provider: "creatify",
          units_consumed: 1,
        };
      }

      if (operation === "list-ads") {
        const res = await fetch(`${BASE_URL}/ads/`, {
          headers: {
            "X-API-ID": creds.apiId,
            "X-API-KEY": creds.apiKey,
          },
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Creatify list-ads failed: ${res.status} ${errText}`),
            provider: "creatify",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data,
          provider: "creatify",
          units_consumed: 1,
        };
      }

      if (operation === "get-ad") {
        const adId = input.ad_id as string;
        if (!adId) {
          return {
            success: false,
            error: "Missing required field: ad_id",
            provider: "creatify",
          };
        }

        const res = await fetch(`${BASE_URL}/ads/${adId}/`, {
          headers: {
            "X-API-ID": creds.apiId,
            "X-API-KEY": creds.apiKey,
          },
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Creatify get-ad failed: ${res.status} ${errText}`),
            provider: "creatify",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data,
          provider: "creatify",
          units_consumed: 1,
        };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "creatify",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "creatify" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    const creds = getApiCredentials();
    if (!creds) {
      return { healthy: false, latency_ms: Date.now() - start };
    }

    try {
      const res = await fetch(`${BASE_URL}/ads/`, {
        headers: {
          "X-API-ID": creds.apiId,
          "X-API-KEY": creds.apiKey,
        },
      });
      return { healthy: res.ok, latency_ms: Date.now() - start };
    } catch {
      return { healthy: false, latency_ms: Date.now() - start };
    }
  },

  estimateCost(operation: string): number {
    if (operation === "create-ad") return 2.0;
    return 0.001;
  },
};
