import { describe, expect, it } from "vitest";

const SUPABASE_URL = "https://isbratmfnnzipzyoefbo.supabase.co";
const ANON_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzYnJhdG1mbm56aXB6eW9lZmJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MzY0MTYsImV4cCI6MjA5MDIxMjQxNn0.GI565bgr2HCQfeRYMVrTUyB2gUlncdb6mx-DEoL9_Fs";

const PII_TABLES = [
  "gateway_users",
  "api_keys",
  "credit_transactions",
  "gateway_usage_log",
] as const;

const SKIP = process.env.PII_ANON_SMOKE_SKIP === "1";

async function anonGet(table: string): Promise<{ status: number; body: string }> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?select=id&limit=1`,
    {
      headers: {
        apikey: ANON_JWT,
        Authorization: `Bearer ${ANON_JWT}`,
      },
    }
  );
  return { status: res.status, body: await res.text() };
}

describe("PII table anon-read smoke (Lane 4.45)", () => {
  if (SKIP) {
    it.skip("skipped (PII_ANON_SMOKE_SKIP=1) — for offline CI runs", () => {});
    return;
  }

  for (const table of PII_TABLES) {
    it(`${table} returns no rows to bare anon JWT`, async () => {
      const { status, body } = await anonGet(table);
      expect(
        status,
        `Expected 200 from PostgREST for ${table}, got ${status}: ${body}`
      ).toBe(200);
      const rows = JSON.parse(body) as unknown[];
      expect(
        rows,
        `LEAK: ${table} returned rows to bare anon JWT — RLS policy missing or anon SELECT grant present.\n` +
          `Body: ${body.slice(0, 500)}\n` +
          "Fix: revoke anon SELECT (server-only path) OR add owner-scoped RLS policy " +
          "(USING auth.uid() = user_id). See Hard Rule #56 (anon-read empty is AMBIGUOUS not LOCKED — " +
          "this test catches transition from AMBIGUOUS to LEAK when first row lands)."
      ).toEqual([]);
    });
  }
});
