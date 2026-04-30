import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.161 — drift guard: credit_transactions.amount
// SELECT-projection allow-list.
//
// `credit_transactions.amount` is the per-row signed delta on the
// prepaid-credits ledger (positive = credit, negative = debit, zero
// = informational like payment_failed). Lane 4.126 already locks
// the ledger as INSERT-only at the app layer (no direct UPDATE/DELETE).
// The complement is the READ side: every SELECT projection that pulls
// `amount` is a place each user-visible per-transaction dollar value
// crosses the SQL→TS boundary.
//
// Today's read surface is exactly 1 file:
//
//   - src/app/dashboard/billing/page.tsx — billing history page
//     (.select("id, amount, type, description, balance_after,
//     stripe_payment_id, metadata, created_at"), line ~282).
//     Owner-scoped via .eq("user_id", session.user.id).
//
// Every other `.from('credit_transactions')` callsite in src/ is
// either an idempotency probe (`.select("id")`) or an INSERT and
// does NOT project `amount`.
//
// Why guard this surface even with one reader today:
//
//   - Per-transaction `amount` is the ledger's primary numeric column.
//     A new reader is by default a new place transaction history can
//     be cross-tenant leaked (admin overview, support tools, internal
//     dashboards) or stale-cached (causing billing-display drift
//     between billing/page.tsx and any sibling view).
//   - Adding cross-tenant aggregation (ARPU dashboards, internal
//     analytics) belongs behind admin auth + an explicit allow-list
//     entry, not silently in a feature PR.
//   - Lane 4.126 covers ledger IMMUTABILITY (no UPDATE/DELETE); this
//     covers ledger VISIBILITY. Together they bracket the ledger
//     surface.
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('credit_transactions').select('… amount …')` outside
//      the allow-list.
//   2. `.returns<{ amount: … }>()` generic outside the allow-list
//      (no callsite uses this today, but lock it down anyway because
//      TS-narrowing makes the leak invisible to readers).
//   3. Raw SQL `SELECT … amount … FROM credit_transactions` anywhere
//      in src/.
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards:
//   - Lane 4.126 (credit_transactions ledger immutability — INSERT-only)
//   - Lane 4.149 (credit_transactions.stripe_payment_id projection)
//   - Lane 4.150 (credit_transactions.metadata projection)

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

// Files allowed to SELECT `amount` from `credit_transactions`.
// Exactly one read path: owner-scoped billing history.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/app/dashboard/billing/page.tsx",
]);

describe("Lane 4.161 — credit_transactions.amount SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT amount from credit_transactions", () => {
    const re =
      /\.from\(\s*["']credit_transactions["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\bamount\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare amount in a credit_transactions .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']credit_transactions["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\bamount\b/;
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

  it("no raw SQL SELECT amount FROM credit_transactions in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\bamount\b[\s\S]*?\bFROM\s+credit_transactions\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
