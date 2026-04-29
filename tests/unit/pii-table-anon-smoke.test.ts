// Lane 4.45 + Lane 4.114 — anon-read smoke test for sensitive tables.
//
// Fires a bare anon-JWT GET against every financial / key-storage / PII
// table and asserts the table is LOCKED. A table is LOCKED when EITHER:
//   (a) HTTP 401 + PostgREST code 42501 ("permission denied")
//        — the post-Lane-4.96 hard-revoke posture (anon has no SELECT grant)
//   (b) HTTP 200 with an empty JSON array
//        — the pre-revoke "RLS filters all rows" AMBIGUOUS posture
//        (still safe today, but flips to LEAK the moment a row is inserted —
//         see Hard Rule #56)
//
// Both postures are accepted because the codebase has migrated some tables
// to (a) (REVOKE) and left others on (b) (RLS-only). What's NOT accepted:
//   - HTTP 200 with a non-empty array → LEAK. Test fails loudly.
//   - HTTP 5xx or anything else → ambient infra issue. Test fails so we
//     don't false-positive into "everything's fine."
//
// Table coverage: financial + key-storage tables (gateway_users, api_keys,
// credit_transactions, user_provider_keys, tool_providers, usage_events,
// gateway_usage_log). All MUST stay LOCKED — leaking any of them is
// rule-#1 / Hard-Rule-#56 territory.
//
// Cross-refs:
//   .agent/lane-4.114-anon-read-lockdown-verification.md
//   .agent/lane-4.45-pii-anon-smoke.md (if exists)
//   src/lib/byok-required-slugs.ts (sibling — class-A enforcement)

import { describe, expect, it } from "vitest";

const SUPABASE_URL = "https://isbratmfnnzipzyoefbo.supabase.co";
const ANON_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzYnJhdG1mbm56aXB6eW9lZmJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MzY0MTYsImV4cCI6MjA5MDIxMjQxNn0.GI565bgr2HCQfeRYMVrTUyB2gUlncdb6mx-DEoL9_Fs";

// Tables that MUST be locked from anon. Adding to this list is the
// canonical place to extend coverage when new sensitive tables ship.
const LOCKED_TABLES = [
  // PII / auth
  "gateway_users",
  "api_keys",
  // billing / financial
  "credit_transactions",
  "usage_events",
  "gateway_usage_log",
  // provider keys (plaintext columns today; encryption tracked under Codex #52)
  "user_provider_keys",
  "tool_providers",
] as const;

const SKIP =
  process.env.PII_ANON_SMOKE_SKIP === "1" ||
  process.env.ANON_LOCKDOWN_BASELINE === "skip";

interface ProbeResult {
  status: number;
  body: string;
}

async function anonGet(table: string): Promise<ProbeResult> {
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

function assertLocked(table: string, { status, body }: ProbeResult): void {
  // Posture (a): hard REVOKE — 401 + permission denied
  if (status === 401) {
    expect(
      body,
      `${table} returned 401 but body did not contain a permission-denied marker — investigate.\nBody: ${body.slice(0, 300)}`
    ).toMatch(/permission denied|42501/i);
    return;
  }

  // Posture (b): RLS filters all rows — 200 + empty array
  if (status === 200) {
    let rows: unknown;
    try {
      rows = JSON.parse(body);
    } catch {
      throw new Error(
        `${table} returned 200 but body was not valid JSON: ${body.slice(0, 300)}`
      );
    }
    expect(
      rows,
      `LEAK: ${table} returned non-empty rows to bare anon JWT.\n` +
        `Body: ${body.slice(0, 500)}\n` +
        `Fix: REVOKE anon SELECT on ${table} (sibling to Lane 4.96/4.97 pattern), ` +
        `OR add owner-scoped RLS policy if anon SELECT must stay.`
    ).toEqual([]);
    return;
  }

  throw new Error(
    `${table} returned unexpected status ${status} — neither 401 (revoked) nor 200 (RLS-empty).\n` +
      `Body: ${body.slice(0, 500)}\n` +
      `If the table was renamed/dropped, update LOCKED_TABLES in this file.`
  );
}

describe("anon-read lockdown smoke (Lane 4.45 + 4.114)", () => {
  if (SKIP) {
    it.skip("skipped (PII_ANON_SMOKE_SKIP=1 or ANON_LOCKDOWN_BASELINE=skip)", () => {});
    return;
  }

  for (const table of LOCKED_TABLES) {
    it(`${table} is LOCKED to bare anon JWT`, async () => {
      const result = await anonGet(table);
      assertLocked(table, result);
    });
  }
});
