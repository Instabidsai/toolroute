import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Lane 4.97 drift guard — authenticated WRITE grants REVOKE + dead-policy DROP
 * on financial tables.
 *
 * Sibling to Lane 4.96 (anon WRITE REVOKE) and Lane 4.15 (RPC EXECUTE grants).
 * Static parser over the migration script — no DB access needed.
 *
 * Failure modes this guards against:
 *   1. Future refactor strips a REVOKE → silent re-opens authenticated write
 *      surface (P0 self-mint via PATCH /rest/v1/gateway_users).
 *   2. Future refactor recreates a dropped policy → backdoor self-modification
 *      returns (USING auth.uid() = id grants ownership-write to anyone with
 *      a JWT, regardless of GRANT layer).
 *   3. Future refactor adds a new financial table to FINANCIAL_TABLES set
 *      but forgets to add the REVOKE → caught here, not at runtime.
 *
 * The migration script must:
 *   - REVOKE INSERT, UPDATE, DELETE, TRUNCATE on every FINANCIAL_TABLE from
 *     authenticated.
 *   - DROP each policy in BACKDOOR_POLICIES via DROP POLICY IF EXISTS.
 *   - Be inside a BEGIN/COMMIT block (atomic apply).
 *   - Be idempotent (REVOKE + DROP IF EXISTS are no-ops on re-run).
 */

const SQL_PATH = resolve(
  __dirname,
  "../../scripts/lane-4.97-authenticated-write-revoke.sql",
);

// Tables holding financial / gateway-internal state — authenticated must
// never write to these directly. Service-role bypasses GRANTs so all
// legitimate writes (every site uses supabaseAdmin()) still work.
const FINANCIAL_TABLES = [
  "api_keys",
  "credit_transactions",
  "gateway_usage_log",
  "gateway_users",
  "usage_events",
  "user_provider_keys",
];

const REQUIRED_WRITE_PRIVS = ["INSERT", "UPDATE", "DELETE", "TRUNCATE"];

// PUBLIC-role policies that backdoored authenticated self-modification.
// Each must be DROP POLICY IF EXISTS'd by the migration. List is closed —
// adding a new entry without a corresponding DROP fails the test.
const BACKDOOR_POLICIES: Array<{ table: string; policy: string }> = [
  { table: "gateway_users", policy: "users_insert" },
  { table: "gateway_users", policy: "users_own_update" },
  { table: "api_keys", policy: "keys_own_insert" },
  { table: "api_keys", policy: "keys_own_update" },
  { table: "user_provider_keys", policy: "byok_own_insert" },
  { table: "user_provider_keys", policy: "byok_own_update" },
  { table: "user_provider_keys", policy: "byok_own_delete" },
];

function loadSql(): string {
  return readFileSync(SQL_PATH, "utf8");
}

describe("Lane 4.97 — authenticated WRITE REVOKE + dead-policy DROP", () => {
  describe("REVOKE clauses", () => {
    for (const table of FINANCIAL_TABLES) {
      it(`REVOKEs all write privileges from authenticated on ${table}`, () => {
        const sql = loadSql();
        const re = new RegExp(
          `REVOKE\\s+([A-Z,\\s]+?)\\s+ON\\s+public\\.${table}\\s+FROM\\s+authenticated`,
          "i",
        );
        const m = sql.match(re);
        expect(
          m,
          `${table}: no REVOKE ... FROM authenticated clause found`,
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
      });
    }
  });

  describe("DROP POLICY clauses (backdoor self-modification removal)", () => {
    for (const { table, policy } of BACKDOOR_POLICIES) {
      it(`DROPs policy ${policy} on ${table}`, () => {
        const sql = loadSql();
        const re = new RegExp(
          `DROP\\s+POLICY\\s+IF\\s+EXISTS\\s+${policy}\\s+ON\\s+public\\.${table}\\s*;`,
          "i",
        );
        expect(
          sql,
          `${table}.${policy}: no DROP POLICY IF EXISTS clause found (must be idempotent)`,
        ).toMatch(re);
      });
    }
  });

  it("migration is wrapped in a transaction (atomic apply)", () => {
    const sql = loadSql();
    const beginIdx = sql.search(/^\s*BEGIN\s*;/im);
    const commitIdx = sql.search(/^\s*COMMIT\s*;/im);
    expect(beginIdx, "missing BEGIN;").toBeGreaterThanOrEqual(0);
    expect(commitIdx, "missing COMMIT;").toBeGreaterThanOrEqual(0);
    expect(beginIdx, "BEGIN must precede COMMIT").toBeLessThan(commitIdx);
  });

  it("every authenticated REVOKE targets a FINANCIAL_TABLES entry (no scope creep)", () => {
    const sql = loadSql();
    const REVOKE_REGEX =
      /REVOKE\s+[A-Z,\s]+?\s+ON\s+public\.([a-z_]+)\s+FROM\s+authenticated/gi;
    const targets = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = REVOKE_REGEX.exec(sql)) !== null) targets.add(m[1]);

    const unexpected = [...targets].filter((t) => !FINANCIAL_TABLES.includes(t));
    expect(
      unexpected,
      `migration REVOKEs from tables not in FINANCIAL_TABLES — re-classify or update test`,
    ).toEqual([]);
  });

  it("every DROP POLICY targets a BACKDOOR_POLICIES entry (no scope creep)", () => {
    const sql = loadSql();
    const DROP_REGEX =
      /DROP\s+POLICY\s+IF\s+EXISTS\s+([a-z_]+)\s+ON\s+public\.([a-z_]+)\s*;/gi;
    const found: Array<{ table: string; policy: string }> = [];
    let m: RegExpExecArray | null;
    while ((m = DROP_REGEX.exec(sql)) !== null) {
      found.push({ policy: m[1], table: m[2] });
    }

    const allowed = new Set(
      BACKDOOR_POLICIES.map((p) => `${p.table}.${p.policy}`),
    );
    const unexpected = found
      .map((p) => `${p.table}.${p.policy}`)
      .filter((s) => !allowed.has(s));

    expect(
      unexpected,
      `migration DROPs policies not in BACKDOOR_POLICIES — re-classify or update test`,
    ).toEqual([]);
  });
});
