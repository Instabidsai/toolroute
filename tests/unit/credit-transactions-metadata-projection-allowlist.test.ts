import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.150 — drift guard: credit_transactions.metadata
// SELECT-projection allow-list.
//
// `credit_transactions.metadata` is JSONB. The Stripe webhook stamps
// it on every credit movement with arbitrary payload-shaped data
// (Stripe event ids, refund/dispute reasons, plan-slug context, future
// debug bags). A SELECT projection of `metadata` therefore exposes
// whatever the writer happened to put there — today benign, but the
// shape is unbounded by the column type.
//
// Lane 4.126 already locks the ledger as append-only (no UPDATE / DELETE
// on existing rows). This is the complementary READ-side: every
// SELECT projection of `metadata` is a place that JSONB blob crosses
// the SQL→TS boundary and is exposed to whatever the helper returns.
//
// Today's read-projection surface is exactly ONE file:
//
//   - src/app/dashboard/billing/page.tsx — billing-history panel pulls
//     `id, amount, type, description, balance_after, stripe_payment_id,
//     metadata, created_at` so the dashboard can render line items.
//     Owner-scoped via .eq("user_id", session.user.id).
//
// All other `credit_transactions` callsites either project only
// `select("id")` (idempotency dedup) or write to the table — never
// SELECT-project `metadata`. This 1-file guard freezes that surface.
//
// Sibling lane 4.149 covers `stripe_payment_id` projection on the same
// table with the same single-file allow-list — keeping them as
// separate lanes follows the one-column-per-lane projection-allow-list
// convention (4.143 / 4.144 / 4.145 / 4.147 / 4.148 / 4.149).
//
// Three classes of violation handled:
//
//   1. `.from('credit_transactions').select('… metadata …')` outside
//      the allow-list.
//   2. `.returns<{ metadata: … }>()` generic outside the allow-list
//      (no callsite uses this today).
//   3. Raw SQL `SELECT … metadata … FROM credit_transactions` in src/.
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards:
//   - Lane 4.126 (credit_transactions ledger immutability)
//   - Lane 4.149 (credit_transactions.stripe_payment_id projection)
//   - Lane 4.130 (gateway_users.metadata write-paths — different table)

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

// Files allowed to SELECT `metadata` from `credit_transactions`.
// Single read site: the user-facing billing-history dashboard panel.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/app/dashboard/billing/page.tsx",
]);

describe("Lane 4.150 — credit_transactions.metadata SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT metadata from credit_transactions", () => {
    const re =
      /\.from\(\s*["']credit_transactions["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\bmetadata\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare metadata in a credit_transactions .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']credit_transactions["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\bmetadata\b/;
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

  it("no raw SQL SELECT metadata FROM credit_transactions in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\bmetadata\b[\s\S]*?\bFROM\s+credit_transactions\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
