import type { ToolAdapter, AdapterResult } from "../gateway-types";
import { redactCreds } from "../redact-creds";

const BASE_URL_V2 = "https://api.heygen.com/v2";
const BASE_URL_V1 = "https://api.heygen.com/v1";

function getApiKey(byokKey?: string): string | null {
  return byokKey || process.env.HEYGEN_API_KEY || null;
}

export const heygenAdapter: ToolAdapter = {
  slug: "heygen",
  name: "HeyGen",
  description:
    "AI avatar video generation — create talking-head videos, list available avatars, check video status",
  operations: ["create-video", "list-avatars", "get-video"],

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
          "No API key configured. Set HEYGEN_API_KEY or provide your own key via BYOK.",
        provider: "heygen",
      };
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
    };

    try {
      if (operation === "create-video") {
        const script = input.script as string | undefined;
        if (!script) {
          return {
            success: false,
            error: "Missing required field: script (the text the avatar will speak)",
            provider: "heygen",
          };
        }

        const avatar_id =
          (input.avatar_id as string) || "Daisy-inskirt-20220818";
        const voice_id =
          (input.voice_id as string) || "1bd001e7e50f421d891986aad5c8bbd2";

        const width = (input.width as number) || 1920;
        const height = (input.height as number) || 1080;

        const body = {
          video_inputs: [
            {
              character: {
                type: "avatar",
                avatar_id,
                avatar_style: "normal",
              },
              voice: {
                type: "text",
                input_text: script,
                voice_id,
              },
            },
          ],
          dimension: { width, height },
        };

        const res = await fetch(`${BASE_URL_V2}/video/generate`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`HeyGen create-video failed: ${res.status} ${errText}`),
            provider: "heygen",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data: {
            video_id: data.data?.video_id,
            status: data.data?.status || "processing",
          },
          provider: "heygen",
          units_consumed: 1,
        };
      }

      if (operation === "list-avatars") {
        const res = await fetch(`${BASE_URL_V2}/avatars`, {
          headers: { "X-Api-Key": apiKey },
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`HeyGen list-avatars failed: ${res.status} ${errText}`),
            provider: "heygen",
          };
        }

        const data = await res.json();
        const limit = (input.limit as number) || 20;
        const avatars = (data.data?.avatars || []).slice(0, limit);

        return {
          success: true,
          data: {
            avatars: avatars.map(
              (a: {
                avatar_id?: string;
                avatar_name?: string;
                gender?: string;
                preview_image_url?: string;
              }) => ({
                avatar_id: a.avatar_id,
                avatar_name: a.avatar_name,
                gender: a.gender,
                preview_image_url: a.preview_image_url,
              })
            ),
            total: data.data?.avatars?.length || 0,
          },
          provider: "heygen",
          units_consumed: 1,
        };
      }

      if (operation === "get-video") {
        const video_id = input.video_id as string | undefined;
        if (!video_id) {
          return {
            success: false,
            error: "Missing required field: video_id",
            provider: "heygen",
          };
        }

        const res = await fetch(
          `${BASE_URL_V1}/video_status.get?video_id=${encodeURIComponent(video_id)}`,
          { headers: { "X-Api-Key": apiKey } }
        );

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`HeyGen get-video failed: ${res.status} ${errText}`),
            provider: "heygen",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data: {
            video_id: data.data?.video_id,
            status: data.data?.status,
            video_url: data.data?.video_url,
            thumbnail_url: data.data?.thumbnail_url,
            duration: data.data?.duration,
          },
          provider: "heygen",
          units_consumed: 0,
        };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "heygen",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "heygen" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    const apiKey = getApiKey();
    if (!apiKey) {
      return { healthy: false, latency_ms: Date.now() - start };
    }

    try {
      const res = await fetch(`${BASE_URL_V2}/avatars`, {
        headers: { "X-Api-Key": apiKey },
      });
      return { healthy: res.ok, latency_ms: Date.now() - start };
    } catch {
      return { healthy: false, latency_ms: Date.now() - start };
    }
  },

  estimateCost(operation: string): number {
    if (operation === "create-video") return 0.5;
    if (operation === "list-avatars") return 0.001;
    if (operation === "get-video") return 0.001;
    return 0.01;
  },
};
