import type { ToolAdapter, AdapterResult } from "../gateway-types";
import { redactCreds } from "../redact-creds";
import { fetchWithTimeout } from "../fetch-with-timeout";

const BASE_URL = "https://api.pexels.com";

function getApiKey(byokKey?: string): string | null {
  return byokKey || process.env.PEXELS_API_KEY || null;
}

export const pexelsAdapter: ToolAdapter = {
  slug: "pexels",
  name: "Pexels",
  description:
    "Free stock photos and videos — search curated high-quality media for any project",
  operations: ["search-photos", "search-videos", "curated"],

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
          "No API key configured. Set PEXELS_API_KEY or provide your own key via BYOK.",
        provider: "pexels",
      };
    }

    const headers: Record<string, string> = {
      Authorization: apiKey,
    };

    try {
      if (operation === "search-photos") {
        const query = input.query as string;
        if (!query) {
          return {
            success: false,
            error: "Missing required field: query",
            provider: "pexels",
          };
        }

        const per_page = (input.per_page as number) || 10;
        const page = (input.page as number) || 1;
        const params = new URLSearchParams({
          query,
          per_page: String(per_page),
          page: String(page),
        });

        const res = await fetchWithTimeout(`${BASE_URL}/v1/search?${params}`, { headers });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Pexels photo search failed: ${res.status} ${errText}`),
            provider: "pexels",
          };
        }

        const data = await res.json();
        const photos = (data.photos ?? []).map(
          (p: Record<string, unknown>) => ({
            id: p.id,
            width: p.width,
            height: p.height,
            url: p.url,
            photographer: p.photographer,
            src: p.src,
            alt: p.alt,
          })
        );

        return {
          success: true,
          data: { photos, total_results: data.total_results, page: data.page },
          provider: "pexels",
          units_consumed: 1,
        };
      }

      if (operation === "search-videos") {
        const query = input.query as string;
        if (!query) {
          return {
            success: false,
            error: "Missing required field: query",
            provider: "pexels",
          };
        }

        const per_page = (input.per_page as number) || 10;
        const params = new URLSearchParams({
          query,
          per_page: String(per_page),
        });

        const res = await fetchWithTimeout(`${BASE_URL}/videos/search?${params}`, {
          headers,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Pexels video search failed: ${res.status} ${errText}`),
            provider: "pexels",
          };
        }

        const data = await res.json();
        const videos = (data.videos ?? []).map(
          (v: Record<string, unknown>) => ({
            id: v.id,
            width: v.width,
            height: v.height,
            url: v.url,
            duration: v.duration,
            video_files: v.video_files,
            video_pictures: v.video_pictures,
          })
        );

        return {
          success: true,
          data: { videos, total_results: data.total_results },
          provider: "pexels",
          units_consumed: 1,
        };
      }

      if (operation === "curated") {
        const per_page = (input.per_page as number) || 10;
        const params = new URLSearchParams({
          per_page: String(per_page),
        });

        const res = await fetchWithTimeout(`${BASE_URL}/v1/curated?${params}`, {
          headers,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Pexels curated failed: ${res.status} ${errText}`),
            provider: "pexels",
          };
        }

        const data = await res.json();
        const photos = (data.photos ?? []).map(
          (p: Record<string, unknown>) => ({
            id: p.id,
            width: p.width,
            height: p.height,
            url: p.url,
            photographer: p.photographer,
            src: p.src,
            alt: p.alt,
          })
        );

        return {
          success: true,
          data: { photos },
          provider: "pexels",
          units_consumed: 1,
        };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "pexels",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "pexels" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    const apiKey = getApiKey();
    if (!apiKey) {
      return { healthy: false, latency_ms: Date.now() - start };
    }

    try {
      const res = await fetchWithTimeout(`${BASE_URL}/v1/curated?per_page=1`, {
        headers: { Authorization: apiKey },
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
