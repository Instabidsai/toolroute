import type { ToolAdapter, AdapterResult } from "../gateway-types";
import { redactCreds } from "../redact-creds";

const BASE_URL = "https://cloud.higgsfield.ai/v1";

function getApiKey(byokKey?: string): string | null {
  return byokKey || process.env.HIGGSFIELD_API_KEY || null;
}

/** Known models with their type and description */
const KNOWN_MODELS = [
  { id: "soul-2", type: "image", description: "Fashion-focused image generation" },
  { id: "nano-banana-pro", type: "image", description: "4K image generation" },
  { id: "flux-2", type: "image", description: "High-quality image generation" },
  { id: "seedance-2", type: "video", description: "Most advanced video generation" },
  { id: "kling-3", type: "video", description: "15s video, character consistency" },
  { id: "cinema-studio-3", type: "video", description: "Cinematic video generation" },
  { id: "sora-2", type: "video", description: "OpenAI video generation" },
  { id: "veo-3.1", type: "video", description: "Google video generation" },
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollGeneration(
  generationId: string,
  apiKey: string,
  maxAttempts: number,
  intervalMs: number
): Promise<Record<string, unknown> | null> {
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(intervalMs);
    const res = await fetch(`${BASE_URL}/generations/${generationId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) continue;
    const data = (await res.json()) as Record<string, unknown>;
    const status = data.status as string | undefined;
    if (status === "completed" || status === "succeeded") {
      return data;
    }
    if (status === "failed" || status === "error") {
      return data;
    }
  }
  return null;
}

export const higgsFieldAdapter: ToolAdapter = {
  slug: "higgsfield",
  name: "Higgsfield",
  description:
    "AI video & image platform — 30+ models (Sora 2, Kling 3.0, Veo 3.1, Soul 2.0, Seedance). Text-to-image, text-to-video, image-to-video, character consistency.",
  operations: [
    "generate-image",
    "generate-video",
    "create-character",
    "check-status",
    "list-models",
  ],

  async execute(
    operation: string,
    input: Record<string, unknown>,
    byokKey?: string
  ): Promise<AdapterResult> {
    // list-models needs no auth
    if (operation === "list-models") {
      return {
        success: true,
        data: { models: KNOWN_MODELS },
        provider: "higgsfield",
        units_consumed: 0,
      };
    }

    const apiKey = getApiKey(byokKey);
    if (!apiKey) {
      return {
        success: false,
        error:
          "No API key configured. Set HIGGSFIELD_API_KEY or provide your own key via BYOK.",
        provider: "higgsfield",
      };
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };

    try {
      // ── generate-image ────────────────────────────────────────────
      if (operation === "generate-image") {
        const prompt = input.prompt as string | undefined;
        if (!prompt) {
          return {
            success: false,
            error: "Missing required field: prompt",
            provider: "higgsfield",
          };
        }

        const model = (input.model as string) || "soul-2";
        const width = (input.width as number) || 1080;
        const height = (input.height as number) || 1080;

        const body: Record<string, unknown> = {
          type: "text-to-image",
          model,
          prompt,
          width,
          height,
        };
        if (input.character_id) {
          body.character_id = input.character_id;
        }

        const res = await fetch(`${BASE_URL}/generations`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Higgsfield generate-image failed: ${res.status} ${errText}`),
            provider: "higgsfield",
          };
        }

        const data = (await res.json()) as Record<string, unknown>;
        const generationId =
          (data.generation_id as string) || (data.id as string);

        // Poll up to 3 times at 2s intervals
        const completed = await pollGeneration(generationId, apiKey, 3, 2000);

        if (completed) {
          const status = completed.status as string | undefined;
          if (status === "completed" || status === "succeeded") {
            return {
              success: true,
              data: completed,
              provider: "higgsfield",
              units_consumed: 1,
            };
          }
          // Failed
          return {
            success: false,
            error: `Generation failed: ${JSON.stringify(completed)}`,
            provider: "higgsfield",
          };
        }

        // Still processing — return ID for manual polling
        return {
          success: true,
          data: {
            generation_id: generationId,
            status: "processing",
            message:
              "Image is still generating. Use check-status with this generation_id to poll.",
          },
          provider: "higgsfield",
          units_consumed: 1,
        };
      }

      // ── generate-video ────────────────────────────────────────────
      if (operation === "generate-video") {
        const prompt = input.prompt as string | undefined;
        const imageUrl = input.image_url as string | undefined;

        if (!prompt && !imageUrl) {
          return {
            success: false,
            error:
              "At least one of prompt or image_url is required for video generation",
            provider: "higgsfield",
          };
        }

        const type = imageUrl ? "image-to-video" : "text-to-video";
        const model = (input.model as string) || "kling-3";
        const duration = (input.duration as number) || 5;
        const quality = (input.quality as string) || "standard";

        const body: Record<string, unknown> = {
          type,
          model,
          duration,
          quality,
        };
        if (prompt) body.prompt = prompt;
        if (imageUrl) body.image_url = imageUrl;
        if (input.character_id) body.character_id = input.character_id;

        const res = await fetch(`${BASE_URL}/generations`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Higgsfield generate-video failed: ${res.status} ${errText}`),
            provider: "higgsfield",
          };
        }

        const data = (await res.json()) as Record<string, unknown>;
        const generationId =
          (data.generation_id as string) || (data.id as string);

        // Poll up to 3 times at 5s intervals (videos take longer)
        const completed = await pollGeneration(generationId, apiKey, 3, 5000);

        if (completed) {
          const status = completed.status as string | undefined;
          if (status === "completed" || status === "succeeded") {
            return {
              success: true,
              data: completed,
              provider: "higgsfield",
              units_consumed: 1,
            };
          }
          return {
            success: false,
            error: `Generation failed: ${JSON.stringify(completed)}`,
            provider: "higgsfield",
          };
        }

        return {
          success: true,
          data: {
            generation_id: generationId,
            status: "processing",
            message:
              "Video is still generating. Use check-status with this generation_id to poll.",
          },
          provider: "higgsfield",
          units_consumed: 1,
        };
      }

      // ── create-character ──────────────────────────────────────────
      if (operation === "create-character") {
        const name = input.name as string | undefined;
        const images = input.images as string[] | undefined;

        if (!name) {
          return {
            success: false,
            error: "Missing required field: name",
            provider: "higgsfield",
          };
        }
        if (!images || images.length === 0) {
          return {
            success: false,
            error:
              "Missing required field: images (array of reference image URLs)",
            provider: "higgsfield",
          };
        }

        const res = await fetch(`${BASE_URL}/characters`, {
          method: "POST",
          headers,
          body: JSON.stringify({ name, reference_images: images }),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Higgsfield create-character failed: ${res.status} ${errText}`),
            provider: "higgsfield",
          };
        }

        const data = (await res.json()) as Record<string, unknown>;
        return {
          success: true,
          data: {
            character_id: data.character_id || data.id,
            name,
            status: data.status || "created",
          },
          provider: "higgsfield",
          units_consumed: 1,
        };
      }

      // ── check-status ──────────────────────────────────────────────
      if (operation === "check-status") {
        const generationId = input.generation_id as string | undefined;
        if (!generationId) {
          return {
            success: false,
            error: "Missing required field: generation_id",
            provider: "higgsfield",
          };
        }

        const res = await fetch(`${BASE_URL}/generations/${generationId}`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Higgsfield check-status failed: ${res.status} ${errText}`),
            provider: "higgsfield",
          };
        }

        const data = (await res.json()) as Record<string, unknown>;
        return {
          success: true,
          data,
          provider: "higgsfield",
          units_consumed: 0,
        };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "higgsfield",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "higgsfield" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    const apiKey = getApiKey();
    if (!apiKey) {
      return { healthy: false, latency_ms: Date.now() - start };
    }

    try {
      const res = await fetch(`${BASE_URL}/generations`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      // 200 = authenticated, 401 = bad key, both prove API is reachable
      return {
        healthy: res.status === 200 || res.status === 401,
        latency_ms: Date.now() - start,
      };
    } catch {
      return { healthy: false, latency_ms: Date.now() - start };
    }
  },

  estimateCost(operation: string): number {
    if (operation === "generate-image") return 0.15;
    if (operation === "generate-video") return 0.5;
    if (operation === "create-character") return 2.5;
    if (operation === "check-status") return 0.001;
    if (operation === "list-models") return 0;
    return 0.01;
  },
};
