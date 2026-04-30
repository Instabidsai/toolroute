import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.212 — drift guard: gateway_usage_log.created_at
// SELECT-projection allow-list.
//
// `gateway_usage_log.created_at` is the request-timestamp axis on
// the per-call usage ledger. Pairing `created_at` with `tool_slug`
// (4.179) + `provider_used` (4.178) + `cost_to_user` (4.177) +
// `latency_ms` (4.181) reconstructs the user's full request
// timeline at second-level granularity — high-fidelity behavioral
// + economic profiling signal.
//
// On its own, `created_at` is a row timestamp. In combination with
// the gateway_usage_log column family already locked (4.156-4.158,
// 4.177-4.182, 4.199, 4.207) it adds the *time axis* required for
// any per-tenant request reconstruction.
//
// Today's read surface is exactly 1 file:
//
//   - src/app/api/v1/usage/route.ts — owner-scoped per-call usage
//       feed (line ~45): projects
//       `id, tool_slug, provider_used, response_status,
//       latency_ms, cost_to_user, error_message, created_at`
//       filtered by `eq("user_id", userId)` and ordered by
//       `created_at desc`. Used by /dashboard/usage page.
//
// FOUR readers project `gateway_usage_log` but use `created_at`
// only as `.gte()` filter chained AFTER `.select()` — filter-vs-
// projection disambiguation:
//
//   - src/app/api/admin/stats/route.ts:57 — projects
//       `cost_to_user, cost_to_us, id`, filters by created_at
//   - src/app/api/admin/stats/route.ts:78 — projects
//       `tool_slug, cost_to_user, cost_to_us, response_status`,
//       filters by created_at
//   - src/app/api/admin/stats/route.ts:103 — projects
//       `key_source, cost_to_user, cost_to_us`, filters by
//       created_at
//   - src/app/api/admin/stats/route.ts:126 — projects
//       `user_id, cost_to_user`, filters by created_at
//   - src/app/dashboard/page.tsx (×2) — projects `id` (count-only
//       head:true), filters by created_at
//   - src/lib/gateway.ts (×2 lines 545/550) — projects
//       `cost_to_user`, filters by created_at
//
// All 8 above project something else; created_at is filter only,
// NOT in scope.
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('gateway_usage_log').select('… created_at …')`
//      outside the allow-list.
//   2. `.returns<{ created_at: … }>()` generic outside the
//      allow-list.
//   3. Raw SQL `SELECT … created_at … FROM gateway_usage_log`
//      anywhere in src/.
//
// REGEX PRECISION:
//
// `created_at` is long-enough (10 chars) — standard
// `[\s\S]{0,500}?` window suffices. Adjacent tables that also
// project `created_at` are caught by their own table-specific
// guards (Lane 4.210 credit_transactions, 4.211 api_keys).
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards on gateway_usage_log:
//   - 4.140 (SELECT owner-filter)
//   - 4.142 (mutation allow-list)
//   - 4.156 (cost_to_us projection)
//   - 4.157 (key_source projection)
//   - 4.158 (used_byok empty projection)
//   - 4.177 (cost_to_user projection)
//   - 4.178 (provider_used projection)
//   - 4.179 (tool_slug projection)
//   - 4.180 (error_message projection)
//   - 4.181 (latency_ms projection)
//   - 4.182 (response_status projection)
//   - 4.199 (user_id projection)
//   - 4.203 (api_key_id empty projection)
//   - 4.207 (id projection)

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

// Files allowed to SELECT `created_at` from `gateway_usage_log`.
// Each entry has a real reason — see lane comment above.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/app/api/v1/usage/route.ts",
]);

describe("Lane 4.212 — gateway_usage_log.created_at SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT created_at from gateway_usage_log", () => {
    const re =
      /\.from\(\s*["']gateway_usage_log["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\bcreated_at\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare created_at in a gateway_usage_log .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']gateway_usage_log["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\bcreated_at\b/;
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

  it("no raw SQL SELECT created_at FROM gateway_usage_log in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\bcreated_at\b[\s\S]*?\bFROM\s+gateway_usage_log\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
