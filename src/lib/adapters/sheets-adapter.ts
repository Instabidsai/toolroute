import type { ToolAdapter, AdapterResult } from "../gateway-types";
import { redactCreds } from "../redact-creds";

const SHEETS_BASE_URL = "https://sheets.googleapis.com/v4/spreadsheets";

function getApiKey(byokKey?: string): string | null {
  // Google Sheets requires OAuth token — BYOK only (no platform key)
  return byokKey || null;
}

function headers(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

export const sheetsAdapter: ToolAdapter = {
  slug: "sheets",
  name: "Google Sheets",
  description:
    "Spreadsheets — read, write, append, formulas. Universal data store for agents. BYOK-only (Google OAuth token).",
  operations: ["read-range", "write-range", "append-row", "get-spreadsheet"],

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
          "No API key configured. Google Sheets requires a BYOK OAuth token.",
        provider: "sheets",
      };
    }

    const hdrs = headers(apiKey);

    try {
      if (operation === "read-range") {
        const spreadsheetId = input.spreadsheet_id as string;
        const range = input.range as string;
        if (!spreadsheetId || !range) {
          return {
            success: false,
            error: "Missing required fields: spreadsheet_id, range",
            provider: "sheets",
          };
        }

        const encodedRange = encodeURIComponent(range);
        const res = await fetch(
          `${SHEETS_BASE_URL}/${spreadsheetId}/values/${encodedRange}`,
          {
            method: "GET",
            headers: hdrs,
          }
        );

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Sheets read-range failed: ${res.status} ${errText}`),
            provider: "sheets",
          };
        }

        const data = await res.json();
        return { success: true, data, provider: "sheets", units_consumed: 1 };
      }

      if (operation === "write-range") {
        const spreadsheetId = input.spreadsheet_id as string;
        const range = input.range as string;
        const values = input.values as unknown[][];
        if (!spreadsheetId || !range || !values) {
          return {
            success: false,
            error: "Missing required fields: spreadsheet_id, range, values",
            provider: "sheets",
          };
        }

        const encodedRange = encodeURIComponent(range);
        const res = await fetch(
          `${SHEETS_BASE_URL}/${spreadsheetId}/values/${encodedRange}?valueInputOption=USER_ENTERED`,
          {
            method: "PUT",
            headers: hdrs,
            body: JSON.stringify({ values }),
          }
        );

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Sheets write-range failed: ${res.status} ${errText}`),
            provider: "sheets",
          };
        }

        const data = await res.json();
        return { success: true, data, provider: "sheets", units_consumed: 1 };
      }

      if (operation === "append-row") {
        const spreadsheetId = input.spreadsheet_id as string;
        const range = (input.range as string) || "Sheet1";
        const values = input.values as unknown[];
        if (!spreadsheetId || !values) {
          return {
            success: false,
            error: "Missing required fields: spreadsheet_id, values",
            provider: "sheets",
          };
        }

        const encodedRange = encodeURIComponent(range);
        const res = await fetch(
          `${SHEETS_BASE_URL}/${spreadsheetId}/values/${encodedRange}:append?valueInputOption=USER_ENTERED`,
          {
            method: "POST",
            headers: hdrs,
            body: JSON.stringify({ values: [values] }),
          }
        );

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Sheets append-row failed: ${res.status} ${errText}`),
            provider: "sheets",
          };
        }

        const data = await res.json();
        return { success: true, data, provider: "sheets", units_consumed: 1 };
      }

      if (operation === "get-spreadsheet") {
        const spreadsheetId = input.spreadsheet_id as string;
        if (!spreadsheetId) {
          return {
            success: false,
            error: "Missing required field: spreadsheet_id",
            provider: "sheets",
          };
        }

        const res = await fetch(`${SHEETS_BASE_URL}/${spreadsheetId}`, {
          method: "GET",
          headers: hdrs,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Sheets get-spreadsheet failed: ${res.status} ${errText}`),
            provider: "sheets",
          };
        }

        const data = await res.json();
        return { success: true, data, provider: "sheets", units_consumed: 1 };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "sheets",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "sheets" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    // Sheets is BYOK-only, so health check just verifies connectivity
    const apiKey = getApiKey();
    if (!apiKey) {
      return { healthy: false, latency_ms: Date.now() - start };
    }

    try {
      // Try to access the API — will fail with auth error but proves the endpoint is up
      const res = await fetch(
        `${SHEETS_BASE_URL}/nonexistent?fields=spreadsheetId`,
        {
          method: "GET",
          headers: headers(apiKey),
        }
      );
      // 404 = API is up but spreadsheet not found (expected)
      // 401/403 = token issue but API is up
      return {
        healthy: res.status === 404 || res.status === 401 || res.status === 403 || res.ok,
        latency_ms: Date.now() - start,
      };
    } catch {
      return { healthy: false, latency_ms: Date.now() - start };
    }
  },

  estimateCost(): number {
    return 0.001;
  },
};
