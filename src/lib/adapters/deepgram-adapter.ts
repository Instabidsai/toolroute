import type { ToolAdapter, AdapterResult } from "../gateway-types";

const BASE_URL = "https://api.deepgram.com/v1";

function getApiKey(byokKey?: string): string | null {
  return byokKey || process.env.DEEPGRAM_API_KEY || null;
}

export const deepgramAdapter: ToolAdapter = {
  slug: "deepgram",
  name: "Deepgram",
  description:
    "Speech-to-text transcription — faster and cheaper than Whisper, supports URL and base64 audio",
  operations: ["transcribe", "transcribe-url"],

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
          "No API key configured. Set DEEPGRAM_API_KEY or provide your own key via BYOK.",
        provider: "deepgram",
      };
    }

    try {
      // Both "transcribe" and "transcribe-url" use URL-based transcription
      if (operation === "transcribe" || operation === "transcribe-url") {
        const url = input.url as string | undefined;
        if (!url) {
          return {
            success: false,
            error:
              "Missing required field: url (URL to an audio file)",
            provider: "deepgram",
          };
        }

        const model = (input.model as string) || "nova-3";
        const language = (input.language as string) || "en";
        const smart_format =
          input.smart_format !== undefined ? input.smart_format : true;
        const punctuate =
          input.punctuate !== undefined ? input.punctuate : true;

        const params = new URLSearchParams({
          model,
          language,
          smart_format: String(smart_format),
          punctuate: String(punctuate),
        });

        const res = await fetch(`${BASE_URL}/listen?${params.toString()}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Token ${apiKey}`,
          },
          body: JSON.stringify({ url }),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: `Deepgram transcription failed: ${res.status} ${errText}`,
            provider: "deepgram",
          };
        }

        const data = await res.json();
        const transcript =
          data.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
        const confidence =
          data.results?.channels?.[0]?.alternatives?.[0]?.confidence;
        const duration = data.metadata?.duration;

        return {
          success: true,
          data: {
            transcript,
            confidence,
            duration_seconds: duration,
            model: data.metadata?.model_info,
            words:
              data.results?.channels?.[0]?.alternatives?.[0]?.words,
          },
          provider: "deepgram",
          units_consumed: duration ? Math.ceil(duration / 60) : 1,
        };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "deepgram",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "deepgram" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    const apiKey = getApiKey();
    if (!apiKey) {
      return { healthy: false, latency_ms: Date.now() - start };
    }

    try {
      // Use the projects endpoint to verify the key works
      const res = await fetch("https://api.deepgram.com/v1/projects", {
        headers: { Authorization: `Token ${apiKey}` },
      });
      return { healthy: res.ok, latency_ms: Date.now() - start };
    } catch {
      return { healthy: false, latency_ms: Date.now() - start };
    }
  },

  estimateCost(operation: string): number {
    if (operation === "transcribe" || operation === "transcribe-url")
      return 0.005;
    return 0.005;
  },
};
