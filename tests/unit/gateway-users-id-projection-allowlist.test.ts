import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.204 — drift guard: gateway_users.id SELECT-projection
// allow-list.
//
// `gateway_users.id` is the PK matching auth.users.id (1:1). It
// is the canonical tenant identifier across the entire app. The
// risk class for projecting `id` is mostly indirect — combined
// with email (4.147), stripe_customer_id (4.148), or plan_slug
// (4.159), it provides cross-tenant identity linkage. As a
// standalone column it's already known to the caller (the WHERE
// clause filters by it), but `id` paired with non-id columns
// in the projection is what actually enables joins.
//
// Today's read surface is exactly 2 files:
//
//   - src/lib/gateway.ts (line ~629) — auto-provision lazy
//       fallback in getUserFromSession. SELECTs `id` purely as
//       an existence check (.maybeSingle() to detect first-time
//       session before signup row write). Does not surface id
//       outside the function.
//   - src/app/api/webhooks/stripe/route.ts (line ~34, ~245) —
//       lookup gateway_users row by stripe_customer_id (line 34
//       projects `id, email, credit_balance`; line 245 projects
//       `id, plan_slug` for the checkout.session.completed
//       branch). Server-only, webhook-signed handler.
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('gateway_users').select('… id …')` outside the
//      allow-list.
//   2. `.returns<{ id: … }>()` generic outside the allow-list.
//   3. Raw SQL `SELECT … id … FROM gateway_users` anywhere in src/.
//
// IMPORTANT — regex precision: the pattern matches `id` as a
// whole word inside a quoted .select() argument. `\bid\b`
// matches "id" only when bounded by word breaks, so it will
// match `select("id")` / `select("id, …")` / `select("…, id")`
// but NOT `select("user_id")` or `select("api_key_id")`.
//
// SECOND precision tweak: because `id` is a very common short
// identifier, the gap between `.from("gateway_users")` and the
// matched `.select(...)` must NOT cross another `.from(`. The
// negative-lookahead `(?:(?!\.from\()[\s\S])*?` prevents this —
// otherwise the regex would over-match e.g.
//   .from("gateway_users").select("plan_slug")...
//   .from("gateway_usage_log").select("id", {head:true})
// and report dashboard/page.tsx as a violator (gateway_usage_log
// SELECTs aren't this lane's concern).
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
//   - 4.163-4.165 (auto_topup_* projection)
//   - 4.176 (display_name projection)
//   - 4.204 (id) ← THIS LANE

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

// Files allowed to SELECT `id` from `gateway_users`.
// Each entry has a real reason — see lane comment above.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/lib/gateway.ts",
  "src/app/api/webhooks/stripe/route.ts",
]);

describe("Lane 4.204 — gateway_users.id SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT id from gateway_users", () => {
    const re =
      /\.from\(\s*["']gateway_users["']\s*\)(?:(?!\.from\()[\s\S]){0,500}?\.select\(\s*["'`][^"'`]*\bid\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare id in a gateway_users .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']gateway_users["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\bid\b/;
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

  it("no raw SQL SELECT id FROM gateway_users in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\bid\b[\s\S]*?\bFROM\s+gateway_users\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
