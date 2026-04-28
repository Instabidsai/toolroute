import type { ToolAdapter, AdapterResult } from "../gateway-types";
import { fetchWithTimeout } from "../fetch-with-timeout";

const EXA_BASE_URL = "https://api.exa.ai";

function getApiKey(byokKey?: string): string | null {
  return byokKey || process.env.EXA_API_KEY || null;
}

export const exaAdapter: ToolAdapter = {
  slug: "exa",
  name: "Exa",
  description:
    "Neural search engine built for AI agents — semantic search, find-similar, company/people search. Powers Cursor's @web.",
  operations: [
    "search",
    "find-similar",
    "get-contents",
    "search-companies",
    "search-people",
  ],

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
          "No API key configured. Set EXA_API_KEY or provide your own key via BYOK.",
        provider: "exa",
      };
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    };

    try {
      if (operation === "search" || operation === "search-companies" || operation === "search-people") {
        const query = input.query as string;
        if (!query) {
          return {
            success: false,
            error: "Missing required field: query",
            provider: "exa",
          };
        }

        const body: Record<string, unknown> = {
          query,
          numResults: (input.num_results as number) ?? 10,
          type: (input.type as string) ?? "auto",
          useAutoprompt: input.use_autoprompt !== false,
          contents: { text: true, highlights: true },
        };

        if (input.start_published_date) {
          body.startPublishedDate = input.start_published_date;
        }

        if (operation === "search-companies") {
          body.category = "company";
        } else if (operation === "search-people") {
          // Exa doesn't have a dedicated people category — use a people-focused query
          body.query = `${query} (person OR founder OR CEO OR CTO OR executive)`;
        } else if (input.category) {
          body.category = input.category;
        }

        const res = await fetchWithTimeout(`${EXA_BASE_URL}/search`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          timeoutMs: 30_000,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: `Exa search failed: ${res.status} ${errText}`,
            provider: "exa",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data,
          provider: "exa",
          units_consumed: 1,
        };
      }

      if (operation === "find-similar") {
        const url = input.url as string;
        if (!url) {
          return {
            success: false,
            error: "Missing required field: url",
            provider: "exa",
          };
        }

        const body: Record<string, unknown> = {
          url,
          numResults: (input.num_results as number) ?? 10,
          contents: { text: true },
        };

        const res = await fetchWithTimeout(`${EXA_BASE_URL}/findSimilar`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          timeoutMs: 30_000,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: `Exa find-similar failed: ${res.status} ${errText}`,
            provider: "exa",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data,
          provider: "exa",
          units_consumed: 1,
        };
      }

      if (operation === "get-contents") {
        const ids = input.ids as string[];
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
          return {
            success: false,
            error: "Missing required field: ids (array of content IDs)",
            provider: "exa",
          };
        }

        const body: Record<string, unknown> = {
          ids,
          text: true,
          highlights: true,
        };

        const res = await fetchWithTimeout(`${EXA_BASE_URL}/contents`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          timeoutMs: 30_000,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: `Exa get-contents failed: ${res.status} ${errText}`,
            provider: "exa",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data,
          provider: "exa",
          units_consumed: 1,
        };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "exa",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "exa" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    const apiKey = getApiKey();
    if (!apiKey) {
      return { healthy: false, latency_ms: Date.now() - start };
    }

    try {
      const res = await fetchWithTimeout(`${EXA_BASE_URL}/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          query: "test",
          numResults: 1,
          contents: { text: false },
        }),
        timeoutMs: 10_000,
      });
      return { healthy: res.ok, latency_ms: Date.now() - start };
    } catch {
      return { healthy: false, latency_ms: Date.now() - start };
    }
  },

  estimateCost(operation: string): number {
    if (operation === "get-contents") return 0.003;
    return 0.005;
  },
};
