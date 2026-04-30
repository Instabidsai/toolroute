import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.205 — drift guard: credit_transactions.id SELECT-projection
// allow-list.
//
// `credit_transactions.id` is the PK on the credit-ledger table.
// Lane 4.201 already locked `credit_transactions.user_id` projection
// to an EMPTY allow-list (zero readers — user_id is exclusively a
// WHERE-predicate filter, never projected). This complement guards
// the PK column.
//
// Risk class is mostly indirect: `id` alone is opaque to a caller
// that doesn't already have the row, but `id` paired with `user_id`
// (4.201), `amount`, `stripe_payment_id`, or `metadata` enables
// audit-log reconstruction across tenants. Today the readers each
// project `id` for distinct, narrowly-scoped reasons.
//
// Today's read surface is exactly 3 files:
//
//   - src/app/api/webhooks/stripe/route.ts — five idempotency-dedupe
//       checks before inserting a credit transaction (line ~41,
//       ~131, ~210, ~253, ~289). Each is `.select("id").eq(
//       "stripe_payment_id", …).single() / .maybeSingle()` purely
//       as existence check; the surfaced id is used only to short-
//       circuit duplicate-webhook handling.
//   - src/app/dashboard/billing/page.tsx (line ~281) — owner-scoped
//       transaction history list. Projects `id, amount, type,
//       description, balance_after, stripe_payment_id, metadata,
//       created_at` filtered by `eq("user_id", session.user.id)`
//       so it's same-tenant by construction.
//   - src/lib/gateway.ts (line ~204) — recent-purchase rate-limit
//       check (5-minute window). `.select("id").eq("user_id", …)
//       .eq("type", "purchase").gte("created_at", …).limit(1)` —
//       existence check, id not surfaced.
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('credit_transactions').select('… id …')` outside the
//      allow-list.
//   2. `.returns<{ id: … }>()` generic outside the allow-list.
//   3. Raw SQL `SELECT … id … FROM credit_transactions` anywhere
//      in src/.
//
// REGEX PRECISION (reusable pattern for short-identifier cols, first
// proven in Lane 4.204):
//
// Because `id` is a 2-char common identifier, the standard
// `[\s\S]{0,500}?` window over-matches when a `.from(
// "credit_transactions")` is followed within 500 chars by a
// `.from(other_table).select("id")`. The negative-lookahead
// `(?:(?!\.from\()[\s\S]){0,500}?` bars intervening `.from(` calls.
// (Lane 4.204 caught this on dashboard/page.tsx where
// gateway_users + gateway_usage_log appear within ~10 lines.)
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards on credit_transactions:
//   - 4.201 (user_id projection — empty allow-list)
// Sibling PK projection guard:
//   - 4.204 (gateway_users.id, where this regex pattern was first
//     proven)

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

// Files allowed to SELECT `id` from `credit_transactions`.
// Each entry has a real reason — see lane comment above.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/app/api/webhooks/stripe/route.ts",
  "src/app/dashboard/billing/page.tsx",
  "src/lib/gateway.ts",
]);

describe("Lane 4.205 — credit_transactions.id SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT id from credit_transactions", () => {
    const re =
      /\.from\(\s*["']credit_transactions["']\s*\)(?:(?!\.from\()[\s\S]){0,500}?\.select\(\s*["'`][^"'`]*\bid\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare id in a credit_transactions .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']credit_transactions["']\s*\)(?:(?!\.from\()[\s\S]){0,500}?\.returns<[\s\S]*?\bid\b/;
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

  it("no raw SQL SELECT id FROM credit_transactions in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\bid\b[\s\S]*?\bFROM\s+credit_transactions\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
