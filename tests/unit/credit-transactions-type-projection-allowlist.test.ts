import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.171 — drift guard: credit_transactions.type SELECT-projection
// allow-list.
//
// `credit_transactions.type` is the kind of each ledger row —
// `purchase`, `usage`, `refund`, `signup_bonus`, `payment_failed`,
// auto-top-up variants, etc. Lane 4.126 already locks the WRITE side
// (ledger immutability — UPDATE/DELETE forbidden, only INSERT
// through canonical paths). This guard is the projection complement.
//
// Today's read surface for `type` is exactly 1 file:
//
//   - src/app/dashboard/billing/page.tsx —
//       Owner-scoped ledger render
//       (.select("id, amount, type, description, balance_after,
//         stripe_payment_id, metadata, created_at"), line ~282)
//       .eq("user_id", session.user.id)
//
// Two `credit_transactions` callsites filter on `type` via
// `.eq("type", ...)` but DO NOT project it:
//
//   - src/lib/gateway.ts line ~204:
//       .from("credit_transactions")
//       .select("id")
//       .eq("user_id", userId)
//       .eq("type", "purchase")
//     — gates first-deposit signup-bonus path; projects only id.
//
//   - src/app/api/webhooks/stripe/route.ts line ~41:
//       .from("credit_transactions")
//       .select("id")
//       .eq("stripe_payment_id", stripePaymentId)
//       .eq("type", "payment_failed")
//     — Stripe webhook idempotency probe; projects only id.
//
// The regex below requires `\btype\b` to appear INSIDE the
// `.select(...)` string literal, so `.eq("type", ...)` filters
// won't trip the guard.
//
// Why guard a column whose schema is plainly visible:
//
//   - Cross-tenant aggregation of `type` (e.g., "what ratio of
//     ledger rows are refunds across all tenants?") fingerprints
//     business mix. A new SELECT reader that drops the
//     `.eq("user_id", auth.uid())` filter would expose
//     refund-rate-per-tenant, signup-bonus density, auto-top-up
//     adoption rate — all per-account financial behaviors.
//   - Lane 4.126 covers the WRITE path (ledger immutability);
//     this lane covers the READ path of one of the columns.
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('credit_transactions').select('… type …')` outside
//      the allow-list.
//   2. `.returns<{ type: … }>()` generic outside the allow-list (no
//      callsite uses this today, but lock it down anyway because
//      TS-narrowing makes the leak invisible to readers).
//   3. Raw SQL `SELECT … type … FROM credit_transactions` anywhere
//      in src/.
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards:
//   - Lane 4.126 (credit_transactions ledger immutability)
//   - Lane 4.149 (credit_transactions.stripe_payment_id projection)
//   - Lane 4.150 (credit_transactions.metadata projection)
//   - Lane 4.161 (credit_transactions.amount projection)
//   - Lane 4.162 (credit_transactions.balance_after projection)

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

// Files allowed to SELECT `type` from `credit_transactions`.
// Exactly one read path: owner-scoped billing ledger render.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/app/dashboard/billing/page.tsx",
]);

describe("Lane 4.171 — credit_transactions.type SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT type from credit_transactions", () => {
    const re =
      /\.from\(\s*["']credit_transactions["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\btype\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare type in a credit_transactions .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']credit_transactions["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\btype\b/;
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

  it("no raw SQL SELECT type FROM credit_transactions in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\btype\b[\s\S]*?\bFROM\s+credit_transactions\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
