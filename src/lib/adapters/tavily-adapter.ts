import type { ToolAdapter, AdapterResult } from "../gateway-types";
import { redactCreds } from "../redact-creds";

const TAVILY_BASE_URL = "https://api.tavily.com";

function getApiKey(byokKey?: string): string | null {
  return byokKey || process.env.TAVILY_API_KEY || null;
}

export const tavilyAdapter: ToolAdapter = {
  slug: "tavily",
  name: "Tavily",
  description:
    "RAG-optimized search for agents — clean extracted content, answers, news/finance topics. Acquired by Nebius.",
  operations: ["search", "extract"],

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
          "No API key configured. Set TAVILY_API_KEY or provide your own key via BYOK.",
        provider: "tavily",
      };
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    try {
      if (operation === "search") {
        const query = input.query as string;
        if (!query) {
          return {
            success: false,
            error: "Missing required field: query",
            provider: "tavily",
          };
        }

        const searchDepth = (input.search_depth as string) ?? "basic";

        const body: Record<string, unknown> = {
          api_key: apiKey,
          query,
          max_results: (input.max_results as number) ?? 5,
          search_depth: searchDepth,
          include_answer: input.include_answer !== false,
          include_raw_content: (input.include_raw_content as boolean) ?? false,
        };

        if (input.topic) {
          body.topic = input.topic;
        }

        const res = await fetch(`${TAVILY_BASE_URL}/search`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(
              `Tavily search failed: ${res.status} ${errText}`
            ),
            provider: "tavily",
          };
        }

        const data = (await res.json()) as Record<string, unknown>;
        return {
          success: true,
          data: {
            answer: data.answer,
            query: data.query,
            follow_up_questions: data.follow_up_questions,
            results: data.results,
            images: data.images,
            response_time: data.response_time,
          },
          provider: "tavily",
          units_consumed: 1,
        };
      }

      if (operation === "extract") {
        const urls = input.urls as string[];
        if (!urls || !Array.isArray(urls) || urls.length === 0) {
          return {
            success: false,
            error: "Missing required field: urls (array of URLs to extract content from)",
            provider: "tavily",
          };
        }

        const body: Record<string, unknown> = {
          api_key: apiKey,
          urls,
        };

        const res = await fetch(`${TAVILY_BASE_URL}/extract`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(
              `Tavily extract failed: ${res.status} ${errText}`
            ),
            provider: "tavily",
          };
        }

        const data = (await res.json()) as Record<string, unknown>;
        return {
          success: true,
          data: {
            results: data.results,
            failed_results: data.failed_results,
            response_time: data.response_time,
          },
          provider: "tavily",
          units_consumed: 1,
        };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "tavily",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "tavily" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    const apiKey = getApiKey();
    if (!apiKey) {
      return { healthy: false, latency_ms: Date.now() - start };
    }

    try {
      const res = await fetch(`${TAVILY_BASE_URL}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          query: "test",
          max_results: 1,
        }),
      });
      return { healthy: res.ok, latency_ms: Date.now() - start };
    } catch {
      return { healthy: false, latency_ms: Date.now() - start };
    }
  },

  estimateCost(operation: string, input: Record<string, unknown>): number {
    if (operation === "extract") return 0.003;
    const depth = (input?.search_depth as string) ?? "basic";
    return depth === "advanced" ? 0.01 : 0.005;
  },
};
