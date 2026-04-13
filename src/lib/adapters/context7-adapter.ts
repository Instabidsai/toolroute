import type { ToolAdapter, AdapterResult } from "../gateway-types";

const BASE_URL = "https://context7.com/api/v1";

export const context7Adapter: ToolAdapter = {
  slug: "context7",
  name: "Context7",
  description:
    "Library documentation lookup — resolve library IDs and query up-to-date docs for any framework or SDK",
  operations: ["resolve-library", "query-docs"],

  async execute(
    operation: string,
    input: Record<string, unknown>,
    byokKey?: string
  ): Promise<AdapterResult> {
    try {
      if (operation === "resolve-library") {
        const library = input.library as string;
        if (!library) {
          return {
            success: false,
            error: "Missing required field: library",
            provider: "context7",
          };
        }

        const res = await fetch(
          `${BASE_URL}/resolve?library=${encodeURIComponent(library)}`,
          {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          }
        );

        if (!res.ok) {
          return {
            success: false,
            error: `Context7 resolve-library failed: ${res.status} ${res.statusText}`,
            provider: "context7",
          };
        }

        const data = await res.json();
        return { success: true, data, provider: "context7" };
      }

      if (operation === "query-docs") {
        const libraryId = input.library_id as string;
        const query = input.query as string;

        if (!libraryId) {
          return {
            success: false,
            error: "Missing required field: library_id",
            provider: "context7",
          };
        }
        if (!query) {
          return {
            success: false,
            error: "Missing required field: query",
            provider: "context7",
          };
        }

        const params = new URLSearchParams({
          library_id: libraryId,
          query,
        });
        if (input.tokens !== undefined) {
          params.set("tokens", String(input.tokens));
        }

        const res = await fetch(`${BASE_URL}/query?${params.toString()}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (!res.ok) {
          return {
            success: false,
            error: `Context7 query-docs failed: ${res.status} ${res.statusText}`,
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
        `${BASE_URL}/resolve?library=${encodeURIComponent("react")}`,
        { method: "GET", headers: { "Content-Type": "application/json" } }
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
