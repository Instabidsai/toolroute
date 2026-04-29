import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Lane 4.93 drift guard — credit RPC input validation.
 *
 * Mirrors Lane 4.15 (RPC EXECUTE grants) — static parse over the migration
 * script that defines add_credits / deduct_credits.
 *
 * Failure modes this guards against:
 *   1. Future refactor strips the IF p_amount validation block (mint attack
 *      vector returns: deduct_credits(p_amount = -10) mints credits because
 *      v_balance < -10 is false and v_balance - (-10) = balance + 10).
 *   2. Future refactor allows NaN / NULL through (poisons numeric balance
 *      forever — NaN + x = NaN).
 *   3. Future refactor reorders so the IF check runs AFTER the UPDATE (state
 *      already mutated before guard fires).
 *
 * The validation block must:
 *   - Live inside the CREATE OR REPLACE FUNCTION body for both RPCs
 *   - Reject NULL, NaN, and <= 0
 *   - Be the FIRST executable statement after BEGIN (before any UPDATE/SELECT)
 */

const SQL_PATH = resolve(__dirname, "../../scripts/lane-4.93-credit-rpc-input-validation.sql");

function loadSql(): string {
  return readFileSync(SQL_PATH, "utf8");
}

function extractFunctionBody(src: string, name: string): string {
  const re = new RegExp(
    `CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+public\\.${name}\\s*\\([\\s\\S]*?\\)\\s*RETURNS[\\s\\S]*?\\$\\$([\\s\\S]*?)\\$\\$`,
    "i",
  );
  const m = src.match(re);
  if (!m) throw new Error(`Could not extract body for public.${name}`);
  return m[1];
}

const VALIDATION_PATTERN =
  /IF\s+p_amount\s+IS\s+NULL\s+OR\s+p_amount\s*=\s*'NaN'::numeric\s+OR\s+p_amount\s*<=\s*0\s+THEN[\s\S]*?RAISE\s+EXCEPTION[\s\S]*?USING\s+ERRCODE\s*=\s*'22023'/i;

describe("Lane 4.93 — credit RPC amount validation", () => {
  for (const fn of ["add_credits", "deduct_credits"]) {
    describe(`public.${fn}`, () => {
      it("rejects NULL / NaN / <= 0 with SQLSTATE 22023", () => {
        const body = extractFunctionBody(loadSql(), fn);
        expect(body, `${fn} body missing input validation block`).toMatch(VALIDATION_PATTERN);
      });

      it("validation runs BEFORE any UPDATE/INSERT/SELECT FOR UPDATE", () => {
        const body = extractFunctionBody(loadSql(), fn);
        const validationIdx = body.search(/IF\s+p_amount\s+IS\s+NULL/i);
        expect(validationIdx, `${fn}: validation IF not found`).toBeGreaterThanOrEqual(0);

        const stateMutators = [
          /UPDATE\s+gateway_users/i,
          /UPDATE\s+api_keys/i,
          /INSERT\s+INTO\s+credit_transactions/i,
          /SELECT[\s\S]*?FOR\s+UPDATE/i,
        ];
        for (const re of stateMutators) {
          const m = body.match(re);
          if (m && m.index !== undefined) {
            expect(
              validationIdx,
              `${fn}: validation IF (idx ${validationIdx}) must precede ${re} (idx ${m.index})`,
            ).toBeLessThan(m.index);
          }
        }
      });

      it("preserves Lane 4.92 lockdown — REVOKE PUBLIC + GRANT service_role only", () => {
        const sql = loadSql();
        const sigByName: Record<string, string> = {
          add_credits: "uuid, numeric, text, text, text",
          deduct_credits: "uuid, numeric, text, uuid, text",
        };
        const sig = sigByName[fn];
        const revoke = new RegExp(
          `REVOKE\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${fn}\\s*\\(\\s*${sig}\\s*\\)\\s*FROM\\s+PUBLIC,\\s*anon,\\s*authenticated`,
          "i",
        );
        const grant = new RegExp(
          `GRANT\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${fn}\\s*\\(\\s*${sig}\\s*\\)\\s*TO\\s+service_role`,
          "i",
        );
        expect(sql).toMatch(revoke);
        expect(sql).toMatch(grant);
      });
    });
  }
});
