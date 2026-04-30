import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.216 — drift guard: gateway_users.updated_at
// EMPTY SELECT-projection allow-list.
//
// `gateway_users.updated_at` is the user-record mutation timestamp.
// Pairing it with credit_balance / plan_slug / auto_topup_*
// reconstructs each user's account-mutation history (when did they
// upgrade, when did auto-top-up fire, when did they change their
// settings). Per-tenant infrastructure-fingerprint signal.
//
// Today the read surface is EMPTY — zero callsites SELECT
// updated_at from gateway_users. All 10 SELECT callsites enumerated
// in Lane 4.214's lane comment project other columns but never
// updated_at:
//
//   - src/app/api/v1/billing/setup-payment/route.ts:26 —
//       `email, stripe_customer_id` (NO updated_at)
//   - src/app/api/v1/keys/route.ts:32 — `plan_slug`
//   - src/app/api/v1/settings/route.ts:15 —
//       `display_name, email, plan_slug, credit_balance,
//       auto_topup_enabled, auto_topup_threshold,
//       auto_topup_amount_cents, stripe_customer_id`
//   - src/app/api/v1/settings/route.ts:161 — `stripe_customer_id`
//   - src/app/api/v1/settings/route.ts:190 (PATCH return) —
//       `display_name, plan_slug, credit_balance,
//       auto_topup_enabled, auto_topup_threshold,
//       auto_topup_amount_cents, stripe_customer_id`
//   - src/app/api/webhooks/stripe/route.ts:34 —
//       `id, email, credit_balance`
//   - src/app/api/webhooks/stripe/route.ts:245 — `id, plan_slug`
//   - src/app/auth/callback/route.ts:65 — `metadata, email`
//   - src/app/dashboard/page.tsx:175 — `credit_balance, plan_slug`
//   - src/lib/gateway.ts:510 —
//       `credit_balance, auto_topup_enabled, auto_topup_threshold,
//       auto_topup_amount_cents, stripe_customer_id`
//   - src/lib/gateway.ts:629 — `id`
//
// Out-of-scope updated_at references in src/ (filter-vs-projection,
// or other-table writes/reads):
//
//   - webhooks/stripe/route.ts:161/188/200/384 — UPDATE writes
//       (`.update({ updated_at: ... })`), not projection.
//   - auth/callback/route.ts:82 — UPDATE write.
//   - api/v1/settings/route.ts:183 — UPDATE write.
//   - api/v1/billing/setup-payment/route.ts:52 — UPDATE write.
//   - api/v1/byok/route.ts:34/77/124 — user_provider_keys, not
//       gateway_users.
//   - api/admin/providers/route.ts:86/176 — tool_providers, not
//       gateway_users.
//   - api/a2a/route.ts:18/232/259/361 — local in-memory Task type,
//       not a DB column.
//   - lib/types.ts / gateway-types.ts / dashboard/providers/page.tsx
//       — TypeScript type declarations, stripped by stripComments
//       (no .from('gateway_users')).
//   - lib/adapters/github-adapter.ts — third-party API response
//       mapping.
//   - app/sitemap.ts:409 — `tool.updated_at` from `tools` table.
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('gateway_users').select('… updated_at …')` anywhere.
//   2. `.returns<{ updated_at: … }>()` generic on gateway_users.
//   3. Raw SQL `SELECT … updated_at … FROM gateway_users`.
//
// EMPTY allow-list = strongest-form drift guard — any new reader
// trips the test, forcing the diff reviewer to justify projecting
// updated_at and adding the file here.
//
// REGEX PRECISION:
//
// `updated_at` is long-enough (10 chars) — standard
// `[\s\S]{0,500}?` window suffices. Adjacent tables' `updated_at`
// projections (tool_providers, user_provider_keys) will be caught
// by their own table-specific guards.
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards (gateway_users column family complete):
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
//   - 4.214 (created_at empty projection)

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

// EMPTY allow-list: zero files may SELECT updated_at from gateway_users.
const PROJECTION_ALLOWLIST = new Set<string>([]);

describe("Lane 4.216 — gateway_users.updated_at EMPTY SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("no file SELECTs updated_at from gateway_users", () => {
    const re =
      /\.from\(\s*["']gateway_users["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\bupdated_at\b[^"'`]*["'`]/;
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

  it("no file declares updated_at in a gateway_users .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']gateway_users["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\bupdated_at\b/;
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

  it("no raw SQL SELECT updated_at FROM gateway_users in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\bupdated_at\b[\s\S]*?\bFROM\s+gateway_users\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
