import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.158 — drift guard: gateway_usage_log.used_byok
// SELECT-projection EMPTY allow-list (no readers today).
//
// `gateway_usage_log.used_byok` is a denormalized boolean stamped
// at write-time by `log_gateway_request` from `keySource === "byok"`
// (gateway.ts:410, gateway.ts:466). The same information lives in
// the sibling column `key_source` ("master" / "byok"), and Lane
// 4.157 already locks `key_source` SELECT-projection to a single
// admin-only file. Today the application reads `used_byok` from
// ZERO files: the column is write-only at the app layer.
//
// This guard freezes that property. Any future SELECT-projection
// of `used_byok` is a NEW exposure surface for the master-vs-BYOK
// routing signal — and almost certainly redundant with `key_source`.
// The diff reviewer must justify (and either retire `used_byok`
// in favor of `key_source`, or add to this allow-list with an
// explicit reason) before adding a reader.
//
// Why the empty allow-list isn't fragile:
//   - `used_byok` is denormalized from `key_source`. If a real
//     reader needs the boolean, computing `key_source === "byok"`
//     in the existing 4.157 allow-listed file (admin/stats) is
//     trivially equivalent.
//   - The risk class is identical to 4.157: discloses master-pool
//     vs BYOK routing, per-tenant infrastructure-fingerprinting
//     signal.
//   - Empty-allow-list is the strongest possible drift guard:
//     "don't project this column, anywhere." Defensible because
//     the same information is reachable via `key_source` already.
//
// gateway_usage_log is also written via the `log_gateway_request`
// RPC (gateway.ts passes `p_used_byok` as parameter). RPC writes
// are NOT SELECT-projections and out of scope for this guard.
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('gateway_usage_log').select('… used_byok …')`
//      anywhere in src/.
//   2. `.returns<{ used_byok: … }>()` generic anywhere in src/.
//   3. Raw SQL `SELECT … used_byok … FROM gateway_usage_log`
//      anywhere in src/.
//
// Source-file regex parser only — registry imports often pull
// in createClient() at module load and crash without prod env
// (memory rule #59).
//
// Sibling guards:
//   - Lane 4.140 (gateway_usage_log SELECT owner-filter)
//   - Lane 4.142 (gateway_usage_log direct-mutation allow-list)
//   - Lane 4.156 (gateway_usage_log.cost_to_us projection — admin only)
//   - Lane 4.157 (gateway_usage_log.key_source projection — admin only)

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

// Empty allow-list — used_byok has zero SELECT-projection readers
// today (denormalized from key_source, which Lane 4.157 already
// locks to admin-only). Adding a reader requires a deliberate
// allow-list expansion + reviewer justification.
const PROJECTION_ALLOWLIST = new Set<string>([]);

describe("Lane 4.158 — gateway_usage_log.used_byok empty SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("no files SELECT used_byok from gateway_usage_log (empty allow-list)", () => {
    const re =
      /\.from\(\s*["']gateway_usage_log["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\bused_byok\b[^"'`]*["'`]/;
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

  it("no files declare used_byok in a gateway_usage_log .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']gateway_usage_log["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\bused_byok\b/;
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

  it("no raw SQL SELECT used_byok FROM gateway_usage_log in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\bused_byok\b[\s\S]*?\bFROM\s+gateway_usage_log\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
