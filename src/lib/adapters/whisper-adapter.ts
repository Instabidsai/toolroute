import type { ToolAdapter, AdapterResult } from "../gateway-types";

const API_URL = "https://api.openai.com/v1/audio/transcriptions";

function getApiKey(byokKey?: string): string | null {
  return byokKey || process.env.OPENAI_API_KEY || null;
}

export const whisperAdapter: ToolAdapter = {
  slug: "whisper",
  name: "Whisper",
  description:
    "OpenAI Whisper speech-to-text — transcribe audio from a URL into text",
  operations: ["transcribe"],

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
          "No API key configured. Provide your own key via BYOK or set OPENAI_API_KEY.",
        provider: "whisper",
      };
    }

    try {
      if (operation === "transcribe") {
        const audioUrl = input.audio_url as string;
        if (!audioUrl) {
          return {
            success: false,
            error: "Missing required field: audio_url",
            provider: "whisper",
          };
        }

        const model = (input.model as string) ?? "whisper-1";
        const language = input.language as string | undefined;

        // Download the audio file from the URL
        const audioRes = await fetch(audioUrl);
        if (!audioRes.ok) {
          return {
            success: false,
            error: `Failed to download audio from URL: ${audioRes.status} ${audioRes.statusText}`,
            provider: "whisper",
          };
        }

        const audioBuffer = await audioRes.arrayBuffer();

        // Determine filename from URL for content type hints
        const urlPath = new URL(audioUrl).pathname;
        const filename =
          urlPath.split("/").pop() || "audio.mp3";

        const blob = new Blob([audioBuffer]);

        // Build multipart form data
        const formData = new FormData();
        formData.append("file", blob, filename);
        formData.append("model", model);
        if (language) {
          formData.append("language", language);
        }
        if (input.response_format) {
          formData.append(
            "response_format",
            input.response_format as string
          );
        }

        const res = await fetch(API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          body: formData,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: `Whisper transcribe failed: ${res.status} ${errText}`,
            provider: "whisper",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data,
          provider: "whisper",
          units_consumed: 1,
        };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "whisper",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "whisper" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    const apiKey = getApiKey();
    if (!apiKey) {
      return { healthy: false, latency_ms: Date.now() - start };
    }

    // Whisper has no lightweight ping endpoint; check that the API key is valid
    // by hitting the models endpoint
    try {
      const res = await fetch("https://api.openai.com/v1/models/whisper-1", {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return { healthy: res.ok, latency_ms: Date.now() - start };
    } catch {
      return { healthy: false, latency_ms: Date.now() - start };
    }
  },

  estimateCost(): number {
    // ~$0.006/min, estimate 1 min average per call
    return 0.01;
  },
};
