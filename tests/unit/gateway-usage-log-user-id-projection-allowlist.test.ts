import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.199 — drift guard: gateway_usage_log.user_id
// SELECT-projection allow-list.
//
// `gateway_usage_log.user_id` is the per-row tenant identifier
// stamped at write-time by `log_gateway_request`. Per-row it
// identifies WHICH user incurred a given gateway call. When
// projected together with cost_to_user (4.177) or cost_to_us
// (4.156), it becomes per-user spend / per-user margin intel —
// a cross-tenant disclosure surface.
//
// Why guard user_id projection (not just RLS):
//   - Owner-filter (Lane 4.140) covers PostgREST anon path. But
//     supabaseAdmin() bypasses RLS and the only legitimate place
//     a privileged client should project user_id is in admin
//     aggregations (group-by-user revenue).
//   - Per-row: admin sees `[user_a, user_b, …]` next to
//     cost columns → per-tenant revenue ranking.
//   - Aggregate: combined with provider_used (4.178) +
//     cost_to_user (4.177) = full revenue x cost x tenant
//     fingerprint.
//
// Today's read surface is exactly 1 file:
//
//   - src/app/api/admin/stats/route.ts (line ~127) —
//       Admin-gated GET (validateAdmin upstream). Projects
//       `user_id, cost_to_user` for top-N customers panel.
//
// `src/app/api/v1/usage/route.ts:43-49` SELECTs many cols from
// gateway_usage_log but does NOT include user_id in the projection
// (it filters via `.eq("user_id", userId)` and projects:
// `id, tool_slug, provider_used, response_status, latency_ms,
// cost_to_user, error_message, created_at`). Filter ≠ projection;
// the regex correctly only matches `user_id` INSIDE the quoted
// `.select(...)` argument preceded by `.from("gateway_usage_log")`.
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('gateway_usage_log').select('… user_id …')` outside
//      the allow-list.
//   2. `.returns<{ user_id: … }>()` generic outside the allow-list.
//   3. Raw SQL `SELECT … user_id … FROM gateway_usage_log`
//      anywhere in src/.
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards on gateway_usage_log:
//   - 4.140 (owner SELECT filter)
//   - 4.142 (direct-mutation allow-list)
//   - 4.156 (cost_to_us)
//   - 4.157 (key_source)
//   - 4.158 (used_byok empty)
//   - 4.177 (cost_to_user)
//   - 4.178 (provider_used)
//   - 4.179 (tool_slug)
//   - 4.180 (error_message)
//   - 4.181 (latency_ms)
//   - 4.182 (response_status)
//   - 4.199 (user_id) ← THIS LANE

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

// Files allowed to SELECT `user_id` from `gateway_usage_log`.
// Each entry has a real reason — see lane comment above.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/app/api/admin/stats/route.ts",
]);

describe("Lane 4.199 — gateway_usage_log.user_id SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT user_id from gateway_usage_log", () => {
    const re =
      /\.from\(\s*["']gateway_usage_log["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\buser_id\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare user_id in a gateway_usage_log .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']gateway_usage_log["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\buser_id\b/;
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

  it("no raw SQL SELECT user_id FROM gateway_usage_log in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\buser_id\b[\s\S]*?\bFROM\s+gateway_usage_log\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
