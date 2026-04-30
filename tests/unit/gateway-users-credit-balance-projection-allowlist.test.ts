import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.160 — drift guard: gateway_users.credit_balance
// SELECT-projection allow-list.
//
// `gateway_users.credit_balance` is the prepaid-credits balance
// (in micro-USD) that gates every paid request. Lane 4.121 already
// locks the WRITE side (only the canonical add_credits / deduct_credits
// RPCs may mutate it). The complement is the READ side: every SELECT
// projection that pulls `credit_balance` is a place financial state
// crosses the SQL→TS boundary, where it can be:
//
//   - mis-rendered (display drift between dashboard / settings / API),
//   - cached stale (a TOCTOU between a balance read and a debit), or
//   - cross-tenant leaked (a spread / JSON.stringify of the row to a
//     different user's response).
//
// Today's read surface is exactly 4 files, each with a real reason:
//
//   - src/lib/gateway.ts — auto-top-up trigger reads the balance
//     to decide whether to fire a Stripe charge
//     (.select("credit_balance, auto_topup_enabled, …"), line ~510).
//   - src/app/api/webhooks/stripe/route.ts — checkout.session.completed
//     reads the existing balance before computing the post-credit
//     value (.select("id, email, credit_balance"), line ~34).
//   - src/app/dashboard/page.tsx — dashboard renders the user's
//     balance (.select("credit_balance, plan_slug"), line ~175).
//   - src/app/api/v1/settings/route.ts — GET /api/v1/settings + the
//     PATCH return-shape both project credit_balance for the
//     dashboard to re-render (lines ~16 and ~191).
//
// Any new SELECT projection of `credit_balance` from `gateway_users`
// outside this 4-file set is a new place financial state crosses
// the boundary — the diff reviewer must justify the new reader (and
// add it here, with a real reason).
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('gateway_users').select('… credit_balance …')` outside
//      the allow-list.
//   2. `.returns<{ credit_balance: … }>()` generic outside the
//      allow-list (no callsite uses this today, but lock it down
//      anyway because TS-narrowing makes the leak invisible to readers).
//   3. Raw SQL `SELECT … credit_balance … FROM gateway_users` anywhere
//      in src/.
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards:
//   - Lane 4.121 (gateway_users.credit_balance write-paths)
//   - Lane 4.131 (add_credits / deduct_credits RPC layer)
//   - Lane 4.147 (gateway_users.email projection)
//   - Lane 4.148 (gateway_users.stripe_customer_id projection)
//   - Lane 4.151 (gateway_users.metadata projection)
//   - Lane 4.159 (gateway_users.plan_slug projection)

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

// Files allowed to SELECT `credit_balance` from `gateway_users`.
// Each entry has a real reason — see lane comment above.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/lib/gateway.ts",
  "src/app/api/webhooks/stripe/route.ts",
  "src/app/dashboard/page.tsx",
  "src/app/api/v1/settings/route.ts",
]);

describe("Lane 4.160 — gateway_users.credit_balance SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT credit_balance from gateway_users", () => {
    const re =
      /\.from\(\s*["']gateway_users["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\bcredit_balance\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare credit_balance in a gateway_users .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']gateway_users["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\bcredit_balance\b/;
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

  it("no raw SQL SELECT credit_balance FROM gateway_users in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\bcredit_balance\b[\s\S]*?\bFROM\s+gateway_users\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
