import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.146 — drift guard: admin_stats_* RPC callsites file-allow-listed.
//
// Four RPCs power the admin platform-wide stats dashboard (revenue,
// COGS, margin, by-tool/key-source, top users):
//
//   - admin_stats_totals       — sum revenue / cogs / requests
//   - admin_stats_by_tool      — same, grouped by tool_slug
//   - admin_stats_by_key_source — same, grouped by master/byok/none
//   - admin_stats_top_users    — per-user_id spend rollup, p_limit-bounded
//
// admin_stats_top_users is the highest-risk of the four: it returns
// `(user_id, total_revenue, total_cogs, request_count)` rows. Any
// non-admin caller leaks user_id + revenue per user in one query —
// platform-wide PII + financial leak.
//
// Today every callsite is in exactly one file, gated by validateAdmin():
//
//   src/app/api/admin/stats/route.ts
//     - GET handler runs all 4 RPCs in Promise.all behind validateAdmin()
//
// Drift this lane closes:
//
//   1. A new "leaderboard" or "top spenders" page that calls
//      admin_stats_top_users without validateAdmin() — direct PII +
//      revenue leak.
//
//   2. A debug or feature-flagged route that copies the admin/stats
//      RPC pattern to power "user analytics" without re-checking the
//      admin gate.
//
//   3. A future helper module that wraps admin_stats_* with caching —
//      callers of the wrapper would route around the validateAdmin
//      check the original handler enforces.
//
// Sibling guard: Lane 4.131 (gateway RPC callsite allow-list — covers
// add_credits, deduct_credits, validate_api_key, log_gateway_request,
// check_rate_limit). Same allow-list-by-RPC pattern. Lane 4.134
// (admin/* validateAdmin coverage drift guard) covers the gate at the
// route level; this lane covers the RPC at its callsite level.
//
// Source-file regex parser (NOT runtime import) — registry imports often
// pull in createClient() and crash without prod env (memory rule #59).

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

// Strip /* … */ block comments and // line comments before regex matching
// so JSDoc references to admin_stats_* RPCs don't trigger false positives.
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

// All four admin_stats_* RPCs share the same allow-list: the single
// admin/stats route handler. validateAdmin() is the gate; this drift
// guard makes it impossible to accidentally call these RPCs from any
// path that doesn't pass through that handler.
const ADMIN_STATS_RPCS = [
  "admin_stats_totals",
  "admin_stats_by_tool",
  "admin_stats_by_key_source",
  "admin_stats_top_users",
] as const;

const ALLOWLIST = new Set<string>([
  "src/app/api/admin/stats/route.ts", // GET handler, gated by validateAdmin()
]);

describe("Lane 4.146 — admin_stats_* RPC callsite drift guard", () => {
  const files = walk(SRC_ROOT);

  for (const rpcName of ADMIN_STATS_RPCS) {
    it(`only allow-listed files call .rpc("${rpcName}")`, () => {
      const re = new RegExp(`\\.rpc\\(\\s*["']${rpcName}["']`);
      const violators: string[] = [];
      for (const file of files) {
        const src = stripComments(readFileSync(file, "utf-8"));
        if (re.test(src)) {
          const rel = file.replace(SRC_ROOT, "src").replace(/\\/g, "/");
          if (!ALLOWLIST.has(rel)) {
            violators.push(rel);
          }
        }
      }
      expect(violators).toEqual([]);
    });
  }

  it("no raw SQL CALL/SELECT against admin_stats_* RPCs in src/", () => {
    const re =
      /(SELECT|CALL)\s+(admin_stats_totals|admin_stats_by_tool|admin_stats_by_key_source|admin_stats_top_users)\s*\(/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) {
        violators.push(file.replace(SRC_ROOT, "src").replace(/\\/g, "/"));
      }
    }
    expect(violators).toEqual([]);
  });
});
