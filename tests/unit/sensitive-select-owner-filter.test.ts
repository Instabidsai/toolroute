import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.133 — drift guard: SELECT chains on sensitive tables must be
// owner-filtered.
//
// Sibling guards:
//   - Lane 4.121–4.130: column-write allow-lists (every sensitive WRITE
//     goes through a known callsite)
//   - Lane 4.131: RPC callsite allow-list (add_credits / deduct_credits /
//     etc. callsites)
//   - Lane 4.132: supabaseAdmin() callsite allow-list (lib-layer service-
//     role surface)
//   - Lane 4.33 + 4.116: route-auth-coverage (every route classifies its
//     auth class)
//   - Lane 4.30: one-shot manual IDOR audit on session-authed mutation
//     routes
//
// What this lane closes:
//
// Lane 4.33 verifies the CALLER is auth'd, not that the row being read
// BELONGS to the caller. A session-authed route can still leak any
// other user's data if a `.from("gateway_users").select(...)` forgets
// `.eq("id", userId)`. Lane 4.30 was a one-shot manual audit; this
// lane ships CI enforcement so future drift can't reintroduce the
// bypass.
//
// Drift class:
//   - Add a new endpoint that reads gateway_users without filtering by
//     user_id. Result: caller sees ALL users' rows = financial PII +
//     stripe_customer_id leak.
//   - Modify an existing SELECT to drop the .eq filter. Result: same.
//
// Defense:
//   - Per-table file allow-list. New file calling .from("<sensitive>")
//     .select(...) trips the guard, forcing reviewer audit.
//   - Per-callsite filter check: at least one of `.eq("id"|"user_id"|
//     "stripe_customer_id"|"stripe_payment_id", ...)` must appear within
//     the chain body (600 chars after `.from`). stripe_customer_id and
//     stripe_payment_id only valid in the signature-verified Stripe
//     webhook.
//
// Source-file regex parser per memory rule #59 — never import registry
// modules in tests; they pull in createClient() and crash without prod
// env.

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

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

const SENSITIVE_TABLES = [
  "gateway_users",
  "api_keys",
  "credit_transactions",
  "user_provider_keys",
] as const;

const STRIPE_WEBHOOK_FILE = "src/app/api/webhooks/stripe/route.ts";

// Files allowed to call `.from("<table>").select(...)` for each table.
// Adding a new file requires reviewer audit of its filter mechanism.
const SELECT_ALLOWLIST: Record<(typeof SENSITIVE_TABLES)[number], Set<string>> = {
  gateway_users: new Set([
    "src/lib/gateway.ts",
    "src/app/auth/callback/route.ts",
    "src/app/api/webhooks/stripe/route.ts",
    "src/app/api/v1/keys/route.ts",
    "src/app/api/v1/settings/route.ts",
    "src/app/api/v1/billing/setup-payment/route.ts",
    "src/app/dashboard/page.tsx",
  ]),
  api_keys: new Set([
    "src/lib/gateway.ts",
    "src/app/api/v1/keys/route.ts",
  ]),
  credit_transactions: new Set([
    "src/lib/gateway.ts",
    "src/app/api/webhooks/stripe/route.ts",
    "src/app/dashboard/billing/page.tsx",
  ]),
  user_provider_keys: new Set([
    "src/lib/gateway.ts",
    "src/app/api/v1/byok/route.ts",
  ]),
};

// Filters that prove a SELECT is owner-bound. id/user_id are universal;
// stripe_customer_id/stripe_payment_id are only valid in the signature-
// verified Stripe webhook (anywhere else they'd be IDOR-able).
function validFiltersForFile(rel: string): RegExp[] {
  const base: RegExp[] = [
    /\.eq\(\s*["']id["']/,
    /\.eq\(\s*["']user_id["']/,
  ];
  if (rel === STRIPE_WEBHOOK_FILE) {
    base.push(/\.eq\(\s*["']stripe_customer_id["']/);
    base.push(/\.eq\(\s*["']stripe_payment_id["']/);
  }
  return base;
}

describe("Lane 4.133 — sensitive-table SELECT owner-filter drift guard", () => {
  const files = walk(SRC_ROOT);

  for (const table of SENSITIVE_TABLES) {
    it(`every .from("${table}").select(...) callsite is allow-listed AND owner-filtered`, () => {
      const violators: { file: string; reason: string; offset?: number }[] = [];
      // Match `.from("<table>")\s*.select(` — i.e., .select is the
      // first chained method (read path). UPDATE/INSERT/DELETE chains
      // are intentionally excluded; those are covered by Lanes 4.121–
      // 4.130 column-write guards.
      const re = new RegExp(
        `\\.from\\(\\s*["']${table}["']\\s*\\)\\s*\\.select\\(`,
        "g"
      );

      for (const file of files) {
        const rel = file.replace(SRC_ROOT, "src").replace(/\\/g, "/");
        const src = stripComments(readFileSync(file, "utf-8"));
        const matches: number[] = [];
        let m: RegExpExecArray | null;
        while ((m = re.exec(src)) !== null) {
          matches.push(m.index);
        }
        if (matches.length === 0) continue;

        if (!SELECT_ALLOWLIST[table].has(rel)) {
          violators.push({ file: rel, reason: "file not in SELECT allow-list" });
          continue;
        }

        // For each callsite, look ahead 600 chars for a valid filter.
        // 600 chars covers any reasonable chain length including
        // multi-line columns + multiple .eq + .order + .limit.
        const validFilters = validFiltersForFile(rel);
        for (const idx of matches) {
          const window = src.slice(idx, idx + 600);
          const hasFilter = validFilters.some((rx) => rx.test(window));
          if (!hasFilter) {
            violators.push({
              file: rel,
              reason: "no valid owner filter (.eq(id|user_id|...)) within chain",
              offset: idx,
            });
          }
        }
      }

      expect(violators).toEqual([]);
    });
  }

  it("Stripe-only filters (stripe_customer_id / stripe_payment_id) appear ONLY in the signature-verified webhook route", () => {
    // Defense-in-depth: even if a future allow-listed file added a
    // stripe_customer_id filter as the only owner check, we want that
    // pattern locked to the one route where Stripe's signature has been
    // verified (Lane 4.20 + Lane 4.29). Anywhere else, that filter
    // value comes from request input → IDOR.
    const violators: string[] = [];
    const reStripeFilter = /\.eq\(\s*["']stripe_(customer|payment)_id["']/g;
    for (const file of files) {
      const rel = file.replace(SRC_ROOT, "src").replace(/\\/g, "/");
      if (rel === STRIPE_WEBHOOK_FILE) continue;
      // gateway.ts internally manages stripe_customer_id on
      // gateway_users for auto-top-up — but that's an .update with CAS
      // guard (Lane 4.124-followup), not a SELECT filter. Spot-check:
      // gateway.ts SELECTs filter by id/user_id only, not
      // stripe_customer_id.
      const src = stripComments(readFileSync(file, "utf-8"));
      reStripeFilter.lastIndex = 0;
      if (reStripeFilter.test(src)) {
        violators.push(rel);
      }
    }
    expect(violators).toEqual([]);
  });
});
