import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.156 — drift guard: gateway_usage_log.cost_to_us
// SELECT-projection allow-list (COGS column).
//
// `gateway_usage_log.cost_to_us` is the wholesale provider cost
// stamped on every gateway request — what ToolRoute pays the
// upstream provider, BEFORE the markup that becomes
// `cost_to_user`. The delta between these two columns IS the
// gateway's margin. Leaking `cost_to_us` to a user-facing
// surface lets every customer reverse-engineer the markup on
// every adapter — devastating to pricing power and a direct
// competitive disclosure. (Past leak-class audits: Lane 4.10
// gateway COGS leak audit, Lane 4.49 / 4.141 .select("*") on
// sensitive tables.)
//
// Today's read surface is exactly ONE file:
//
//   - src/app/api/admin/stats/route.ts — admin dashboard stats.
//     Three SELECTs project `cost_to_us`: total-revenue/cost
//     summary, per-tool stats breakdown, key-source margin
//     breakdown. Gated by validateAdmin() (Lane 4.134) so only
//     admin-secret holders see it.
//
// Note: `gateway_usage_log` is also written via the
// `log_gateway_request` RPC (gateway.ts passes `p_cost_to_us`
// as an RPC parameter). RPC writes are NOT SELECT-projections
// and therefore not in scope for this guard.
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('gateway_usage_log').select('… cost_to_us …')`
//      outside `src/app/api/admin/stats/route.ts`.
//   2. `.returns<{ cost_to_us: … }>()` generic outside the
//      allow-list.
//   3. Raw SQL `SELECT … cost_to_us … FROM gateway_usage_log`
//      anywhere in src/.
//
// Word-boundary regex (`\bcost_to_us\b`) is critical — naive
// `cost_to_us` would also match `cost_to_user` substring.
//
// Source-file regex parser only — registry imports often pull
// in createClient() at module load and crash without prod env
// (memory rule #59).
//
// Sibling guards:
//   - Lane 4.140 (gateway_usage_log SELECT owner-filter)
//   - Lane 4.142 (gateway_usage_log direct-mutation allow-list)
//   - Lane 4.143 / 4.144 / 4.145 / 4.147–4.151 (column-projection family)
//   - Lane 4.10 (gateway COGS leak-class audit, historical)
//   - Lane 4.49 / 4.141 (.select("*") on sensitive tables)

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

// Files allowed to SELECT `cost_to_us` from `gateway_usage_log`.
// Exactly one read path: the admin stats dashboard.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/app/api/admin/stats/route.ts",
]);

describe("Lane 4.156 — gateway_usage_log.cost_to_us SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT cost_to_us from gateway_usage_log", () => {
    // \bcost_to_us\b prevents the cost_to_user substring from matching.
    const re =
      /\.from\(\s*["']gateway_usage_log["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\bcost_to_us\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare cost_to_us in a gateway_usage_log .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']gateway_usage_log["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\bcost_to_us\b/;
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

  it("no raw SQL SELECT cost_to_us FROM gateway_usage_log in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\bcost_to_us\b[\s\S]*?\bFROM\s+gateway_usage_log\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
