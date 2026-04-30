import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.157 — drift guard: gateway_usage_log.key_source
// SELECT-projection allow-list (master-vs-BYOK routing column).
//
// `gateway_usage_log.key_source` records HOW each request was
// authenticated/authorized at the upstream provider — typically
// `master` (ToolRoute's pooled provider key) or `byok` (the
// caller supplied their own key for that adapter). Leaking this
// to a user-facing surface discloses:
//
//   - Which adapters ToolRoute routes through master pool vs
//     forces BYOK — competitive disclosure of margin strategy
//     (master = we eat COGS, byok = pass-through, no markup).
//   - Per-tenant routing decisions if joined with user_id —
//     reveals which customers are on plans that unlock master
//     pool vs which are forced to BYOK.
//   - Aggregate signal for which providers are most-used vs
//     under-utilized — info our competitors would pay for.
//
// Today's read surface is exactly ONE file:
//
//   - src/app/api/admin/stats/route.ts — admin stats dashboard,
//     groups by key_source for the master-vs-BYOK margin breakdown.
//     Gated by validateAdmin() (Lane 4.134).
//
// gateway_usage_log is also written via the `log_gateway_request`
// RPC (gateway.ts passes `p_key_source` as parameter). RPC writes
// are NOT SELECT-projections and out of scope for this guard.
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('gateway_usage_log').select('… key_source …')`
//      outside the allow-list.
//   2. `.returns<{ key_source: … }>()` generic outside the
//      allow-list.
//   3. Raw SQL `SELECT … key_source … FROM gateway_usage_log`
//      anywhere in src/.
//
// Source-file regex parser only — registry imports often pull
// in createClient() at module load and crash without prod env
// (memory rule #59).
//
// Sibling guards:
//   - Lane 4.140 (gateway_usage_log SELECT owner-filter)
//   - Lane 4.142 (gateway_usage_log direct-mutation allow-list)
//   - Lane 4.156 (gateway_usage_log.cost_to_us projection)
//   - Lane 4.143 / 4.144 / 4.145 / 4.147–4.151 (column-projection family)

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

// Files allowed to SELECT `key_source` from `gateway_usage_log`.
// Exactly one read path: the admin stats dashboard.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/app/api/admin/stats/route.ts",
]);

describe("Lane 4.157 — gateway_usage_log.key_source SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT key_source from gateway_usage_log", () => {
    const re =
      /\.from\(\s*["']gateway_usage_log["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\bkey_source\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare key_source in a gateway_usage_log .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']gateway_usage_log["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\bkey_source\b/;
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

  it("no raw SQL SELECT key_source FROM gateway_usage_log in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\bkey_source\b[\s\S]*?\bFROM\s+gateway_usage_log\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
