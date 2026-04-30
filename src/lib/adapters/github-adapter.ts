import type { ToolAdapter, AdapterResult } from "../gateway-types";
import { redactCreds } from "../redact-creds";
import { fetchWithTimeout } from "../fetch-with-timeout";

const API_BASE = "https://api.github.com";

function getHeaders(byokKey?: string): Record<string, string> {
  const token = byokKey || process.env.GITHUB_TOKEN || null;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "ToolRoute/1.0",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export const githubAdapter: ToolAdapter = {
  slug: "github",
  name: "GitHub",
  description:
    "GitHub API — search repositories, read READMEs, and list issues through a unified interface",
  operations: ["search-repos", "get-readme", "list-issues"],

  async execute(
    operation: string,
    input: Record<string, unknown>,
    byokKey?: string
  ): Promise<AdapterResult> {
    const headers = getHeaders(byokKey);

    try {
      if (operation === "search-repos") {
        const query = input.query as string;
        if (!query) {
          return {
            success: false,
            error: "Missing required field: query",
            provider: "github",
          };
        }

        const perPage = (input.per_page as number) ?? 10;
        const params = new URLSearchParams({
          q: query,
          per_page: String(perPage),
        });

        const res = await fetchWithTimeout(
          `${API_BASE}/search/repositories?${params.toString()}`,
          { headers }
        );

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`GitHub search failed: ${res.status} ${errText}`),
            provider: "github",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data: {
            total_count: data.total_count,
            items: data.items?.map(
              (r: Record<string, unknown>) => ({
                full_name: r.full_name,
                description: r.description,
                html_url: r.html_url,
                stargazers_count: r.stargazers_count,
                language: r.language,
                updated_at: r.updated_at,
                topics: r.topics,
              })
            ),
          },
          provider: "github",
          units_consumed: 1,
        };
      }

      if (operation === "get-readme") {
        const owner = input.owner as string;
        const repo = input.repo as string;
        if (!owner || !repo) {
          return {
            success: false,
            error: "Missing required fields: owner, repo",
            provider: "github",
          };
        }

        const res = await fetchWithTimeout(
          `${API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme`,
          { headers }
        );

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`GitHub get-readme failed: ${res.status} ${errText}`),
            provider: "github",
          };
        }

        const data = await res.json();

        // Decode base64 content
        let content = "";
        if (data.content) {
          try {
            content = Buffer.from(data.content, "base64").toString("utf-8");
          } catch {
            content = data.content;
          }
        }

        return {
          success: true,
          data: {
            name: data.name,
            path: data.path,
            content,
            html_url: data.html_url,
            size: data.size,
          },
          provider: "github",
          units_consumed: 1,
        };
      }

      if (operation === "list-issues") {
        const owner = input.owner as string;
        const repo = input.repo as string;
        if (!owner || !repo) {
          return {
            success: false,
            error: "Missing required fields: owner, repo",
            provider: "github",
          };
        }

        const state = (input.state as string) ?? "open";
        const perPage = (input.per_page as number) ?? 10;
        const params = new URLSearchParams({
          state,
          per_page: String(perPage),
        });

        const res = await fetchWithTimeout(
          `${API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?${params.toString()}`,
          { headers }
        );

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`GitHub list-issues failed: ${res.status} ${errText}`),
            provider: "github",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data: {
            count: data.length,
            issues: data.map(
              (issue: Record<string, unknown>) => ({
                number: issue.number,
                title: issue.title,
                state: issue.state,
                html_url: issue.html_url,
                user: (issue.user as Record<string, unknown>)?.login,
                labels: (issue.labels as Record<string, unknown>[])?.map(
                  (l) => l.name
                ),
                created_at: issue.created_at,
                updated_at: issue.updated_at,
                comments: issue.comments,
              })
            ),
          },
          provider: "github",
          units_consumed: 1,
        };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "github",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "github" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    try {
      const headers = getHeaders();
      const res = await fetchWithTimeout(`${API_BASE}/rate_limit`, { headers });
      return { healthy: res.ok, latency_ms: Date.now() - start };
    } catch {
      return { healthy: false, latency_ms: Date.now() - start };
    }
  },

  estimateCost(): number {
    return 0.001;
  },
};
