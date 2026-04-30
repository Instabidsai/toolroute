import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.207 — drift guard: gateway_usage_log.id SELECT-projection
// allow-list.
//
// `gateway_usage_log.id` is the PK on the per-request usage-log
// table. Lane 4.203 already locked `gateway_usage_log.api_key_id`
// projection to an EMPTY allow-list, and 4.199 locked `user_id` to
// admin-only. This complement guards the PK column.
//
// Risk class is mostly indirect: `id` alone is opaque to a caller,
// but `id` paired with `user_id` (4.199), `api_key_id` (4.203),
// `cost_to_us` (4.156), `cost_to_user` (4.177), `provider_used`
// (4.178), `tool_slug` (4.179), `error_message` (4.180), or
// `key_source` (4.157) reconstructs cross-tenant audit-log rows.
//
// Today's read surface is exactly 3 files:
//
//   - src/app/dashboard/page.tsx (lines ~185, ~191) — owner-scoped
//       daily/monthly request count tiles. Two count-only calls:
//       `.select("id", { count: "exact", head: true }).eq("user_id",
//       session.user.id).gte("created_at", …)`. The `head:true`
//       option means PostgREST returns NO rows — only the count
//       header — so `id` is technically a column-spec, never
//       surfaced. But the column-spec IS the projection by the
//       regex's definition, so the file must be allow-listed.
//   - src/app/api/admin/stats/route.ts (line ~58) — admin
//       aggregate. `.select("cost_to_user, cost_to_us, id")` for
//       the global cost rollup. Admin-only, gated by validateAdmin
//       (Lane 4.134).
//   - src/app/api/v1/usage/route.ts (line ~43) — owner-scoped
//       usage list. `.select("id, tool_slug, provider_used,
//       response_status, latency_ms, cost_to_user, error_message,
//       created_at").eq("user_id", userId)`. Same-tenant by
//       construction.
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('gateway_usage_log').select('… id …')` outside the
//      allow-list.
//   2. `.returns<{ id: … }>()` generic outside the allow-list.
//   3. Raw SQL `SELECT … id … FROM gateway_usage_log` anywhere
//      in src/.
//
// REGEX PRECISION (reusable pattern for short-identifier cols, first
// proven in Lane 4.204):
//
// Because `id` is a 2-char common identifier, the standard
// `[\s\S]{0,500}?` window over-matches when a `.from(
// "gateway_usage_log")` is followed within 500 chars by a
// `.from(other_table).select("id")`. The negative-lookahead
// `(?:(?!\.from\()[\s\S]){0,500}?` bars intervening `.from(`
// calls. Same pattern reused in 4.205 and 4.206.
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards on gateway_usage_log:
//   - 4.140 (SELECT owner-filter)
//   - 4.142 (direct-mutation allow-list)
//   - 4.156 (cost_to_us projection — admin only)
//   - 4.157 (key_source projection — admin only)
//   - 4.158 (used_byok empty allow-list)
//   - 4.177 (cost_to_user projection)
//   - 4.178 (provider_used projection)
//   - 4.179 (tool_slug projection)
//   - 4.180 (error_message projection)
//   - 4.181 (latency_ms projection)
//   - 4.182 (response_status projection)
//   - 4.199 (user_id projection)
//   - 4.203 (api_key_id empty allow-list)
//
// Sibling PK projection guards:
//   - 4.204 (gateway_users.id, where the negative-lookahead pattern
//     was first proven)
//   - 4.205 (credit_transactions.id)
//   - 4.206 (api_keys.id)

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

// Files allowed to SELECT `id` from `gateway_usage_log`.
// Each entry has a real reason — see lane comment above.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/app/dashboard/page.tsx",
  "src/app/api/admin/stats/route.ts",
  "src/app/api/v1/usage/route.ts",
]);

describe("Lane 4.207 — gateway_usage_log.id SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT id from gateway_usage_log", () => {
    const re =
      /\.from\(\s*["']gateway_usage_log["']\s*\)(?:(?!\.from\()[\s\S]){0,500}?\.select\(\s*["'`][^"'`]*\bid\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare id in a gateway_usage_log .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']gateway_usage_log["']\s*\)(?:(?!\.from\()[\s\S]){0,500}?\.returns<[\s\S]*?\bid\b/;
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

  it("no raw SQL SELECT id FROM gateway_usage_log in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\bid\b[\s\S]*?\bFROM\s+gateway_usage_log\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
