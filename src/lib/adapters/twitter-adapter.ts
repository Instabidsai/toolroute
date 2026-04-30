import type { ToolAdapter, AdapterResult } from "../gateway-types";
import { redactCreds } from "../redact-creds";
import { fetchWithTimeout } from "../fetch-with-timeout";

const TWITTER_BASE_URL = "https://api.x.com/2";

function getBearerToken(byokKey?: string): string | null {
  return byokKey || process.env.TWITTER_BEARER_TOKEN || null;
}

export const twitterAdapter: ToolAdapter = {
  slug: "twitter",
  name: "Twitter/X",
  description:
    "Post tweets, search, read mentions, manage profile on Twitter/X via the v2 API.",
  operations: [
    "post-tweet",
    "search-tweets",
    "get-mentions",
    "get-user",
    "delete-tweet",
  ],

  async execute(
    operation: string,
    input: Record<string, unknown>,
    byokKey?: string
  ): Promise<AdapterResult> {
    const token = getBearerToken(byokKey);
    if (!token) {
      return {
        success: false,
        error:
          "No API key configured. Set TWITTER_BEARER_TOKEN or provide your own key via BYOK.",
        provider: "twitter",
      };
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    try {
      if (operation === "post-tweet") {
        const text = input.text as string;
        if (!text) {
          return {
            success: false,
            error: "Missing required field: text",
            provider: "twitter",
          };
        }

        const body: Record<string, unknown> = { text };
        if (input.media_ids && Array.isArray(input.media_ids)) {
          body.media = { media_ids: input.media_ids };
        }

        const res = await fetchWithTimeout(`${TWITTER_BASE_URL}/tweets`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Twitter post-tweet failed: ${res.status} ${errText}`),
            provider: "twitter",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data,
          provider: "twitter",
          units_consumed: 1,
        };
      }

      if (operation === "search-tweets") {
        const query = input.query as string;
        if (!query) {
          return {
            success: false,
            error: "Missing required field: query",
            provider: "twitter",
          };
        }

        const maxResults = (input.max_results as number) ?? 10;
        const params = new URLSearchParams({
          query,
          max_results: String(maxResults),
          "tweet.fields": "created_at,public_metrics,author_id",
        });

        const res = await fetchWithTimeout(
          `${TWITTER_BASE_URL}/tweets/search/recent?${params}`,
          { headers }
        );

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Twitter search-tweets failed: ${res.status} ${errText}`),
            provider: "twitter",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data,
          provider: "twitter",
          units_consumed: 1,
        };
      }

      if (operation === "get-mentions") {
        const userId = input.user_id as string;
        if (!userId) {
          return {
            success: false,
            error: "Missing required field: user_id",
            provider: "twitter",
          };
        }

        const maxResults = (input.max_results as number) ?? 10;
        const params = new URLSearchParams({
          max_results: String(maxResults),
          "tweet.fields": "created_at,text,author_id",
        });

        const res = await fetchWithTimeout(
          `${TWITTER_BASE_URL}/users/${userId}/mentions?${params}`,
          { headers }
        );

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Twitter get-mentions failed: ${res.status} ${errText}`),
            provider: "twitter",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data,
          provider: "twitter",
          units_consumed: 1,
        };
      }

      if (operation === "get-user") {
        const username = input.username as string;
        if (!username) {
          return {
            success: false,
            error: "Missing required field: username",
            provider: "twitter",
          };
        }

        const params = new URLSearchParams({
          "user.fields":
            "name,description,public_metrics,profile_image_url",
        });

        const res = await fetchWithTimeout(
          `${TWITTER_BASE_URL}/users/by/username/${username}?${params}`,
          { headers }
        );

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Twitter get-user failed: ${res.status} ${errText}`),
            provider: "twitter",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data,
          provider: "twitter",
          units_consumed: 1,
        };
      }

      if (operation === "delete-tweet") {
        const tweetId = input.tweet_id as string;
        if (!tweetId) {
          return {
            success: false,
            error: "Missing required field: tweet_id",
            provider: "twitter",
          };
        }

        const res = await fetchWithTimeout(
          `${TWITTER_BASE_URL}/tweets/${tweetId}`,
          { method: "DELETE", headers }
        );

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Twitter delete-tweet failed: ${res.status} ${errText}`),
            provider: "twitter",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data,
          provider: "twitter",
          units_consumed: 1,
        };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "twitter",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "twitter" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    const token = getBearerToken();
    if (!token) {
      return { healthy: false, latency_ms: Date.now() - start };
    }

    try {
      const res = await fetchWithTimeout(`${TWITTER_BASE_URL}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return { healthy: res.ok, latency_ms: Date.now() - start };
    } catch {
      return { healthy: false, latency_ms: Date.now() - start };
    }
  },

  estimateCost(operation: string): number {
    if (operation === "post-tweet") return 0.005;
    if (operation === "search-tweets") return 0.003;
    if (operation === "get-mentions") return 0.003;
    if (operation === "get-user") return 0.002;
    if (operation === "delete-tweet") return 0.002;
    return 0.003;
  },
};
