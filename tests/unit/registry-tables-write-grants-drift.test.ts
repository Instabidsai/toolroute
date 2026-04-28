import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Lane 4.99 drift guard — REVOKE writes on one-policy SELECT-only registry
 * tables.
 *
 * Sibling to Lane 4.96 (anon WRITE financial), 4.97 (authenticated WRITE +
 * backdoor policies), 4.98 (zero-policy registry/internal tables). Same
 * threat class, different table set: these 8 tables have RLS=on with one
 * public-read SELECT policy each AND wide anon+authenticated WRITE grants.
 * RLS default-deny on writes was the only writeguard.
 *
 * Failure modes this guards against:
 *   1. Future refactor strips a REVOKE → silent re-opens registry-table
 *      writes from anon or authenticated.
 *   2. Future refactor adds a new one-policy SELECT-only table to the set
 *      but forgets the REVOKE → caught here.
 *   3. REVOKE clause accidentally targets SELECT → would break public
 *      catalog reads (server components feed /tools, /discover via anon
 *      client). Caught by per-table priv enumeration.
 *   4. REVOKE clause targets a table NOT in REGISTRY_TABLES → scope-creep
 *      guard catches it.
 *
 * Static parser over the migration script — no DB access required.
 */

const SQL_PATH = resolve(
  __dirname,
  "../../scripts/lane-4.99-registry-tables-write-revoke.sql",
);

// 8 one-policy SELECT-only registry tables locked by this lane.
const REGISTRY_TABLES = [
  "category_beliefs",
  "composites",
  "plans",
  "provider_health_log",
  "skills",
  "tool_categories",
  "tool_pricing",
  "tools",
];

// Writes must be revoked. SELECT must NOT be revoked (public catalog reads
// would silently break — server components feed /tools, /discover from anon
// client per `src/lib/api.ts`).
const REQUIRED_WRITE_PRIVS = ["INSERT", "UPDATE", "DELETE", "TRUNCATE"];
const FORBIDDEN_REVOKED_PRIVS = ["SELECT"];
const REQUIRED_GRANTEES = ["anon", "authenticated"];

function loadSql(): string {
  return readFileSync(SQL_PATH, "utf8");
}

describe("Lane 4.99 — REVOKE writes on one-policy SELECT-only registry tables", () => {
  for (const table of REGISTRY_TABLES) {
    describe(`public.${table}`, () => {
      it(`REVOKEs all write privileges from anon and authenticated`, () => {
        const sql = loadSql();
        const re = new RegExp(
          `REVOKE\\s+([A-Z,\\s]+?)\\s+ON\\s+public\\.${table}\\s+FROM\\s+([a-z_,\\s]+?)\\s*;`,
          "i",
        );
        const m = sql.match(re);
        expect(
          m,
          `${table}: no REVOKE ... FROM ... clause found`,
        ).not.toBeNull();

        const revokedList = (m![1] ?? "")
          .split(/[,\s]+/)
          .map((p) => p.trim().toUpperCase())
          .filter(Boolean);

        for (const priv of REQUIRED_WRITE_PRIVS) {
          expect(
            revokedList,
            `${table}: REVOKE clause missing ${priv} (got: ${revokedList.join(",")})`,
          ).toContain(priv);
        }

        for (const priv of FORBIDDEN_REVOKED_PRIVS) {
          expect(
            revokedList,
            `${table}: REVOKE clause must NOT include ${priv} — public catalog reads would break (server components use anon client)`,
          ).not.toContain(priv);
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

  it("every REVOKE targets a REGISTRY_TABLES entry (no scope creep)", () => {
    const sql = loadSql();
    const REVOKE_REGEX =
      /REVOKE\s+[A-Z,\s]+?\s+ON\s+public\.([a-z_]+)\s+FROM\s+[a-z_,\s]+?\s*;/gi;
    const targets = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = REVOKE_REGEX.exec(sql)) !== null) targets.add(m[1]);

    const unexpected = [...targets].filter(
      (t) => !REGISTRY_TABLES.includes(t),
    );
    expect(
      unexpected,
      `migration REVOKEs from tables not in REGISTRY_TABLES — re-classify or update test`,
    ).toEqual([]);
  });

  it("no REVOKE clause includes SELECT (would break public catalog reads)", () => {
    const sql = loadSql();
    const REVOKE_REGEX =
      /REVOKE\s+([A-Z,\s]+?)\s+ON\s+public\.[a-z_]+\s+FROM\s+[a-z_,\s]+?\s*;/gi;
    let m: RegExpExecArray | null;
    while ((m = REVOKE_REGEX.exec(sql)) !== null) {
      const privs = (m[1] ?? "")
        .split(/[,\s]+/)
        .map((p) => p.trim().toUpperCase())
        .filter(Boolean);
      expect(
        privs,
        `REVOKE clause includes SELECT — would silently break /tools, /discover, /tools/[slug]`,
      ).not.toContain("SELECT");
    }
  });
});
