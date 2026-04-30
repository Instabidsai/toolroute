import type { ToolAdapter, AdapterResult } from "../gateway-types";
import { redactCreds } from "../redact-creds";

const BASE_URL = "https://api.app.outscraper.com";

function getApiKey(byokKey?: string): string | null {
  return byokKey || process.env.OUTSCRAPER_API_KEY || null;
}

export const outscraperAdapter: ToolAdapter = {
  slug: "outscraper",
  name: "Outscraper",
  description:
    "Data scraping — Google Maps places, Google reviews, emails and contacts extraction",
  operations: ["google-maps", "google-reviews", "emails-and-contacts"],

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
          "No API key configured. Set OUTSCRAPER_API_KEY or provide your own key via BYOK.",
        provider: "outscraper",
      };
    }

    const headers: Record<string, string> = {
      "X-API-KEY": apiKey,
    };

    try {
      if (operation === "google-maps") {
        const query = input.query as string | undefined;
        if (!query) {
          return {
            success: false,
            error:
              'Missing required field: query (e.g. "restaurants in Miami")',
            provider: "outscraper",
          };
        }

        const limit = (input.limit as number) || 20;
        const url = `${BASE_URL}/maps/search-v3?query=${encodeURIComponent(query)}&limit=${limit}`;

        const res = await fetch(url, { headers });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Outscraper google-maps failed: ${res.status} ${errText}`),
            provider: "outscraper",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data,
          provider: "outscraper",
        };
      }

      if (operation === "google-reviews") {
        const query = input.query as string | undefined;
        if (!query) {
          return {
            success: false,
            error:
              'Missing required field: query (e.g. "restaurant name, Miami FL")',
            provider: "outscraper",
          };
        }

        const limit = (input.limit as number) || 20;
        const url = `${BASE_URL}/maps/reviews-v3?query=${encodeURIComponent(query)}&reviewsLimit=${limit}`;

        const res = await fetch(url, { headers });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Outscraper google-reviews failed: ${res.status} ${errText}`),
            provider: "outscraper",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data,
          provider: "outscraper",
        };
      }

      if (operation === "emails-and-contacts") {
        const query = input.query as string | undefined;
        if (!query) {
          return {
            success: false,
            error:
              'Missing required field: query (e.g. "domain.com")',
            provider: "outscraper",
          };
        }

        const url = `${BASE_URL}/emails-and-contacts?query=${encodeURIComponent(query)}`;

        const res = await fetch(url, { headers });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Outscraper emails-and-contacts failed: ${res.status} ${errText}`),
            provider: "outscraper",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data,
          provider: "outscraper",
          units_consumed: 1,
        };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "outscraper",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "outscraper" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    const apiKey = getApiKey();
    if (!apiKey) {
      return { healthy: false, latency_ms: Date.now() - start };
    }

    try {
      // Use a minimal query to check the API is reachable
      const res = await fetch(
        `${BASE_URL}/maps/search-v3?query=test&limit=1`,
        { headers: { "X-API-KEY": apiKey } }
      );
      return { healthy: res.ok, latency_ms: Date.now() - start };
    } catch {
      return { healthy: false, latency_ms: Date.now() - start };
    }
  },

  estimateCost(operation: string): number {
    if (operation === "google-maps") return 0.01;
    if (operation === "google-reviews") return 0.01;
    if (operation === "emails-and-contacts") return 0.005;
    return 0.01;
  },
};
