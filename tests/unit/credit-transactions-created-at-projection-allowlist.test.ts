import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.210 — drift guard: credit_transactions.created_at
// SELECT-projection allow-list.
//
// `credit_transactions.created_at` is the timestamp axis on the
// financial ledger (purchases, deductions, refunds, auto-top-ups).
// Pairing `created_at` with `amount` (4.161) + `type` (4.171) +
// `balance_after` (4.162) reconstructs the user's full money-flow
// timeline — the strongest signal for behavioral profiling
// (purchase cadence, churn-prediction, top-up frequency).
//
// On its own, `created_at` is just a row timestamp. In combination
// with the financial column family already locked (4.149/4.150/
// 4.161/4.162/4.171/4.172/4.205) it adds the *time axis* required
// for any longitudinal reconstruction. Lock it so the reader-side
// surface stays exactly where the dashboard expects it.
//
// Today's read surface is exactly 1 file:
//
//   - src/app/dashboard/billing/page.tsx — transaction history
//       list (line ~282): owner-scoped 50-row paginated read with
//       `id, amount, type, description, balance_after,
//       stripe_payment_id, metadata, created_at` filtered by
//       `eq("user_id", session.user.id)` and ordered by
//       `created_at desc`. Same-tenant by construction (session
//       JWT supplies `user_id`).
//
// `src/lib/gateway.ts:204` USES `created_at` in a `.gte()` filter
// chained AFTER `.select("id")` — filter-vs-projection
// disambiguation: the regex only matches `created_at` INSIDE the
// quoted `.select()` argument, so this callsite is NOT in scope.
// Same disambiguation as Lane 4.199 (gateway_usage_log.user_id),
// 4.206 (api_keys.id), 4.208 (user_provider_keys.id), 4.209
// (tool_providers.id).
//
// `src/app/api/webhooks/stripe/route.ts` reads/writes
// credit_transactions in 5 places (idempotency dedupes + insert),
// but never projects `created_at` — the dedupe-by-stripe-payment-id
// lookups project `id, type` only.
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('credit_transactions').select('… created_at …')`
//      outside the allow-list.
//   2. `.returns<{ created_at: … }>()` generic outside the
//      allow-list.
//   3. Raw SQL `SELECT … created_at … FROM credit_transactions`
//      anywhere in src/.
//
// REGEX PRECISION:
//
// `created_at` is a long-enough column name (10 chars, distinctive
// underscore) that the standard `[\s\S]{0,500}?` window doesn't
// over-match across intervening `.from(other_table).select(...)`
// calls — adjacent `.from("gateway_usage_log")` / `.from("api_keys")`
// reads also project `created_at` but they're caught by their own
// table-specific guards. No need for the negative-lookahead barrier
// pattern here (unlike short-id columns 4.204-4.209).
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards on credit_transactions:
//   - 4.126 (ledger immutability — write-side, append-only)
//   - 4.149 (stripe_payment_id projection)
//   - 4.150 (metadata projection)
//   - 4.161 (amount projection)
//   - 4.162 (balance_after projection)
//   - 4.171 (type projection)
//   - 4.172 (description projection)
//   - 4.201 (user_id empty projection)
//   - 4.205 (id projection)

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

// Files allowed to SELECT `created_at` from `credit_transactions`.
// Each entry has a real reason — see lane comment above.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/app/dashboard/billing/page.tsx",
]);

describe("Lane 4.210 — credit_transactions.created_at SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT created_at from credit_transactions", () => {
    const re =
      /\.from\(\s*["']credit_transactions["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\bcreated_at\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare created_at in a credit_transactions .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']credit_transactions["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\bcreated_at\b/;
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

  it("no raw SQL SELECT created_at FROM credit_transactions in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\bcreated_at\b[\s\S]*?\bFROM\s+credit_transactions\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
