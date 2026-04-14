import type { ToolAdapter, AdapterResult } from "../gateway-types";

const MGMT_API_URL = "https://api.supabase.com/v1";

function getMgmtToken(byokKey?: string): string | null {
  return byokKey || process.env.SUPABASE_MGMT_TOKEN || null;
}

export const supabaseAdapter: ToolAdapter = {
  slug: "supabase",
  name: "Supabase",
  description:
    "Supabase database operations — execute SQL, list tables, insert and select rows via REST or Management API",
  operations: ["execute-sql", "list-tables", "insert", "select"],

  async execute(
    operation: string,
    input: Record<string, unknown>,
    byokKey?: string
  ): Promise<AdapterResult> {
    try {
      if (operation === "execute-sql") {
        const mgmtToken = getMgmtToken(byokKey);
        if (!mgmtToken) {
          return {
            success: false,
            error:
              "No management token configured. Provide your own key via BYOK or set SUPABASE_MGMT_TOKEN.",
            provider: "supabase",
          };
        }

        const projectRef = input.project_ref as string;
        const sql = input.sql as string;
        if (!projectRef || !sql) {
          return {
            success: false,
            error: "Missing required fields: project_ref, sql",
            provider: "supabase",
          };
        }

        const res = await fetch(
          `${MGMT_API_URL}/projects/${projectRef}/database/query`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${mgmtToken}`,
            },
            body: JSON.stringify({ query: sql }),
          }
        );

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: `Supabase execute-sql failed: ${res.status} ${errText}`,
            provider: "supabase",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data,
          provider: "supabase",
          units_consumed: 1,
        };
      }

      if (operation === "list-tables") {
        const mgmtToken = getMgmtToken(byokKey);
        if (!mgmtToken) {
          return {
            success: false,
            error:
              "No management token configured. Provide your own key via BYOK or set SUPABASE_MGMT_TOKEN.",
            provider: "supabase",
          };
        }

        const projectRef = input.project_ref as string;
        if (!projectRef) {
          return {
            success: false,
            error: "Missing required field: project_ref",
            provider: "supabase",
          };
        }

        const sql = `SELECT table_schema, table_name, table_type FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema') ORDER BY table_schema, table_name`;

        const res = await fetch(
          `${MGMT_API_URL}/projects/${projectRef}/database/query`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${mgmtToken}`,
            },
            body: JSON.stringify({ query: sql }),
          }
        );

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: `Supabase list-tables failed: ${res.status} ${errText}`,
            provider: "supabase",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data,
          provider: "supabase",
          units_consumed: 1,
        };
      }

      if (operation === "insert") {
        const projectUrl = input.project_url as string;
        const anonKey = input.anon_key as string;
        const table = input.table as string;
        const data = input.data as Record<string, unknown>;

        if (!projectUrl || !anonKey || !table || !data) {
          return {
            success: false,
            error:
              "Missing required fields: project_url, anon_key, table, data",
            provider: "supabase",
          };
        }

        const res = await fetch(`${projectUrl}/rest/v1/${table}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            Prefer: "return=representation",
          },
          body: JSON.stringify(data),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: `Supabase insert failed: ${res.status} ${errText}`,
            provider: "supabase",
          };
        }

        const result = await res.json();
        return {
          success: true,
          data: result,
          provider: "supabase",
          units_consumed: 1,
        };
      }

      if (operation === "select") {
        const projectUrl = input.project_url as string;
        const anonKey = input.anon_key as string;
        const table = input.table as string;

        if (!projectUrl || !anonKey || !table) {
          return {
            success: false,
            error: "Missing required fields: project_url, anon_key, table",
            provider: "supabase",
          };
        }

        let url = `${projectUrl}/rest/v1/${table}?select=*`;

        const filters = input.filters as Record<string, string> | undefined;
        if (filters) {
          for (const [key, value] of Object.entries(filters)) {
            url += `&${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
          }
        }

        const limit = input.limit as number | undefined;
        if (limit) {
          url += `&limit=${limit}`;
        }

        const res = await fetch(url, {
          method: "GET",
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
          },
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: `Supabase select failed: ${res.status} ${errText}`,
            provider: "supabase",
          };
        }

        const result = await res.json();
        return {
          success: true,
          data: result,
          provider: "supabase",
          units_consumed: 1,
        };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "supabase",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "supabase" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    const mgmtToken = getMgmtToken();
    if (!mgmtToken) {
      return { healthy: false, latency_ms: Date.now() - start };
    }

    try {
      const res = await fetch(`${MGMT_API_URL}/projects`, {
        method: "GET",
        headers: { Authorization: `Bearer ${mgmtToken}` },
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
