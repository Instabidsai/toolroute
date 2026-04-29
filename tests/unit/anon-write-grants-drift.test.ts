import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Lane 4.96 drift guard — anon WRITE grants REVOKE on financial tables.
 *
 * Sibling to Lane 4.15 (RPC EXECUTE grants), Lane 4.93 (credit RPC input
 * validation). Static parser over the migration script — no DB access needed.
 *
 * Failure modes this guards against:
 *   1. Future refactor strips a REVOKE → silent re-opens anon write surface.
 *   2. Future refactor adds a new financial table to FINANCIAL_TABLES set
 *      but forgets to add the REVOKE → caught here, not at runtime.
 *   3. Drop a table and forget to remove from this list → hard fail with
 *      a clear error.
 *
 * The migration script must:
 *   - REVOKE INSERT, UPDATE, DELETE, TRUNCATE on every FINANCIAL_TABLE from anon
 *   - Be inside a BEGIN/COMMIT block (atomic apply)
 *   - Be idempotent (REVOKE on already-revoked is no-op in PG)
 */

const SQL_PATH = resolve(
  __dirname,
  "../../scripts/lane-4.96-anon-write-grants-revoke.sql",
);

// Tables holding financial / gateway-internal state — anon must never write
// to these even if RLS policies weaken. Service-role bypasses GRANTs so all
// legitimate writes (every site uses supabaseAdmin()) still work.
const FINANCIAL_TABLES = [
  "api_keys",
  "credit_transactions",
  "gateway_usage_log",
  "gateway_users",
  "usage_events",
  "user_provider_keys",
];

// Mandatory write privileges that must be REVOKE'd. TRIGGER + REFERENCES
// are also REVOKE'd by the migration but those are lower-impact — keep
// them out of the test's required set so a future TRIGGER-grant change
// doesn't false-fail this guard.
const REQUIRED_WRITE_PRIVS = ["INSERT", "UPDATE", "DELETE", "TRUNCATE"];

function loadSql(): string {
  return readFileSync(SQL_PATH, "utf8");
}

describe("Lane 4.96 — anon WRITE grants REVOKE on financial tables", () => {
  for (const table of FINANCIAL_TABLES) {
    describe(`public.${table}`, () => {
      it(`REVOKEs all write privileges from anon`, () => {
        const sql = loadSql();
        // Match: REVOKE <privs>... ON public.<table> FROM anon
        // Privs may appear in any order, comma-separated, possibly with
        // additional privs (REFERENCES, TRIGGER) interleaved.
        const re = new RegExp(
          `REVOKE\\s+([A-Z,\\s]+?)\\s+ON\\s+public\\.${table}\\s+FROM\\s+anon`,
          "i",
        );
        const m = sql.match(re);
        expect(m, `${table}: no REVOKE ... FROM anon clause found`).not.toBeNull();

        const grantedList = (m![1] ?? "")
          .split(/[,\s]+/)
          .map((p) => p.trim().toUpperCase())
          .filter(Boolean);

        for (const priv of REQUIRED_WRITE_PRIVS) {
          expect(
            grantedList,
            `${table}: REVOKE clause missing ${priv} (got: ${grantedList.join(",")})`,
          ).toContain(priv);
        }
      });
    });
  }

  it("migration is wrapped in a transaction (atomic apply + rollback safety)", () => {
    const sql = loadSql();
    // Use indices, not just presence — guards against COMMIT-before-BEGIN drift
    const beginIdx = sql.search(/^\s*BEGIN\s*;/im);
    const commitIdx = sql.search(/^\s*COMMIT\s*;/im);
    expect(beginIdx, "missing BEGIN;").toBeGreaterThanOrEqual(0);
    expect(commitIdx, "missing COMMIT;").toBeGreaterThanOrEqual(0);
    expect(
      beginIdx,
      "BEGIN must precede COMMIT",
    ).toBeLessThan(commitIdx);
  });

  it("every REVOKE in the migration targets a FINANCIAL_TABLES entry (no scope creep)", () => {
    const sql = loadSql();
    const REVOKE_REGEX = /REVOKE\s+[A-Z,\s]+?\s+ON\s+public\.([a-z_]+)\s+FROM\s+anon/gi;
    const targets = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = REVOKE_REGEX.exec(sql)) !== null) targets.add(m[1]);

    const unexpected = [...targets].filter((t) => !FINANCIAL_TABLES.includes(t));
    expect(
      unexpected,
      `migration REVOKEs from tables not in FINANCIAL_TABLES — re-classify or update test`,
    ).toEqual([]);
  });
});
