import type { ToolAdapter, AdapterResult } from "../gateway-types";

function getApiKey(byokKey?: string): string | null {
  return byokKey || process.env.POSTIZ_API_KEY || null;
}

function getBaseUrl(): string {
  return (
    process.env.POSTIZ_BASE_URL || "https://social.myjarvisbrain.com"
  );
}

export const postizAdapter: ToolAdapter = {
  slug: "postiz",
  name: "Postiz",
  description:
    "Social media posting via self-hosted Postiz — schedule and publish to Twitter, LinkedIn, and more",
  operations: ["create-post", "list-posts", "get-integrations"],

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
          "No API key configured. Set POSTIZ_API_KEY or provide your own key via BYOK.",
        provider: "postiz",
      };
    }

    const baseUrl = getBaseUrl();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };

    try {
      if (operation === "create-post") {
        const content = input.content as string | undefined;
        if (!content) {
          return {
            success: false,
            error: "Missing required field: content",
            provider: "postiz",
          };
        }

        const body: Record<string, unknown> = { content };
        if (input.platforms) body.platforms = input.platforms;
        if (input.media_url) body.media_url = input.media_url;

        const res = await fetch(`${baseUrl}/api/posts`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: `Postiz create-post failed: ${res.status} ${errText}`,
            provider: "postiz",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data,
          provider: "postiz",
          units_consumed: 1,
        };
      }

      if (operation === "list-posts") {
        const limit = (input.limit as number) || 20;

        const res = await fetch(`${baseUrl}/api/posts?limit=${limit}`, {
          headers,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: `Postiz list-posts failed: ${res.status} ${errText}`,
            provider: "postiz",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data,
          provider: "postiz",
          units_consumed: 1,
        };
      }

      if (operation === "get-integrations") {
        const res = await fetch(`${baseUrl}/api/integrations`, { headers });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: `Postiz get-integrations failed: ${res.status} ${errText}`,
            provider: "postiz",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data,
          provider: "postiz",
          units_consumed: 1,
        };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "postiz",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "postiz" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    const apiKey = getApiKey();
    if (!apiKey) {
      return { healthy: false, latency_ms: Date.now() - start };
    }

    try {
      const baseUrl = getBaseUrl();
      const res = await fetch(`${baseUrl}/api/integrations`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return { healthy: res.ok, latency_ms: Date.now() - start };
    } catch {
      return { healthy: false, latency_ms: Date.now() - start };
    }
  },

  estimateCost(operation: string): number {
    if (operation === "create-post") return 0.002;
    return 0.001;
  },
};
