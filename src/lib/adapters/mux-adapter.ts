import type { ToolAdapter, AdapterResult } from "../gateway-types";
import { redactCreds } from "../redact-creds";

const BASE_URL = "https://api.mux.com/video/v1";

function getAuth(byokKey?: string): string | null {
  if (byokKey) return byokKey;
  const id = process.env.MUX_TOKEN_ID;
  const secret = process.env.MUX_TOKEN_SECRET;
  if (id && secret) return `${id}:${secret}`;
  return null;
}

function basicAuthHeader(credentials: string): string {
  return `Basic ${Buffer.from(credentials).toString("base64")}`;
}

export const muxAdapter: ToolAdapter = {
  slug: "mux",
  name: "Mux",
  description: "Video hosting, streaming, and playback via Mux",
  operations: ["create-asset", "get-asset", "list-assets", "create-playback"],

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
          "No API key configured. Set MUX_TOKEN_ID and MUX_TOKEN_SECRET or provide your own key via BYOK as 'id:secret'.",
        provider: "mux",
      };
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: basicAuthHeader(auth),
    };

    try {
      if (operation === "create-asset") {
        const inputUrl = input.input_url as string | undefined;
        if (!inputUrl) {
          return {
            success: false,
            error: "Missing required field: input_url",
            provider: "mux",
          };
        }

        const playbackPolicy = (input.playback_policy as string) || "public";

        const res = await fetch(`${BASE_URL}/assets`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            input: [{ url: inputUrl }],
            playback_policy: [playbackPolicy],
          }),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Mux create-asset failed: ${res.status} ${errText}`),
            provider: "mux",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data: data.data,
          provider: "mux",
          units_consumed: 1,
        };
      }

      if (operation === "get-asset") {
        const assetId = input.asset_id as string | undefined;
        if (!assetId) {
          return {
            success: false,
            error: "Missing required field: asset_id",
            provider: "mux",
          };
        }

        const res = await fetch(`${BASE_URL}/assets/${assetId}`, { headers });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Mux get-asset failed: ${res.status} ${errText}`),
            provider: "mux",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data: data.data,
          provider: "mux",
          units_consumed: 1,
        };
      }

      if (operation === "list-assets") {
        const limit = (input.limit as number) || 20;

        const res = await fetch(`${BASE_URL}/assets?limit=${limit}`, {
          headers,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Mux list-assets failed: ${res.status} ${errText}`),
            provider: "mux",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data: data.data,
          provider: "mux",
          units_consumed: 1,
        };
      }

      if (operation === "create-playback") {
        const assetId = input.asset_id as string | undefined;
        if (!assetId) {
          return {
            success: false,
            error: "Missing required field: asset_id",
            provider: "mux",
          };
        }

        const res = await fetch(
          `${BASE_URL}/assets/${assetId}/playback-ids`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({ policy: "public" }),
          }
        );

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Mux create-playback failed: ${res.status} ${errText}`),
            provider: "mux",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data: data.data,
          provider: "mux",
          units_consumed: 1,
        };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "mux",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "mux" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    const auth = getAuth();
    if (!auth) {
      return { healthy: false, latency_ms: Date.now() - start };
    }

    try {
      const res = await fetch(`${BASE_URL}/assets?limit=1`, {
        headers: { Authorization: basicAuthHeader(auth) },
      });
      return { healthy: res.ok, latency_ms: Date.now() - start };
    } catch {
      return { healthy: false, latency_ms: Date.now() - start };
    }
  },

  estimateCost(operation: string): number {
    if (operation === "create-asset") return 0.02;
    if (operation === "get-asset") return 0.001;
    if (operation === "list-assets") return 0.001;
    if (operation === "create-playback") return 0.005;
    return 0.01;
  },
};
