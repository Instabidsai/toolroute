import type { ToolAdapter, AdapterResult } from "../gateway-types";
import { redactCreds } from "../redact-creds";

const BRAVE_WEB_URL = "https://api.search.brave.com/res/v1/web/search";
const BRAVE_IMAGE_URL = "https://api.search.brave.com/res/v1/images/search";

function getApiKey(byokKey?: string): string | null {
  return byokKey || process.env.BRAVE_SEARCH_API_KEY || null;
}

export const searchAdapter: ToolAdapter = {
  slug: "search",
  name: "Web Search",
  description:
    "Web, news, and image search via Brave Search API — the #1 capability for agent autonomy",
  operations: ["web", "news", "images"],

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
          "No API key configured. Set BRAVE_SEARCH_API_KEY or provide your own key via BYOK.",
        provider: "brave",
      };
    }

    const query = input.query as string;
    if (!query) {
      return {
        success: false,
        error: "Missing required field: query",
        provider: "brave",
      };
    }

    const numResults = (input.num_results as number) ?? 10;

    const headers: Record<string, string> = {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": apiKey,
    };

    try {
      if (operation === "web") {
        const params = new URLSearchParams({
          q: query,
          count: String(numResults),
        });

        const res = await fetch(`${BRAVE_WEB_URL}?${params}`, { headers });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Brave web search failed: ${res.status} ${errText}`),
            provider: "brave",
          };
        }

        const data = await res.json();
        const results = (data.web?.results ?? []).map(
          (r: Record<string, unknown>) => ({
            title: r.title,
            url: r.url,
            description: r.description,
            age: r.age,
          })
        );

        return {
          success: true,
          data: { results },
          provider: "brave",
          units_consumed: 1,
        };
      }

      if (operation === "news") {
        const params = new URLSearchParams({
          q: query,
          count: String(numResults),
          search_type: "news",
        });

        const res = await fetch(`${BRAVE_WEB_URL}?${params}`, { headers });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Brave news search failed: ${res.status} ${errText}`),
            provider: "brave",
          };
        }

        const data = await res.json();
        const results = (data.news?.results ?? data.web?.results ?? []).map(
          (r: Record<string, unknown>) => ({
            title: r.title,
            url: r.url,
            description: r.description,
            age: r.age,
          })
        );

        return {
          success: true,
          data: { results },
          provider: "brave",
          units_consumed: 1,
        };
      }

      if (operation === "images") {
        const params = new URLSearchParams({
          q: query,
          count: String(numResults),
        });

        const res = await fetch(`${BRAVE_IMAGE_URL}?${params}`, { headers });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Brave image search failed: ${res.status} ${errText}`),
            provider: "brave",
          };
        }

        const data = await res.json();
        const results = (data.results ?? []).map(
          (r: Record<string, unknown>) => ({
            title: r.title,
            url: r.url,
            thumbnail: (r.thumbnail as Record<string, unknown>)?.src,
            source: r.source,
            width: (r.properties as Record<string, unknown>)?.width,
            height: (r.properties as Record<string, unknown>)?.height,
          })
        );

        return {
          success: true,
          data: { results },
          provider: "brave",
          units_consumed: 1,
        };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "brave",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "brave" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    const apiKey = getApiKey();
    if (!apiKey) {
      return { healthy: false, latency_ms: Date.now() - start };
    }

    try {
      const params = new URLSearchParams({ q: "test", count: "1" });
      const res = await fetch(`${BRAVE_WEB_URL}?${params}`, {
        headers: {
          Accept: "application/json",
          "X-Subscription-Token": apiKey,
        },
      });
      return { healthy: res.ok, latency_ms: Date.now() - start };
    } catch {
      return { healthy: false, latency_ms: Date.now() - start };
    }
  },

  estimateCost(): number {
    return 0.003;
  },
};
