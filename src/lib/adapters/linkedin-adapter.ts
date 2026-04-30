import type { ToolAdapter, AdapterResult } from "../gateway-types";
import { redactCreds } from "../redact-creds";
import { fetchWithTimeout } from "../fetch-with-timeout";

const LINKEDIN_API_URL = "https://api.linkedin.com";

function getAccessToken(byokKey?: string): string | null {
  return byokKey || process.env.LINKEDIN_ACCESS_TOKEN || null;
}

export const linkedinAdapter: ToolAdapter = {
  slug: "linkedin",
  name: "LinkedIn",
  description:
    "Post to LinkedIn, manage profile, company pages via the LinkedIn REST API.",
  operations: ["create-post", "get-profile", "search-companies"],

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
          "No API key configured. Set LINKEDIN_ACCESS_TOKEN or provide your own key via BYOK.",
        provider: "linkedin",
      };
    }

    const baseHeaders: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "LinkedIn-Version": "202401",
      "X-Restli-Protocol-Version": "2.0.0",
    };

    try {
      if (operation === "get-profile") {
        const res = await fetchWithTimeout(`${LINKEDIN_API_URL}/v2/userinfo`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`LinkedIn get-profile failed: ${res.status} ${errText}`),
            provider: "linkedin",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data,
          provider: "linkedin",
          units_consumed: 1,
        };
      }

      if (operation === "create-post") {
        const text = input.text as string;
        if (!text) {
          return {
            success: false,
            error: "Missing required field: text",
            provider: "linkedin",
          };
        }

        // Get the author URN — either provided or fetched from /userinfo
        let authorUrn = input.author_urn as string | undefined;
        if (!authorUrn) {
          try {
            const profileRes = await fetchWithTimeout(
              `${LINKEDIN_API_URL}/v2/userinfo`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            if (profileRes.ok) {
              const profile = await profileRes.json();
              const sub = profile.sub as string;
              if (sub) {
                authorUrn = `urn:li:person:${sub}`;
              }
            }
          } catch {
            // Non-fatal — will fail below if no URN
          }
        }

        if (!authorUrn) {
          return {
            success: false,
            error:
              "Could not determine author URN. Provide author_urn in input or ensure token has /userinfo scope.",
            provider: "linkedin",
          };
        }

        const visibility =
          (input.visibility as string) ?? "PUBLIC";

        const body = {
          author: authorUrn,
          commentary: text,
          visibility,
          lifecycleState: "PUBLISHED",
          distribution: {
            feedDistribution: "MAIN_FEED",
          },
        };

        const res = await fetchWithTimeout(`${LINKEDIN_API_URL}/rest/posts`, {
          method: "POST",
          headers: baseHeaders,
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`LinkedIn create-post failed: ${res.status} ${errText}`),
            provider: "linkedin",
          };
        }

        // LinkedIn returns 201 with the post ID in the x-restli-id header
        const postId = res.headers.get("x-restli-id");
        return {
          success: true,
          data: {
            post_id: postId,
            status: "published",
            message: "Post created successfully",
          },
          provider: "linkedin",
          units_consumed: 1,
        };
      }

      if (operation === "search-companies") {
        // LinkedIn's company search API is very restricted (requires Marketing Developer Platform approval)
        return {
          success: true,
          data: {
            message:
              "LinkedIn company search requires Marketing Developer Platform approval. " +
              "Most applications don't have access. Consider using Apollo (apollo/search-companies) " +
              "or Exa (exa/search-companies) for company search instead.",
            alternative_tools: [
              "apollo/search-companies",
              "exa/search-companies",
            ],
          },
          provider: "linkedin",
          units_consumed: 0,
        };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "linkedin",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "linkedin" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    const token = getAccessToken();
    if (!token) {
      return { healthy: false, latency_ms: Date.now() - start };
    }

    try {
      const res = await fetchWithTimeout(`${LINKEDIN_API_URL}/v2/userinfo`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return { healthy: res.ok, latency_ms: Date.now() - start };
    } catch {
      return { healthy: false, latency_ms: Date.now() - start };
    }
  },

  estimateCost(operation: string): number {
    if (operation === "create-post") return 0.005;
    if (operation === "get-profile") return 0.002;
    if (operation === "search-companies") return 0.003;
    return 0.003;
  },
};
