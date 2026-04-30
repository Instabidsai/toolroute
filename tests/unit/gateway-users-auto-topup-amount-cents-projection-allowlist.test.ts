import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.165 — drift guard: gateway_users.auto_topup_amount_cents
// SELECT-projection allow-list. Closes the auto_topup_* triplet
// alongside Lane 4.163 (enabled) + Lane 4.164 (threshold).
//
// `gateway_users.auto_topup_amount_cents` is the dollar amount (in
// cents) that gets charged to the user's saved Stripe payment method
// when `auto_topup_enabled` is true and the credit balance crosses
// `auto_topup_threshold` downward. Lane 4.125 already locks the WRITE
// side of all three auto_topup_* columns. The complement is the READ
// side: every SELECT projection that pulls `auto_topup_amount_cents`
// is a place the auto-charge dollar value crosses the SQL→TS boundary.
//
// Today's read surface is exactly 2 files, each with a real reason:
//
//   - src/lib/gateway.ts — auto-top-up trigger reads the amount
//     (along with enabled flag + threshold + customer id) to know
//     how much to charge after a debit crosses the threshold
//     (.select("credit_balance, auto_topup_enabled,
//     auto_topup_threshold, auto_topup_amount_cents,
//     stripe_customer_id"), line ~510).
//   - src/app/api/v1/settings/route.ts — GET /api/v1/settings + the
//     PATCH return-shape both project auto_topup_amount_cents so the
//     dashboard settings page can render the input field (lines ~16
//     and ~191).
//
// Any new SELECT projection of `auto_topup_amount_cents` from
// `gateway_users` outside this 2-file set is a new place the
// auto-charge dollar value crosses the boundary — the diff reviewer
// must justify the new reader (and add it here, with a real reason).
//
// Why guard this column even when it's not a credential:
//
//   - Combined with `auto_topup_enabled` (Lane 4.163) +
//     `auto_topup_threshold` (Lane 4.164) + `stripe_customer_id`
//     (Lane 4.148), this column fully discloses the auto-charge
//     economics for each account: who auto-charges, when, and for
//     how much.
//   - A stale-cached read could mis-fire the auto-charge with the
//     wrong amount: under-charge (negative balance, denied requests
//     after one debit cycle) or over-charge (customer surprise →
//     chargeback risk).
//   - Lane 4.125 covers WRITE drift; Lanes 4.163 + 4.164 + 4.165 lock
//     the entire READ surface of the auto_topup_* triplet. After this
//     PR ships, every column of the auto-charge feature is bracketed
//     (write + read) by drift guards.
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('gateway_users').select('… auto_topup_amount_cents …')`
//      outside the allow-list.
//   2. `.returns<{ auto_topup_amount_cents: … }>()` generic outside
//      the allow-list (no callsite uses this today, but lock it down
//      anyway because TS-narrowing makes the leak invisible to readers).
//   3. Raw SQL `SELECT … auto_topup_amount_cents … FROM gateway_users`
//      anywhere in src/.
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards:
//   - Lane 4.125 (auto_topup_* write-paths)
//   - Lane 4.163 (auto_topup_enabled projection)
//   - Lane 4.164 (auto_topup_threshold projection)
//   - Lane 4.148 (stripe_customer_id projection)
//   - Lane 4.160 (credit_balance projection)

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

// Files allowed to SELECT `auto_topup_amount_cents` from `gateway_users`.
// Each entry has a real reason — see lane comment above.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/lib/gateway.ts",
  "src/app/api/v1/settings/route.ts",
]);

describe("Lane 4.165 — gateway_users.auto_topup_amount_cents SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT auto_topup_amount_cents from gateway_users", () => {
    const re =
      /\.from\(\s*["']gateway_users["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\bauto_topup_amount_cents\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare auto_topup_amount_cents in a gateway_users .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']gateway_users["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\bauto_topup_amount_cents\b/;
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

  it("no raw SQL SELECT auto_topup_amount_cents FROM gateway_users in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\bauto_topup_amount_cents\b[\s\S]*?\bFROM\s+gateway_users\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
