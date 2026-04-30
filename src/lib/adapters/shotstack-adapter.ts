import type { ToolAdapter, AdapterResult } from "../gateway-types";
import { redactCreds } from "../redact-creds";
import { fetchWithTimeout } from "../fetch-with-timeout";

const EDIT_BASE_URL = "https://api.shotstack.io/edit/v1";
const INGEST_BASE_URL = "https://api.shotstack.io/ingest/v1";

function getApiKey(byokKey?: string): string | null {
  return byokKey || process.env.SHOTSTACK_API_KEY || null;
}

export const shotstackAdapter: ToolAdapter = {
  slug: "shotstack",
  name: "Shotstack",
  description:
    "Video editing and rendering API — JSON timeline format for programmatic video creation",
  operations: ["render", "get-render", "probe"],

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
          "No API key configured. Set SHOTSTACK_API_KEY or provide your own key via BYOK.",
        provider: "shotstack",
      };
    }

    const editHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    };

    try {
      if (operation === "render") {
        const timeline = input.timeline as Record<string, unknown> | undefined;
        const output = input.output as Record<string, unknown> | undefined;
        if (!timeline) {
          return {
            success: false,
            error: "Missing required field: timeline",
            provider: "shotstack",
          };
        }

        const body: Record<string, unknown> = { timeline };
        if (output) {
          body.output = output;
        } else {
          body.output = { format: "mp4", resolution: "hd" };
        }

        const res = await fetchWithTimeout(`${EDIT_BASE_URL}/render`, {
          method: "POST",
          headers: editHeaders,
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Shotstack render failed: ${res.status} ${errText}`),
            provider: "shotstack",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data: data.response || data,
          provider: "shotstack",
          units_consumed: 1,
        };
      }

      if (operation === "get-render") {
        const renderId = input.render_id as string | undefined;
        if (!renderId) {
          return {
            success: false,
            error: "Missing required field: render_id",
            provider: "shotstack",
          };
        }

        const res = await fetchWithTimeout(`${EDIT_BASE_URL}/render/${renderId}`, {
          headers: editHeaders,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Shotstack get-render failed: ${res.status} ${errText}`),
            provider: "shotstack",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data: data.response || data,
          provider: "shotstack",
          units_consumed: 1,
        };
      }

      if (operation === "probe") {
        const url = input.url as string | undefined;
        if (!url) {
          return {
            success: false,
            error: "Missing required field: url",
            provider: "shotstack",
          };
        }

        const res = await fetchWithTimeout(`${INGEST_BASE_URL}/sources`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
          body: JSON.stringify({ url }),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Shotstack probe failed: ${res.status} ${errText}`),
            provider: "shotstack",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data: data.data || data,
          provider: "shotstack",
          units_consumed: 1,
        };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "shotstack",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "shotstack" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    const apiKey = getApiKey();
    if (!apiKey) {
      return { healthy: false, latency_ms: Date.now() - start };
    }

    try {
      // Shotstack doesn't have a lightweight health endpoint,
      // so we use a GET on render with a dummy ID to check auth
      const res = await fetchWithTimeout(`${EDIT_BASE_URL}/render`, {
        headers: { "x-api-key": apiKey },
      });
      // 200 or 404 both mean API is reachable and key is valid
      return {
        healthy: res.status < 500,
        latency_ms: Date.now() - start,
      };
    } catch {
      return { healthy: false, latency_ms: Date.now() - start };
    }
  },

  estimateCost(operation: string): number {
    if (operation === "render") return 0.3;
    if (operation === "get-render") return 0.001;
    if (operation === "probe") return 0.005;
    return 0.01;
  },
};
