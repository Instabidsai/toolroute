import type { ToolAdapter, AdapterResult } from "../gateway-types";
import { redactCreds } from "../redact-creds";

const BASE_URL = "https://api.unsplash.com";

function getApiKey(byokKey?: string): string | null {
  return byokKey || process.env.UNSPLASH_ACCESS_KEY || null;
}

export const unsplashAdapter: ToolAdapter = {
  slug: "unsplash",
  name: "Unsplash",
  description:
    "Free high-resolution stock photos — search, random, and direct photo access",
  operations: ["search", "random", "get-photo"],

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
          "No API key configured. Set UNSPLASH_ACCESS_KEY or provide your own key via BYOK.",
        provider: "unsplash",
      };
    }

    const headers: Record<string, string> = {
      Authorization: `Client-ID ${apiKey}`,
      "Accept-Version": "v1",
    };

    try {
      if (operation === "search") {
        const query = input.query as string;
        if (!query) {
          return {
            success: false,
            error: "Missing required field: query",
            provider: "unsplash",
          };
        }

        const per_page = (input.per_page as number) || 10;
        const params = new URLSearchParams({
          query,
          per_page: String(per_page),
        });

        const res = await fetch(`${BASE_URL}/search/photos?${params}`, {
          headers,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Unsplash search failed: ${res.status} ${errText}`),
            provider: "unsplash",
          };
        }

        const data = await res.json();
        const photos = (data.results ?? []).map(
          (p: Record<string, unknown>) => ({
            id: p.id,
            description: p.description,
            alt_description: p.alt_description,
            urls: p.urls,
            width: p.width,
            height: p.height,
            user: (p.user as Record<string, unknown>)?.name,
            links: p.links,
          })
        );

        return {
          success: true,
          data: { photos, total: data.total, total_pages: data.total_pages },
          provider: "unsplash",
          units_consumed: 1,
        };
      }

      if (operation === "random") {
        const count = (input.count as number) || 1;
        const query = input.query as string;
        const params = new URLSearchParams({ count: String(count) });
        if (query) params.set("query", query);

        const res = await fetch(`${BASE_URL}/photos/random?${params}`, {
          headers,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Unsplash random failed: ${res.status} ${errText}`),
            provider: "unsplash",
          };
        }

        const data = await res.json();
        const photos = (Array.isArray(data) ? data : [data]).map(
          (p: Record<string, unknown>) => ({
            id: p.id,
            description: p.description,
            alt_description: p.alt_description,
            urls: p.urls,
            width: p.width,
            height: p.height,
            user: (p.user as Record<string, unknown>)?.name,
            links: p.links,
          })
        );

        return {
          success: true,
          data: { photos },
          provider: "unsplash",
          units_consumed: 1,
        };
      }

      if (operation === "get-photo") {
        const id = input.id as string;
        if (!id) {
          return {
            success: false,
            error: "Missing required field: id",
            provider: "unsplash",
          };
        }

        const res = await fetch(`${BASE_URL}/photos/${id}`, { headers });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Unsplash get-photo failed: ${res.status} ${errText}`),
            provider: "unsplash",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data: {
            id: data.id,
            description: data.description,
            alt_description: data.alt_description,
            urls: data.urls,
            width: data.width,
            height: data.height,
            user: data.user?.name,
            links: data.links,
            downloads: data.downloads,
            likes: data.likes,
            exif: data.exif,
            location: data.location,
          },
          provider: "unsplash",
          units_consumed: 1,
        };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "unsplash",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "unsplash" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    const apiKey = getApiKey();
    if (!apiKey) {
      return { healthy: false, latency_ms: Date.now() - start };
    }

    try {
      const res = await fetch(`${BASE_URL}/photos/random?count=1`, {
        headers: { Authorization: `Client-ID ${apiKey}` },
      });
      return { healthy: res.ok, latency_ms: Date.now() - start };
    } catch {
      return { healthy: false, latency_ms: Date.now() - start };
    }
  },

  estimateCost(): number {
    return 0.001;
  },
};
