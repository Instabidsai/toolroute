import type { ToolAdapter, AdapterResult } from "../gateway-types";
import { redactCreds } from "../redact-creds";

const FAL_QUEUE_URL = "https://queue.fal.run";

function getApiKey(byokKey?: string): string | null {
  return byokKey || process.env.FAL_KEY || null;
}

export const imageGenAdapter: ToolAdapter = {
  slug: "image",
  name: "Image Generation",
  description:
    "AI image generation and upscaling via fal.ai — Flux, SDXL, Clarity Upscaler",
  operations: ["generate", "upscale"],

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
          "No API key configured. Set FAL_KEY or provide your own key via BYOK.",
        provider: "fal.ai",
      };
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Key ${apiKey}`,
    };

    try {
      if (operation === "generate") {
        const prompt = input.prompt as string;
        if (!prompt) {
          return {
            success: false,
            error: "Missing required field: prompt",
            provider: "fal.ai",
          };
        }

        const model =
          (input.model as string) || "fal-ai/flux/schnell";
        const width = (input.width as number) ?? 1024;
        const height = (input.height as number) ?? 1024;
        const numImages = (input.num_images as number) ?? 1;

        const body = {
          prompt,
          image_size: { width, height },
          num_images: numImages,
        };

        const res = await fetch(`${FAL_QUEUE_URL}/${model}`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`fal.ai generate failed: ${res.status} ${errText}`),
            provider: "fal.ai",
          };
        }

        const data = await res.json();
        const images = (data.images ?? data.output ?? []).map(
          (img: Record<string, unknown>) => ({
            url: img.url,
            width: img.width,
            height: img.height,
            content_type: img.content_type,
          })
        );

        return {
          success: true,
          data: { images, seed: data.seed, model },
          provider: "fal.ai",
          units_consumed: numImages,
        };
      }

      if (operation === "upscale") {
        const imageUrl = input.image_url as string;
        if (!imageUrl) {
          return {
            success: false,
            error: "Missing required field: image_url",
            provider: "fal.ai",
          };
        }

        const scale = (input.scale as number) ?? 2;

        const body = {
          image_url: imageUrl,
          scale,
        };

        const res = await fetch(
          `${FAL_QUEUE_URL}/fal-ai/clarity-upscaler`,
          {
            method: "POST",
            headers,
            body: JSON.stringify(body),
          }
        );

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`fal.ai upscale failed: ${res.status} ${errText}`),
            provider: "fal.ai",
          };
        }

        const data = await res.json();
        const image = data.image ?? data.images?.[0] ?? null;

        return {
          success: true,
          data: {
            image: image
              ? {
                  url: image.url,
                  width: image.width,
                  height: image.height,
                }
              : null,
            scale,
          },
          provider: "fal.ai",
          units_consumed: 1,
        };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "fal.ai",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "fal.ai" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    const apiKey = getApiKey();
    if (!apiKey) {
      return { healthy: false, latency_ms: Date.now() - start };
    }

    try {
      // Simple check — fal.ai doesn't have a dedicated health endpoint,
      // so we verify the API key is accepted by hitting the queue status
      const res = await fetch("https://queue.fal.run/fal-ai/flux/schnell", {
        method: "OPTIONS",
        headers: { Authorization: `Key ${apiKey}` },
      });
      return { healthy: res.ok || res.status === 405, latency_ms: Date.now() - start };
    } catch {
      return { healthy: false, latency_ms: Date.now() - start };
    }
  },

  estimateCost(operation: string): number {
    if (operation === "generate") return 0.02;
    if (operation === "upscale") return 0.03;
    return 0.02;
  },
};
