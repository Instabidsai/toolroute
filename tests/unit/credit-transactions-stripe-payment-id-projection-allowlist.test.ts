import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.149 — drift guard: credit_transactions.stripe_payment_id
// SELECT-projection allow-list.
//
// `credit_transactions.stripe_payment_id` is billing PII — every row
// stamps the Stripe payment intent / invoice / subscription id behind
// a credit movement. Lane 4.126 already locks the ledger as
// append-only (no UPDATE / DELETE on existing rows). This is the
// complementary READ-side: every SELECT projection that pulls
// `stripe_payment_id` is a place a Stripe id crosses the SQL→TS
// boundary and is exposed to whatever the helper returns.
//
// Today's read-projection surface is exactly ONE file:
//
//   - src/app/dashboard/billing/page.tsx — the user's billing-history
//     panel pulls `id, amount, type, description, balance_after,
//     stripe_payment_id, metadata, created_at` so the dashboard can
//     render and link out to Stripe. Owner-scoped via .eq("user_id",
//     session.user.id).
//
// Every other reference to `stripe_payment_id` in the source today is a
// FILTER, not a PROJECTION:
//   - src/app/api/webhooks/stripe/route.ts uses `.eq("stripe_payment_id",
//     stripePaymentId)` for idempotency dedup (multiple sites).
//   - src/lib/gateway.ts auto-top-up dedup uses `.select("id")` only.
//   - src/app/api/v1/billing/setup-payment/route.ts is a write path.
//
// Filters are intentionally NOT in the allow-list — they don't cross
// the column value back to the application layer.
//
// Any new SELECT projection of `stripe_payment_id` from
// `credit_transactions` outside this 1-file set is a new place billing
// PII crosses the boundary. The diff reviewer must justify and add
// here.
//
// Three classes of violation handled:
//
//   1. `.from('credit_transactions').select('… stripe_payment_id …')`
//      outside the allow-list.
//   2. `.returns<{ stripe_payment_id: … }>()` generic outside the
//      allow-list (no callsite uses this today).
//   3. Raw SQL `SELECT … stripe_payment_id … FROM credit_transactions`
//      anywhere in src/.
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards:
//   - Lane 4.126 (credit_transactions ledger immutability)
//   - Lane 4.124 (gateway_users.stripe_customer_id writes)
//   - Lane 4.148 (gateway_users.stripe_customer_id projection)
//   - Lane 4.143 (api_keys.key_hash projection)
//   - Lane 4.144 (tool_providers.auth_key_encrypted projection + write)
//   - Lane 4.145 (user_provider_keys.api_key_encrypted projection)
//   - Lane 4.147 (gateway_users.email projection)

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

// Files allowed to SELECT `stripe_payment_id` from `credit_transactions`.
// Single read site: the user-facing billing-history dashboard panel.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/app/dashboard/billing/page.tsx",
]);

describe("Lane 4.149 — credit_transactions.stripe_payment_id SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT stripe_payment_id from credit_transactions", () => {
    const re =
      /\.from\(\s*["']credit_transactions["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\bstripe_payment_id\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare stripe_payment_id in a credit_transactions .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']credit_transactions["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\bstripe_payment_id\b/;
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

  it("no raw SQL SELECT stripe_payment_id FROM credit_transactions in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\bstripe_payment_id\b[\s\S]*?\bFROM\s+credit_transactions\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
