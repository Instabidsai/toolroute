import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Lane 4.98 drift guard — REVOKE writes on RLS-enabled-zero-policy
 * registry/internal tables.
 *
 * Sibling to Lane 4.96 (anon WRITE, financial) and Lane 4.97 (authenticated
 * WRITE + backdoor policies, financial). Same threat class, different table
 * set: these 8 tables had RLS=on but ZERO policies — default-deny via RLS
 * was the only writeguard while anon+authenticated GRANTs were wide open.
 *
 * Failure modes this guards against:
 *   1. Future refactor strips a REVOKE → silent re-opens registry/internal
 *      writes from anon or authenticated.
 *   2. Future refactor adds a new RLS-zero-policy table to the set but
 *      forgets to add the REVOKE → caught here, not at runtime.
 *   3. REVOKE clause targets a table NOT in ZERO_POLICY_TABLES → scope
 *      creep guard catches it.
 *
 * Static parser over the migration script — no DB access required.
 */

const SQL_PATH = resolve(
  __dirname,
  "../../scripts/lane-4.98-zero-policy-tables-write-revoke.sql",
);

// 8 RLS-enabled-zero-policy tables locked by this lane.
const ZERO_POLICY_TABLES = [
  "conversations",
  "discovery_feed",
  "inventory",
  "rate_limit_windows",
  "tool_memory",
  "tool_overrides",
  "tool_providers",
  "tool_requests",
];

const REQUIRED_WRITE_PRIVS = ["INSERT", "UPDATE", "DELETE", "TRUNCATE"];
const REQUIRED_GRANTEES = ["anon", "authenticated"];

function loadSql(): string {
  return readFileSync(SQL_PATH, "utf8");
}

describe("Lane 4.98 — REVOKE writes on RLS-zero-policy registry/internal tables", () => {
  for (const table of ZERO_POLICY_TABLES) {
    describe(`public.${table}`, () => {
      it(`REVOKEs all write privileges from anon and authenticated`, () => {
        const sql = loadSql();
        // Match: REVOKE <privs>... ON public.<table> FROM <grantee_list>
        // grantees may be in any order, comma-separated.
        const re = new RegExp(
          `REVOKE\\s+([A-Z,\\s]+?)\\s+ON\\s+public\\.${table}\\s+FROM\\s+([a-z_,\\s]+?)\\s*;`,
          "i",
        );
        const m = sql.match(re);
        expect(
          m,
          `${table}: no REVOKE ... FROM ... clause found`,
        ).not.toBeNull();

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

        const grantees = (m![2] ?? "")
          .split(/[,\s]+/)
          .map((p) => p.trim().toLowerCase())
          .filter(Boolean);

        for (const grantee of REQUIRED_GRANTEES) {
          expect(
            grantees,
            `${table}: REVOKE FROM clause missing ${grantee} (got: ${grantees.join(",")})`,
          ).toContain(grantee);
        }
      });
    });
  }

  it("migration is wrapped in a transaction (atomic apply)", () => {
    const sql = loadSql();
    const beginIdx = sql.search(/^\s*BEGIN\s*;/im);
    const commitIdx = sql.search(/^\s*COMMIT\s*;/im);
    expect(beginIdx, "missing BEGIN;").toBeGreaterThanOrEqual(0);
    expect(commitIdx, "missing COMMIT;").toBeGreaterThanOrEqual(0);
    expect(beginIdx, "BEGIN must precede COMMIT").toBeLessThan(commitIdx);
  });

  it("every REVOKE targets a ZERO_POLICY_TABLES entry (no scope creep)", () => {
    const sql = loadSql();
    const REVOKE_REGEX =
      /REVOKE\s+[A-Z,\s]+?\s+ON\s+public\.([a-z_]+)\s+FROM\s+[a-z_,\s]+?\s*;/gi;
    const targets = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = REVOKE_REGEX.exec(sql)) !== null) targets.add(m[1]);

    const unexpected = [...targets].filter(
      (t) => !ZERO_POLICY_TABLES.includes(t),
    );
    expect(
      unexpected,
      `migration REVOKEs from tables not in ZERO_POLICY_TABLES — re-classify or update test`,
    ).toEqual([]);
  });
});
