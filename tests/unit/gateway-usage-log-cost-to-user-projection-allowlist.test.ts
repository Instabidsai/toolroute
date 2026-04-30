import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.177 — drift guard: gateway_usage_log.cost_to_user
// SELECT-projection allow-list. Sibling to Lane 4.156
// (cost_to_us, internal-margin column).
//
// `gateway_usage_log.cost_to_user` is the customer-facing per-call
// cost (cents debited from credit_balance per gateway request). It
// is the dollar amount the user is billed; `cost_to_us` (Lane 4.156)
// is the upstream provider cost ToolRoute pays. Both columns are
// per-request financial signals — leaking either cross-tenant
// discloses pricing economics.
//
// Today's read surface is exactly 3 files, each with a real reason:
//
//   - src/lib/gateway.ts —
//       GET /api/v1/key cost-rollup. Two owner-scoped reads
//       (lines ~545-548, ~549-553) sum today's + month's cost
//       across the caller's own usage rows. Filtered by
//       `.eq("user_id", ctx.userId)`.
//
//   - src/app/api/v1/usage/route.ts —
//       Owner-scoped per-call usage history. Projects cost_to_user
//       alongside id, tool_slug, provider_used, response_status,
//       latency_ms, error_message, created_at (line ~44). Filtered
//       by `.eq("user_id", userId)`.
//
//   - src/app/api/admin/stats/route.ts —
//       Admin-gated platform-wide stats. Four projection sites
//       (lines ~58, ~79, ~104, ~127), all gated by validateAdmin
//       upstream. Cross-tenant projection by design — admin only.
//
// No other gateway_usage_log SELECT pulls cost_to_user today.
// `dashboard/page.tsx:185-192` projects only `id` for count queries.
//
// Why guard this column even though it's not a credential:
//
//   - `cost_to_user` is per-tenant billing data — pricing per call
//     × volume per call × tool mix discloses customer economics.
//     A new SELECT reader without `.eq("user_id", auth.uid())` or
//     admin-gate would expose another tenant's spend pattern.
//   - Same risk class as `cost_to_us` (Lane 4.156) — the difference
//     is `cost_to_user` is the customer-facing rate while
//     `cost_to_us` is the upstream provider cost. Both are per-row
//     financial signals.
//   - Combined with `tool_slug` + `provider_used` + tenancy ID,
//     `cost_to_user` reconstructs per-tenant tool-level economics.
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('gateway_usage_log').select('… cost_to_user …')`
//      outside the allow-list.
//   2. `.returns<{ cost_to_user: … }>()` generic outside the
//      allow-list.
//   3. Raw SQL `SELECT … cost_to_user … FROM gateway_usage_log`
//      anywhere in src/.
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards:
//   - Lane 4.140 (gateway_usage_log SELECT owner-filter)
//   - Lane 4.142 (gateway_usage_log direct-mutation allow-list)
//   - Lane 4.156 (gateway_usage_log.cost_to_us — admin only)
//   - Lane 4.157 (gateway_usage_log.key_source — admin only)
//   - Lane 4.158 (gateway_usage_log.used_byok — empty allow-list)

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

// Files allowed to SELECT `cost_to_user` from `gateway_usage_log`.
// Each entry has a real reason — see lane comment above.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/lib/gateway.ts",
  "src/app/api/v1/usage/route.ts",
  "src/app/api/admin/stats/route.ts",
]);

describe("Lane 4.177 — gateway_usage_log.cost_to_user SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT cost_to_user from gateway_usage_log", () => {
    const re =
      /\.from\(\s*["']gateway_usage_log["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\bcost_to_user\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare cost_to_user in a gateway_usage_log .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']gateway_usage_log["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\bcost_to_user\b/;
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

  it("no raw SQL SELECT cost_to_user FROM gateway_usage_log in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\bcost_to_user\b[\s\S]*?\bFROM\s+gateway_usage_log\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
