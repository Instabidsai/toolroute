import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.148 — drift guard: gateway_users.stripe_customer_id
// SELECT-projection allow-list.
//
// `gateway_users.stripe_customer_id` is billing PII — every row maps a
// ToolRoute user to their Stripe customer record (`cus_…`). Lane 4.124
// already locks the WRITE side (only Stripe webhook + auth-callback
// initial seed + billing/setup-payment may write it; Lane 4.124-followup
// adds CAS guard). This is the complementary READ-side: every SELECT
// projection that pulls `stripe_customer_id` is a place a Stripe ID
// crosses the SQL→TS boundary and is exposed to whatever the helper
// returns.
//
// Today's read surface is exactly 3 files, each with a real reason:
//
//   - src/lib/gateway.ts — auto-top-up billing path. The gateway reads
//     `credit_balance, auto_topup_*, stripe_customer_id` to decide
//     whether to fire a Stripe charge mid-request (line ~509).
//   - src/app/api/v1/billing/setup-payment/route.ts — billing setup
//     reads `email, stripe_customer_id` to find-or-create the Stripe
//     customer (line ~25).
//   - src/app/api/v1/settings/route.ts — GET /api/v1/settings returns
//     the customer id so the dashboard can deep-link / show billing
//     state (3 sites: line ~14 GET projection, line ~160 pre-update
//     read, line ~187 post-update RETURNING projection).
//
// The Stripe webhook (src/app/api/webhooks/stripe/route.ts) DOES
// reference `stripe_customer_id`, but only via `.eq("stripe_customer_id",
// customerId)` filters and INSERT/UPDATE writes — it never SELECT-
// projects the column, so it is intentionally NOT in the allow-list.
//
// Any new SELECT projection of `stripe_customer_id` from
// `gateway_users` outside this 3-file set is a new place billing PII
// crosses the boundary — the diff reviewer must justify and add here.
//
// Three classes of violation handled:
//
//   1. `.from('gateway_users').select('… stripe_customer_id …')`
//      outside the allow-list.
//   2. `.returns<{ stripe_customer_id: … }>()` generic outside the
//      allow-list (no callsite uses this today, but lock it down anyway).
//   3. Raw SQL `SELECT … stripe_customer_id … FROM gateway_users` in
//      src/.
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards:
//   - Lane 4.124 (stripe_customer_id write-paths)
//   - Lane 4.124-followup (CAS guard on subscription write)
//   - Lane 4.147 (gateway_users.email SELECT-projection)
//   - Lane 4.143 (api_keys.key_hash projection)
//   - Lane 4.144 (tool_providers.auth_key_encrypted projection + write)
//   - Lane 4.145 (user_provider_keys.api_key_encrypted projection)

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

// Files allowed to SELECT `stripe_customer_id` from `gateway_users`.
// Each entry has a real, justified billing-read reason — see header.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/lib/gateway.ts",
  "src/app/api/v1/billing/setup-payment/route.ts",
  "src/app/api/v1/settings/route.ts",
]);

describe("Lane 4.148 — gateway_users.stripe_customer_id SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT stripe_customer_id from gateway_users", () => {
    const re =
      /\.from\(\s*["']gateway_users["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\bstripe_customer_id\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare stripe_customer_id in a gateway_users .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']gateway_users["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\bstripe_customer_id\b/;
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

  it("no raw SQL SELECT stripe_customer_id FROM gateway_users in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\bstripe_customer_id\b[\s\S]*?\bFROM\s+gateway_users\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
