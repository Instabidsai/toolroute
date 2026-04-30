import type { ToolAdapter, AdapterResult } from "../gateway-types";
import { fetchWithTimeout } from "../fetch-with-timeout";
import { redactCreds } from "../redact-creds";

const BASE_URL = "https://api.firecrawl.dev/v1";

function getApiKey(byokKey?: string): string | null {
  return byokKey || process.env.FIRECRAWL_API_KEY || null;
}

export const firecrawlAdapter: ToolAdapter = {
  slug: "firecrawl",
  name: "Firecrawl",
  description:
    "Web scraping and crawling — extract markdown, HTML, or site maps from any URL",
  operations: ["scrape", "crawl", "map"],

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
        provider: "firecrawl",
      };
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };

    try {
      if (operation === "scrape") {
        const url = input.url as string;
        if (!url) {
          return {
            success: false,
            error: "Missing required field: url",
            provider: "firecrawl",
          };
        }

        const body: Record<string, unknown> = { url };
        if (input.formats) {
          body.formats = input.formats;
        }

        const res = await fetchWithTimeout(`${BASE_URL}/scrape`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          timeoutMs: 60_000,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Firecrawl scrape failed: ${res.status} ${errText}`),
            provider: "firecrawl",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data,
          provider: "firecrawl",
          units_consumed: 1,
        };
      }

      if (operation === "crawl") {
        const url = input.url as string;
        if (!url) {
          return {
            success: false,
            error: "Missing required field: url",
            provider: "firecrawl",
          };
        }

        const body: Record<string, unknown> = { url };
        if (input.limit !== undefined) {
          body.limit = input.limit;
        }

        const res = await fetchWithTimeout(`${BASE_URL}/crawl`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          timeoutMs: 90_000,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Firecrawl crawl failed: ${res.status} ${errText}`),
            provider: "firecrawl",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data,
          provider: "firecrawl",
        };
      }

      if (operation === "map") {
        const url = input.url as string;
        if (!url) {
          return {
            success: false,
            error: "Missing required field: url",
            provider: "firecrawl",
          };
        }

        const res = await fetchWithTimeout(`${BASE_URL}/map`, {
          method: "POST",
          headers,
          body: JSON.stringify({ url }),
          timeoutMs: 60_000,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Firecrawl map failed: ${res.status} ${errText}`),
            provider: "firecrawl",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data,
          provider: "firecrawl",
          units_consumed: 1,
        };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "firecrawl",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "firecrawl" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    const apiKey = getApiKey();
    if (!apiKey) {
      return { healthy: false, latency_ms: Date.now() - start };
    }

    try {
      const res = await fetchWithTimeout(BASE_URL, {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
        timeoutMs: 10_000,
      });
      return { healthy: res.ok, latency_ms: Date.now() - start };
    } catch {
      return { healthy: false, latency_ms: Date.now() - start };
    }
  },

  estimateCost(operation: string): number {
    if (operation === "scrape") return 0.005;
    if (operation === "crawl") return 0.01;
    if (operation === "map") return 0.003;
    return 0.005;
  },
};
