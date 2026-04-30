import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.201 — drift guard: credit_transactions.user_id
// SELECT-projection EMPTY allow-list (no readers today).
//
// `credit_transactions.user_id` is the per-row tenant identifier
// on the credit ledger. It is the FK to gateway_users.id and is
// stamped at write-time by the credit RPCs (add_credits /
// deduct_credits — see Lane 4.131). Today the application reads
// `user_id` from ZERO files: it is used exclusively as a row
// predicate (`.eq("user_id", userId)`) on the WHERE side and is
// never projected into application code.
//
// This guard freezes that property. Any future SELECT-projection
// of `user_id` is a NEW cross-tenant identifier exposure on the
// most sensitive table in the app (the financial ledger).
//
// Why the empty allow-list isn't fragile:
//   - Per-row reads of `credit_transactions` are owner-scoped:
//     either filtered by `.eq("user_id", userId)` (dashboard,
//     gateway TOCTOU lookups) or by `.eq("stripe_payment_id", ...)`
//     for idempotency dedup. Neither path needs `user_id` in the
//     projection — the caller already knows the user_id.
//   - Aggregate reads of credit_transactions don't exist today;
//     admin/stats reads gateway_usage_log for revenue, not the
//     ledger directly.
//   - If a future admin panel needs cross-tenant revenue from the
//     ledger, the diff reviewer can add this file's allow-list
//     entry with explicit reason — empty-allow-list forces that
//     conversation rather than allowing silent drift.
//
// Risk class if violated:
//   - Combined with `amount` (4.161) or `balance_after` (4.162):
//     per-user revenue / balance trajectory.
//   - Combined with `stripe_payment_id` (4.149): per-user Stripe
//     payment record linkage.
//   - Combined with `metadata` (4.150): full per-user ledger row.
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('credit_transactions').select('… user_id …')`
//      anywhere in src/.
//   2. `.returns<{ user_id: … }>()` generic anywhere in src/.
//   3. Raw SQL `SELECT … user_id … FROM credit_transactions`
//      anywhere in src/.
//
// Source-file regex parser only — registry imports often pull
// in createClient() at module load and crash without prod env
// (memory rule #59).
//
// Sibling guards on credit_transactions:
//   - 4.126 (ledger immutability — INSERT-only)
//   - 4.149 (stripe_payment_id projection)
//   - 4.150 (metadata projection)
//   - 4.161 (amount projection)
//   - 4.162 (balance_after projection)
//   - 4.171 (type projection)
//   - 4.172 (description projection)
//   - 4.201 (user_id empty) ← THIS LANE

const SRC_ROOT = resolve(process.cwd(), "src");

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      walk(full, files);
    } else if (
      st.isFile() &&
      (full.endsWith(".ts") || full.endsWith(".tsx")) &&
      !full.endsWith(".test.ts") &&
      !full.endsWith(".test.tsx")
    ) {
      files.push(full);
    }
  }
  return files;
}

// Strip /* … */ block comments and // line comments before regex
// matching so JSDoc references to the column don't trigger false
// positives (memory rule from prior drift-guard work).
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function rel(file: string): string {
  return file.replace(SRC_ROOT, "src").replace(/\\/g, "/");
}

// Empty allow-list — credit_transactions.user_id has zero
// SELECT-projection readers today. Adding a reader requires
// deliberate allow-list expansion + reviewer justification.
const PROJECTION_ALLOWLIST = new Set<string>([]);

describe("Lane 4.201 — credit_transactions.user_id empty SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("no files SELECT user_id from credit_transactions (empty allow-list)", () => {
    const re =
      /\.from\(\s*["']credit_transactions["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\buser_id\b[^"'`]*["'`]/;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) {
        const r = rel(file);
        if (!PROJECTION_ALLOWLIST.has(r)) violators.push(r);
      }
    }
    expect(violators).toEqual([]);
  });

  it("no files declare user_id in a credit_transactions .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']credit_transactions["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\buser_id\b/;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) {
        const r = rel(file);
        if (!PROJECTION_ALLOWLIST.has(r)) violators.push(r);
      }
    }
    expect(violators).toEqual([]);
  });

  it("no raw SQL SELECT user_id FROM credit_transactions in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\buser_id\b[\s\S]*?\bFROM\s+credit_transactions\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
