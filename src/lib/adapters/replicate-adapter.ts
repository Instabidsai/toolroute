import type { ToolAdapter, AdapterResult } from "../gateway-types";

const BASE_URL = "https://api.replicate.com/v1";

function getApiKey(byokKey?: string): string | null {
  return byokKey || process.env.REPLICATE_API_TOKEN || null;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const replicateAdapter: ToolAdapter = {
  slug: "replicate",
  name: "Replicate",
  description: "Run any ML model on Replicate — image generation, LLMs, audio, video",
  operations: ["run", "list-models"],

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
          "No API key configured. Set REPLICATE_API_TOKEN or provide your own key via BYOK.",
        provider: "replicate",
      };
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      Prefer: "wait",
    };

    try {
      if (operation === "run") {
        const model = input.model as string | undefined;
        if (!model) {
          return {
            success: false,
            error:
              'Missing required field: model (e.g. "stability-ai/sdxl:version_hash")',
            provider: "replicate",
          };
        }

        const modelInput = (input.input as Record<string, unknown>) || {};

        // Parse model string: "owner/name:version" or "owner/name"
        let version = input.version as string | undefined;
        if (!version && model.includes(":")) {
          version = model.split(":")[1];
        }

        const body: Record<string, unknown> = { input: modelInput };
        if (version) {
          body.version = version;
        }

        // Create prediction
        const res = await fetch(`${BASE_URL}/predictions`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: `Replicate prediction failed: ${res.status} ${errText}`,
            provider: "replicate",
          };
        }

        let prediction = await res.json();

        // Poll up to 3 times at 2s intervals if not yet complete
        for (let i = 0; i < 3; i++) {
          if (
            prediction.status === "succeeded" ||
            prediction.status === "failed" ||
            prediction.status === "canceled"
          ) {
            break;
          }
          await sleep(2000);
          const pollRes = await fetch(
            `${BASE_URL}/predictions/${prediction.id}`,
            { headers: { Authorization: `Bearer ${apiKey}` } }
          );
          if (pollRes.ok) {
            prediction = await pollRes.json();
          }
        }

        if (prediction.status === "failed") {
          return {
            success: false,
            error: `Prediction failed: ${prediction.error || "unknown error"}`,
            provider: "replicate",
          };
        }

        return {
          success: true,
          data: {
            id: prediction.id,
            status: prediction.status,
            output: prediction.output,
            urls: prediction.urls,
            metrics: prediction.metrics,
          },
          provider: "replicate",
          units_consumed: 1,
        };
      }

      if (operation === "list-models") {
        const owner = input.owner as string | undefined;
        const url = owner
          ? `${BASE_URL}/models/${owner}`
          : `${BASE_URL}/models`;

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: `Replicate list-models failed: ${res.status} ${errText}`,
            provider: "replicate",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data: data.results || data,
          provider: "replicate",
          units_consumed: 1,
        };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "replicate",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "replicate" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    const apiKey = getApiKey();
    if (!apiKey) {
      return { healthy: false, latency_ms: Date.now() - start };
    }

    try {
      const res = await fetch(`${BASE_URL}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return { healthy: res.ok, latency_ms: Date.now() - start };
    } catch {
      return { healthy: false, latency_ms: Date.now() - start };
    }
  },

  estimateCost(operation: string): number {
    if (operation === "run") return 0.01;
    if (operation === "list-models") return 0;
    return 0.01;
  },
};
