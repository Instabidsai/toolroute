import type { ToolAdapter, AdapterResult } from "../gateway-types";
import { redactCreds } from "../redact-creds";
import { fetchWithTimeout } from "../fetch-with-timeout";

const BASE_URL = "https://sentry.io/api/0";

function getApiKey(byokKey?: string): string | null {
  return byokKey || process.env.SENTRY_AUTH_TOKEN || null;
}

export const sentryAdapter: ToolAdapter = {
  slug: "sentry",
  name: "Sentry",
  description: "Error tracking and performance monitoring — list issues, get details, view events",
  operations: ["list-issues", "get-issue", "list-events"],

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
          "No API key configured. Set SENTRY_AUTH_TOKEN or provide your own key via BYOK.",
        provider: "sentry",
      };
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
    };

    try {
      if (operation === "list-issues") {
        const organization = input.organization as string | undefined;
        const project = input.project as string | undefined;
        if (!organization || !project) {
          return {
            success: false,
            error: "Missing required fields: organization, project",
            provider: "sentry",
          };
        }

        const query = (input.query as string) || "is:unresolved";
        const limit = (input.limit as number) || 10;

        const url = `${BASE_URL}/projects/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/issues/?query=${encodeURIComponent(query)}&limit=${limit}`;

        const res = await fetchWithTimeout(url, { headers });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Sentry list-issues failed: ${res.status} ${errText}`),
            provider: "sentry",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data,
          provider: "sentry",
          units_consumed: 1,
        };
      }

      if (operation === "get-issue") {
        const organization = input.organization as string | undefined;
        const issue_id = input.issue_id as string | undefined;
        if (!organization || !issue_id) {
          return {
            success: false,
            error: "Missing required fields: organization, issue_id",
            provider: "sentry",
          };
        }

        const url = `${BASE_URL}/organizations/${encodeURIComponent(organization)}/issues/${encodeURIComponent(issue_id)}/`;

        const res = await fetchWithTimeout(url, { headers });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Sentry get-issue failed: ${res.status} ${errText}`),
            provider: "sentry",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data,
          provider: "sentry",
          units_consumed: 1,
        };
      }

      if (operation === "list-events") {
        const organization = input.organization as string | undefined;
        const issue_id = input.issue_id as string | undefined;
        if (!organization || !issue_id) {
          return {
            success: false,
            error: "Missing required fields: organization, issue_id",
            provider: "sentry",
          };
        }

        const limit = (input.limit as number) || 10;
        const url = `${BASE_URL}/organizations/${encodeURIComponent(organization)}/issues/${encodeURIComponent(issue_id)}/events/?limit=${limit}`;

        const res = await fetchWithTimeout(url, { headers });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Sentry list-events failed: ${res.status} ${errText}`),
            provider: "sentry",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data,
          provider: "sentry",
          units_consumed: 1,
        };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "sentry",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "sentry" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    const apiKey = getApiKey();
    if (!apiKey) {
      return { healthy: false, latency_ms: Date.now() - start };
    }

    try {
      const res = await fetchWithTimeout(`${BASE_URL}/`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return { healthy: res.ok, latency_ms: Date.now() - start };
    } catch {
      return { healthy: false, latency_ms: Date.now() - start };
    }
  },

  estimateCost(): number {
    return 0.001;
  },
};
