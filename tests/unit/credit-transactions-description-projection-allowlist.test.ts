import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.172 — drift guard: credit_transactions.description
// SELECT-projection allow-list. Closes the credit_transactions
// projection set alongside Lane 4.149 (stripe_payment_id), Lane
// 4.150 (metadata), Lane 4.161 (amount), Lane 4.162 (balance_after),
// and Lane 4.171 (type).
//
// `credit_transactions.description` is the human-readable label
// stamped on each ledger row by the canonical mutation paths
// (`add_credits` / `deduct_credits` RPCs and the Stripe webhook).
// It encodes the reason for each ledger entry — "Stripe payment
// $25.00", "API usage: openai/chat", "Auto top-up triggered",
// "Signup bonus", "Refund: pi_…", and so on.
//
// Lane 4.126 already locks the WRITE side (ledger immutability —
// UPDATE/DELETE forbidden, only INSERT through canonical paths).
// This guard is the projection complement.
//
// Today's read surface for `description` is exactly 1 file:
//
//   - src/app/dashboard/billing/page.tsx —
//       Owner-scoped ledger render
//       (.select("id, amount, type, description, balance_after,
//         stripe_payment_id, metadata, created_at"), line ~282)
//       .eq("user_id", session.user.id)
//
// No `credit_transactions` callsite anywhere else in src/ projects
// `description`. The Stripe webhook + gateway callsites that touch
// the table all `.select("id")` for idempotency probes, never the
// label.
//
// Why guard this column even though it's a label, not a credential:
//
//   - `description` strings often embed product/operation context
//     that fingerprints behavior cross-tenant: "API usage:
//     openai/chat-2024-08-06" reveals which model a customer routes
//     traffic to, "Auto top-up triggered at $5 → $25" reveals the
//     rebill ladder. A new SELECT reader without `.eq("user_id",
//     auth.uid())` would expose per-account product mix.
//   - `description` strings can also embed PII through the
//     metadata-shaping path (e.g., a customer who sets a key
//     nickname that surfaces into the description text). Rule #56
//     applies — empty-table-today is AMBIGUOUS, not LOCKED. Lock
//     the projection now while the read surface is one file.
//   - Lane 4.126 covers the WRITE path (canonical add_credits /
//     deduct_credits / Stripe-webhook-only inserts); this lane
//     covers the READ path of one of the columns.
//
// After this PR ships, every column of `credit_transactions` is
// bracketed (write + read) by drift guards:
//
//   id, user_id, type, amount, balance_after, description,
//   stripe_payment_id, metadata, created_at
//
//   - WRITE: Lane 4.126 (ledger immutability)
//   - READ:  Lane 4.149 (stripe_payment_id), 4.150 (metadata),
//            4.161 (amount), 4.162 (balance_after),
//            4.171 (type), 4.172 (description ← this lane)
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('credit_transactions').select('… description …')`
//      outside the allow-list.
//   2. `.returns<{ description: … }>()` generic outside the
//      allow-list (no callsite uses this today, but lock it down
//      anyway because TS-narrowing makes the leak invisible to
//      readers).
//   3. Raw SQL `SELECT … description … FROM credit_transactions`
//      anywhere in src/.
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards:
//   - Lane 4.126 (credit_transactions ledger immutability — write)
//   - Lane 4.149 (credit_transactions.stripe_payment_id projection)
//   - Lane 4.150 (credit_transactions.metadata projection)
//   - Lane 4.161 (credit_transactions.amount projection)
//   - Lane 4.162 (credit_transactions.balance_after projection)
//   - Lane 4.171 (credit_transactions.type projection)

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

// Files allowed to SELECT `description` from `credit_transactions`.
// Exactly one read path: owner-scoped billing ledger render.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/app/dashboard/billing/page.tsx",
]);

describe("Lane 4.172 — credit_transactions.description SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT description from credit_transactions", () => {
    const re =
      /\.from\(\s*["']credit_transactions["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\bdescription\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare description in a credit_transactions .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']credit_transactions["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\bdescription\b/;
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

  it("no raw SQL SELECT description FROM credit_transactions in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\bdescription\b[\s\S]*?\bFROM\s+credit_transactions\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
