import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const MIGRATION_PATH = join(
  process.cwd(),
  "scripts",
  "lane-4.23-credit-transactions-unique-constraint.sql"
);

describe("Lane 4.23 — credit_transactions UNIQUE constraint migration spec", () => {
  it("migration script exists at the expected path", () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true);
  });

  describe("migration script body", () => {
    const sql = existsSync(MIGRATION_PATH)
      ? readFileSync(MIGRATION_PATH, "utf8")
      : "";

    it("creates an index named credit_transactions_stripe_payment_id_dedup_idx", () => {
      expect(sql).toMatch(
        /CREATE\s+UNIQUE\s+INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?credit_transactions_stripe_payment_id_dedup_idx/i
      );
    });

    it("index is UNIQUE (not a regular btree)", () => {
      expect(sql).toMatch(/CREATE\s+UNIQUE\s+INDEX/i);
    });

    it("indexes both stripe_payment_id and type columns (composite key)", () => {
      // Find the column list `(stripe_payment_id, type)` — order matters for
      // partial-index covering: stripe_payment_id is the equality filter
      // column in the dedup probe.
      const colList = sql.match(
        /ON\s+credit_transactions\s*\(\s*stripe_payment_id\s*,\s*type\s*\)/i
      );
      expect(
        colList,
        "Index must cover (stripe_payment_id, type) in that order"
      ).not.toBeNull();
    });

    it("WHERE clause restricts to ('purchase', 'plan_credit') — must NOT widen to refund/adjustment/payment_failed", () => {
      // Find the WHERE clause body (between WHERE and the closing semicolon
      // or end of CREATE INDEX statement).
      const whereMatch = sql.match(
        /CREATE\s+UNIQUE\s+INDEX[\s\S]*?WHERE\s+([\s\S]*?);/i
      );
      expect(whereMatch, "WHERE clause is required on the partial index").not.toBeNull();
      const whereBody = whereMatch![1];

      // Must include both allowed types.
      expect(whereBody).toMatch(/'purchase'/);
      expect(whereBody).toMatch(/'plan_credit'/);

      // Must NOT include any of the excluded types.
      const FORBIDDEN_TYPES = ["refund", "adjustment", "payment_failed"];
      for (const t of FORBIDDEN_TYPES) {
        expect(
          whereBody,
          `WHERE clause must NOT include type '${t}' — these may legitimately share stripe_payment_id with related success tx`
        ).not.toMatch(new RegExp(`'${t}'`));
      }
    });

    it("includes a duplicate-detection SELECT before the CREATE INDEX (so Justin doesn't blow up on existing dupes)", () => {
      // Pre-flight check should COUNT(*)>1 group on the same key the index
      // will cover. This catches existing data state that would block index
      // creation.
      expect(sql).toMatch(/SELECT[\s\S]*?stripe_payment_id[\s\S]*?COUNT\s*\(\s*\*\s*\)/i);
      expect(sql).toMatch(/HAVING\s+COUNT\s*\(\s*\*\s*\)\s*>\s*1/i);
    });
  });
});
