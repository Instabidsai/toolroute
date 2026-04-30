import type { ToolAdapter, AdapterResult } from "../gateway-types";
import { redactCreds } from "../redact-creds";

const YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3";

function getAccessToken(byokKey?: string): string | null {
  return byokKey || process.env.YOUTUBE_ACCESS_TOKEN || null;
}

export const youtubeAdapter: ToolAdapter = {
  slug: "youtube",
  name: "YouTube Data API",
  description:
    "Upload videos, search YouTube, read comments, manage channel via the YouTube Data API v3.",
  operations: ["upload-video", "list-videos", "get-comments", "search"],

  async execute(
    operation: string,
    input: Record<string, unknown>,
    byokKey?: string
  ): Promise<AdapterResult> {
    const token = getAccessToken(byokKey);
    if (!token) {
      return {
        success: false,
        error:
          "No API key configured. Set YOUTUBE_ACCESS_TOKEN or provide your own key via BYOK.",
        provider: "youtube",
      };
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    try {
      if (operation === "search") {
        const query = input.query as string;
        if (!query) {
          return {
            success: false,
            error: "Missing required field: query",
            provider: "youtube",
          };
        }

        const maxResults = (input.max_results as number) ?? 10;
        const params = new URLSearchParams({
          part: "snippet",
          q: query,
          maxResults: String(maxResults),
          type: "video",
        });

        const res = await fetch(`${YOUTUBE_API_URL}/search?${params}`, {
          headers,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`YouTube search failed: ${res.status} ${errText}`),
            provider: "youtube",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data,
          provider: "youtube",
          units_consumed: 1,
        };
      }

      if (operation === "list-videos") {
        const channelId = input.channel_id as string | undefined;
        const maxResults = (input.max_results as number) ?? 10;

        const params = new URLSearchParams({
          part: "snippet",
          maxResults: String(maxResults),
          type: "video",
        });

        if (channelId && channelId !== "mine") {
          params.set("channelId", channelId);
        } else {
          params.set("forMine", "true");
        }

        const res = await fetch(`${YOUTUBE_API_URL}/search?${params}`, {
          headers,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`YouTube list-videos failed: ${res.status} ${errText}`),
            provider: "youtube",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data,
          provider: "youtube",
          units_consumed: 1,
        };
      }

      if (operation === "get-comments") {
        const videoId = input.video_id as string;
        if (!videoId) {
          return {
            success: false,
            error: "Missing required field: video_id",
            provider: "youtube",
          };
        }

        const maxResults = (input.max_results as number) ?? 20;
        const params = new URLSearchParams({
          part: "snippet",
          videoId,
          maxResults: String(maxResults),
        });

        const res = await fetch(
          `${YOUTUBE_API_URL}/commentThreads?${params}`,
          { headers }
        );

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`YouTube get-comments failed: ${res.status} ${errText}`),
            provider: "youtube",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data,
          provider: "youtube",
          units_consumed: 1,
        };
      }

      if (operation === "upload-video") {
        // YouTube's resumable upload is a multi-step process that requires
        // streaming a binary file. We return the API instructions and metadata
        // format so the caller can complete the upload.
        const title = input.title as string;
        const description = input.description as string | undefined;
        const privacy = (input.privacy as string) ?? "private";
        const tags = (input.tags as string[]) ?? [];

        if (!title) {
          return {
            success: false,
            error: "Missing required field: title",
            provider: "youtube",
          };
        }

        // If a video_url is provided, we can try to initiate a resumable upload session
        const videoUrl = input.video_url as string | undefined;

        const snippet: Record<string, unknown> = {
          title,
          description: description ?? "",
          tags,
          categoryId: "22", // People & Blogs (default)
        };

        const status = {
          privacyStatus: privacy,
          selfDeclaredMadeForKids: false,
        };

        if (videoUrl) {
          // Initiate a resumable upload session
          const initParams = new URLSearchParams({
            uploadType: "resumable",
            part: "snippet,status",
          });

          const initRes = await fetch(
            `https://www.googleapis.com/upload/youtube/v3/videos?${initParams}`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                "X-Upload-Content-Type": "video/*",
              },
              body: JSON.stringify({ snippet, status }),
            }
          );

          if (!initRes.ok) {
            const errText = await initRes.text().catch(() => initRes.statusText);
            return {
              success: false,
              error: redactCreds(`YouTube upload init failed: ${initRes.status} ${errText}`),
              provider: "youtube",
            };
          }

          const uploadUrl = initRes.headers.get("location");
          return {
            success: true,
            data: {
              upload_url: uploadUrl,
              message:
                "Resumable upload session initiated. PUT your video binary to the upload_url. " +
                "For large files, use chunked upload with Content-Range headers.",
              video_url: videoUrl,
              snippet,
              status,
            },
            provider: "youtube",
            units_consumed: 1,
          };
        }

        // No video_url — return instructions
        return {
          success: true,
          data: {
            message:
              "YouTube video upload requires a resumable upload session. " +
              "Provide a video_url to initiate the session, or use the YouTube Studio UI. " +
              "The API endpoint is: POST https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
            snippet,
            status,
          },
          provider: "youtube",
          units_consumed: 0,
        };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "youtube",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "youtube" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    const token = getAccessToken();
    if (!token) {
      return { healthy: false, latency_ms: Date.now() - start };
    }

    try {
      const params = new URLSearchParams({
        part: "snippet",
        q: "test",
        maxResults: "1",
        type: "video",
      });
      const res = await fetch(`${YOUTUBE_API_URL}/search?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return { healthy: res.ok, latency_ms: Date.now() - start };
    } catch {
      return { healthy: false, latency_ms: Date.now() - start };
    }
  },

  estimateCost(operation: string): number {
    if (operation === "upload-video") return 0.01;
    return 0.002;
  },
};
