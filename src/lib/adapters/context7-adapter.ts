import type { ToolAdapter, AdapterResult } from "../gateway-types";

const BASE_URL = "https://context7.com/api/v1";

export const context7Adapter: ToolAdapter = {
  slug: "context7",
  name: "Context7",
  description:
    "Library documentation lookup — search for libraries and query up-to-date docs for any framework or SDK",
  operations: ["search", "query-docs"],

  async execute(
    operation: string,
    input: Record<string, unknown>,
  ): Promise<AdapterResult> {
    try {
      if (operation === "search") {
        const query = input.query as string || input.library as string;
        if (!query) {
          return {
            success: false,
            error: "Missing required field: query (or library)",
            provider: "context7",
          };
        }

        const res = await fetch(
          `${BASE_URL}/search?query=${encodeURIComponent(query)}`,
          { method: "GET" }
        );

        if (!res.ok) {
          const text = await res.text();
          return {
            success: false,
            error: `Context7 search failed: ${res.status} ${text.slice(0, 200)}`,
            provider: "context7",
          };
        }

        const data = await res.json();
        return { success: true, data, provider: "context7" };
      }

      if (operation === "query-docs") {
        const query = input.query as string;
        const library = input.library as string || input.library_id as string;

        if (!query) {
          return {
            success: false,
            error: "Missing required field: query",
            provider: "context7",
          };
        }

        // If library is provided, search for it first to get context, then return filtered results
        const searchQuery = library ? `${library} ${query}` : query;

        const res = await fetch(
          `${BASE_URL}/search?query=${encodeURIComponent(searchQuery)}`,
          { method: "GET" }
        );

        if (!res.ok) {
          const text = await res.text();
          return {
            success: false,
            error: `Context7 query-docs failed: ${res.status} ${text.slice(0, 200)}`,
            provider: "context7",
          };
        }

        const data = await res.json();
        return { success: true, data, provider: "context7" };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "context7",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "context7" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    try {
      const res = await fetch(
        `${BASE_URL}/search?query=react`,
        { method: "GET" }
      );
      return { healthy: res.ok, latency_ms: Date.now() - start };
    } catch {
      return { healthy: false, latency_ms: Date.now() - start };
    }
  },

  estimateCost(): number {
    return 0.001;
  },
};
