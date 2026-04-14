import type { ToolAdapter, AdapterResult } from "../gateway-types";

const BASE_URL = "https://api.creatomate.com/v1";

function getApiKey(byokKey?: string): string | null {
  return byokKey || process.env.CREATOMATE_API_KEY || null;
}

export const creatomateAdapter: ToolAdapter = {
  slug: "creatomate",
  name: "Creatomate",
  description:
    "Template-based video and image rendering API — render dynamic videos from templates",
  operations: ["render", "list-templates", "get-render"],

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
          "No API key configured. Set CREATOMATE_API_KEY or provide your own key via BYOK.",
        provider: "creatomate",
      };
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };

    try {
      if (operation === "render") {
        const templateId = input.template_id as string | undefined;
        if (!templateId) {
          return {
            success: false,
            error: "Missing required field: template_id",
            provider: "creatomate",
          };
        }

        const body: Record<string, unknown> = { template_id: templateId };
        if (input.modifications) body.modifications = input.modifications;

        const res = await fetch(`${BASE_URL}/renders`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: `Creatomate render failed: ${res.status} ${errText}`,
            provider: "creatomate",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data,
          provider: "creatomate",
          units_consumed: 1,
        };
      }

      if (operation === "list-templates") {
        const limit = (input.limit as number) || 20;

        const res = await fetch(`${BASE_URL}/templates?limit=${limit}`, {
          headers,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: `Creatomate list-templates failed: ${res.status} ${errText}`,
            provider: "creatomate",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data,
          provider: "creatomate",
          units_consumed: 1,
        };
      }

      if (operation === "get-render") {
        const renderId = input.render_id as string | undefined;
        if (!renderId) {
          return {
            success: false,
            error: "Missing required field: render_id",
            provider: "creatomate",
          };
        }

        const res = await fetch(`${BASE_URL}/renders/${renderId}`, {
          headers,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: `Creatomate get-render failed: ${res.status} ${errText}`,
            provider: "creatomate",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data,
          provider: "creatomate",
          units_consumed: 1,
        };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "creatomate",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "creatomate" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    const apiKey = getApiKey();
    if (!apiKey) {
      return { healthy: false, latency_ms: Date.now() - start };
    }

    try {
      const res = await fetch(`${BASE_URL}/templates?limit=1`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return { healthy: res.ok, latency_ms: Date.now() - start };
    } catch {
      return { healthy: false, latency_ms: Date.now() - start };
    }
  },

  estimateCost(operation: string): number {
    if (operation === "render") return 0.5;
    return 0.001;
  },
};
