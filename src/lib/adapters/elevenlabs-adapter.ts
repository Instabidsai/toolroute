import type { ToolAdapter, AdapterResult } from "../gateway-types";
import { fetchWithTimeout } from "../fetch-with-timeout";

const BASE_URL = "https://api.elevenlabs.io/v1";
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
const DEFAULT_MODEL_ID = "eleven_monolingual_v1";

function getApiKey(byokKey?: string): string | null {
  return byokKey || process.env.ELEVENLABS_API_KEY || null;
}

export const elevenlabsAdapter: ToolAdapter = {
  slug: "elevenlabs",
  name: "ElevenLabs",
  description:
    "Text-to-speech — generate natural-sounding audio from text or list available voices",
  operations: ["text-to-speech", "voices"],

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
          "No API key configured. Provide your own key via BYOK or contact support.",
        provider: "elevenlabs",
      };
    }

    try {
      if (operation === "text-to-speech") {
        const text = input.text as string;
        if (!text) {
          return {
            success: false,
            error: "Missing required field: text",
            provider: "elevenlabs",
          };
        }

        const voiceId = (input.voice_id as string) || DEFAULT_VOICE_ID;
        const modelId = (input.model_id as string) || DEFAULT_MODEL_ID;

        const res = await fetchWithTimeout(`${BASE_URL}/text-to-speech/${voiceId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": apiKey,
          },
          body: JSON.stringify({
            text,
            model_id: modelId,
          }),
          timeoutMs: 60_000,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: `ElevenLabs text-to-speech failed: ${res.status} ${errText}`,
            provider: "elevenlabs",
          };
        }

        const arrayBuffer = await res.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");

        return {
          success: true,
          data: {
            audio_base64: base64,
            content_type: "audio/mpeg",
            char_count: text.length,
          },
          provider: "elevenlabs",
        };
      }

      if (operation === "voices") {
        const res = await fetchWithTimeout(`${BASE_URL}/voices`, {
          method: "GET",
          headers: { "xi-api-key": apiKey },
          timeoutMs: 10_000,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: `ElevenLabs voices failed: ${res.status} ${errText}`,
            provider: "elevenlabs",
          };
        }

        const data = await res.json();
        return { success: true, data, provider: "elevenlabs" };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "elevenlabs",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "elevenlabs" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    const apiKey = getApiKey();
    if (!apiKey) {
      return { healthy: false, latency_ms: Date.now() - start };
    }

    try {
      const res = await fetchWithTimeout(`${BASE_URL}/voices`, {
        method: "GET",
        headers: { "xi-api-key": apiKey },
        timeoutMs: 10_000,
      });
      return { healthy: res.ok, latency_ms: Date.now() - start };
    } catch {
      return { healthy: false, latency_ms: Date.now() - start };
    }
  },

  estimateCost(operation: string, input: Record<string, unknown>): number {
    if (operation === "text-to-speech") {
      const text = input.text as string;
      const chars = text ? text.length : 100;
      return chars * 0.0003;
    }
    if (operation === "voices") return 0.0001;
    return 0.001;
  },
};
