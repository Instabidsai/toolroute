import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.214 — drift guard: gateway_users.created_at
// SELECT-projection EMPTY allow-list.
//
// `gateway_users.created_at` is the signup-cohort timestamp on the
// per-tenant user table. Pairing `created_at` with `email` (4.147)
// + `plan_slug` (4.159) + `credit_balance` (4.160) reconstructs a
// signup-funnel cohort report — when each tenant signed up, what
// tier they're on, what they've spent. High-leverage marketing /
// growth analytics signal that should never cross the SQL→TS
// boundary except through admin tooling.
//
// EMPTY ALLOW-LIST is the strongest form of drift guard:
//
//   No file in src/ today projects `created_at` from
//   `gateway_users`. The table has 10 SELECT callsites
//   (setup-payment, keys, settings ×2, stripe webhook ×2,
//   auth/callback, dashboard, gateway.ts ×2) — every one
//   projects a specific column subset, none include
//   `created_at`. Locking it to zero readers means any new
//   signup-cohort projection has to land in a PR that adds
//   to this allow-list — visible diff, easy to review.
//
// All gateway_users readers and what they project:
//
//   - src/app/api/v1/billing/setup-payment/route.ts:26 —
//       `email, stripe_customer_id`
//   - src/app/api/v1/keys/route.ts:32 — `plan_slug`
//   - src/app/api/v1/settings/route.ts:15 — `display_name,
//       email, plan_slug, credit_balance, auto_topup_enabled,
//       auto_topup_threshold, auto_topup_amount_cents,
//       stripe_customer_id`
//   - src/app/api/v1/settings/route.ts:161 — `stripe_customer_id`
//   - src/app/api/webhooks/stripe/route.ts:34 — `id, email,
//       credit_balance`
//   - src/app/api/webhooks/stripe/route.ts:245 — `id, plan_slug`
//   - src/app/auth/callback/route.ts:65 — `metadata, email`
//   - src/app/dashboard/page.tsx:175 — `credit_balance, plan_slug`
//   - src/lib/gateway.ts:510 — `credit_balance,
//       auto_topup_enabled, auto_topup_threshold,
//       auto_topup_amount_cents, stripe_customer_id`
//   - src/lib/gateway.ts:629 — `id`
//
// None project `created_at`. EMPTY allow-list locks that fact in.
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('gateway_users').select('… created_at …')` ANYWHERE.
//   2. `.returns<{ created_at: … }>()` generic on gateway_users
//      ANYWHERE.
//   3. Raw SQL `SELECT … created_at … FROM gateway_users`
//      anywhere in src/.
//
// REGEX PRECISION:
//
// `created_at` is long-enough (10 chars) — standard
// `[\s\S]{0,500}?` window suffices. Adjacent tables' `created_at`
// projections are caught by their own table-specific guards
// (Lanes 4.210/4.211/4.212/4.213). Empty-allow-list pattern same
// as Lanes 4.158, 4.173, 4.183, 4.201, 4.202, 4.203.
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards on gateway_users:
//   - 4.121 (credit_balance write-paths)
//   - 4.122 (plan_slug write-paths)
//   - 4.124 (stripe_customer_id write-paths)
//   - 4.125 (auto_topup_* write-paths)
//   - 4.128 (email write-paths)
//   - 4.130 (metadata write-paths)
//   - 4.147 (email projection)
//   - 4.148 (stripe_customer_id projection)
//   - 4.151 (metadata projection)
//   - 4.159 (plan_slug projection)
//   - 4.160 (credit_balance projection)
//   - 4.163 (auto_topup_enabled projection)
//   - 4.164 (auto_topup_threshold projection)
//   - 4.165 (auto_topup_amount_cents projection)
//   - 4.176 (display_name projection)
//   - 4.204 (id projection)

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

// EMPTY allow-list — zero readers today.
const PROJECTION_ALLOWLIST = new Set<string>([]);

describe("Lane 4.214 — gateway_users.created_at EMPTY SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("no file SELECTs created_at from gateway_users", () => {
    const re =
      /\.from\(\s*["']gateway_users["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\bcreated_at\b[^"'`]*["'`]/;
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

  it("no file declares created_at in a gateway_users .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']gateway_users["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\bcreated_at\b/;
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

  it("no raw SQL SELECT created_at FROM gateway_users in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\bcreated_at\b[\s\S]*?\bFROM\s+gateway_users\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
