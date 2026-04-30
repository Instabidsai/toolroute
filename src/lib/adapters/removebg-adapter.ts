import type { ToolAdapter, AdapterResult } from "../gateway-types";
import { redactCreds } from "../redact-creds";

const BASE_URL = "https://api.remove.bg/v1.0";

function getApiKey(byokKey?: string): string | null {
  return byokKey || process.env.REMOVEBG_API_KEY || null;
}

export const removebgAdapter: ToolAdapter = {
  slug: "removebg",
  name: "Remove.bg",
  description:
    "AI background removal — remove backgrounds from product photos, headshots, and ad creative",
  operations: ["remove"],

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
          "No API key configured. Set REMOVEBG_API_KEY or provide your own key via BYOK.",
        provider: "removebg",
      };
    }

    try {
      if (operation === "remove") {
        const imageUrl = input.image_url as string;
        const imageBase64 = input.image_base64 as string;

        if (!imageUrl && !imageBase64) {
          return {
            success: false,
            error:
              "Missing required field: image_url or image_base64",
            provider: "removebg",
          };
        }

        const formParts: string[] = [];
        const boundary = `----FormBoundary${Date.now()}`;

        if (imageUrl) {
          formParts.push(
            `--${boundary}\r\nContent-Disposition: form-data; name="image_url"\r\n\r\n${imageUrl}`
          );
        } else if (imageBase64) {
          formParts.push(
            `--${boundary}\r\nContent-Disposition: form-data; name="image_file_b64"\r\n\r\n${imageBase64}`
          );
        }

        formParts.push(
          `--${boundary}\r\nContent-Disposition: form-data; name="size"\r\n\r\nauto`
        );
        formParts.push(`--${boundary}--`);

        const body = formParts.join("\r\n");

        const res = await fetch(`${BASE_URL}/removebg`, {
          method: "POST",
          headers: {
            "X-Api-Key": apiKey,
            "Content-Type": `multipart/form-data; boundary=${boundary}`,
          },
          body,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Remove.bg failed: ${res.status} ${errText}`),
            provider: "removebg",
          };
        }

        const arrayBuffer = await res.arrayBuffer();
        const base64Result = Buffer.from(arrayBuffer).toString("base64");

        return {
          success: true,
          data: {
            image_base64: base64Result,
            content_type: "image/png",
          },
          provider: "removebg",
          units_consumed: 1,
        };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "removebg",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "removebg" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    const apiKey = getApiKey();
    if (!apiKey) {
      return { healthy: false, latency_ms: Date.now() - start };
    }

    // remove.bg doesn't have a lightweight health endpoint, so we just verify the key exists
    return { healthy: true, latency_ms: Date.now() - start };
  },

  estimateCost(): number {
    return 0.1;
  },
};
