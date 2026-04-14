import type { ToolAdapter, AdapterResult } from "../gateway-types";

function getAuth(byokKey?: string): string | null {
  if (byokKey) return byokKey;
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (login && password) return `${login}:${password}`;
  return null;
}

function basicAuthHeader(credentials: string): string {
  return `Basic ${Buffer.from(credentials).toString("base64")}`;
}

export const dataforseoAdapter: ToolAdapter = {
  slug: "dataforseo",
  name: "DataForSEO",
  description:
    "SEO data — SERP results, keyword volumes, backlinks at $0.0006/query (replaces $500/mo SEMrush)",
  operations: ["serp", "keywords", "backlinks"],

  async execute(
    operation: string,
    input: Record<string, unknown>,
    byokKey?: string
  ): Promise<AdapterResult> {
    const auth = getAuth(byokKey);
    if (!auth) {
      return {
        success: false,
        error:
          "No API key configured. Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD or provide your own key via BYOK as 'login:password'.",
        provider: "dataforseo",
      };
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: basicAuthHeader(auth),
    };

    try {
      if (operation === "serp") {
        const keyword = input.keyword as string | undefined;
        if (!keyword) {
          return {
            success: false,
            error: "Missing required field: keyword",
            provider: "dataforseo",
          };
        }

        const locationName =
          (input.location_name as string) || "United States";
        const languageName = (input.language_name as string) || "English";

        const res = await fetch(
          "https://api.dataforseo.com/v3/serp/google/organic/live",
          {
            method: "POST",
            headers,
            body: JSON.stringify([
              {
                keyword,
                location_name: locationName,
                language_name: languageName,
              },
            ]),
          }
        );

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: `DataForSEO serp failed: ${res.status} ${errText}`,
            provider: "dataforseo",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data: data.tasks?.[0]?.result || data,
          provider: "dataforseo",
          units_consumed: 1,
        };
      }

      if (operation === "keywords") {
        const keywords = input.keywords as string[] | undefined;
        if (!keywords || keywords.length === 0) {
          return {
            success: false,
            error: "Missing required field: keywords (array of strings)",
            provider: "dataforseo",
          };
        }

        const locationName =
          (input.location_name as string) || "United States";

        const res = await fetch(
          "https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live",
          {
            method: "POST",
            headers,
            body: JSON.stringify([{ keywords, location_name: locationName }]),
          }
        );

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: `DataForSEO keywords failed: ${res.status} ${errText}`,
            provider: "dataforseo",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data: data.tasks?.[0]?.result || data,
          provider: "dataforseo",
          units_consumed: keywords.length,
        };
      }

      if (operation === "backlinks") {
        const target = input.target as string | undefined;
        if (!target) {
          return {
            success: false,
            error: "Missing required field: target (e.g. 'example.com')",
            provider: "dataforseo",
          };
        }

        const res = await fetch(
          "https://api.dataforseo.com/v3/backlinks/backlinks/live",
          {
            method: "POST",
            headers,
            body: JSON.stringify([{ target, limit: 100 }]),
          }
        );

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: `DataForSEO backlinks failed: ${res.status} ${errText}`,
            provider: "dataforseo",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data: data.tasks?.[0]?.result || data,
          provider: "dataforseo",
          units_consumed: 1,
        };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "dataforseo",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "dataforseo" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    const auth = getAuth();
    if (!auth) {
      return { healthy: false, latency_ms: Date.now() - start };
    }

    try {
      // Use a lightweight endpoint to check connectivity
      const res = await fetch(
        "https://api.dataforseo.com/v3/appendix/user_data",
        {
          headers: { Authorization: basicAuthHeader(auth) },
        }
      );
      return { healthy: res.ok, latency_ms: Date.now() - start };
    } catch {
      return { healthy: false, latency_ms: Date.now() - start };
    }
  },

  estimateCost(): number {
    return 0.002;
  },
};
