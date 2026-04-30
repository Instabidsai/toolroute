import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.183 — drift guard: api_keys.request_count
// SELECT-projection EMPTY allow-list (no readers today).
//
// `api_keys.request_count` is a denormalized counter on each
// API key row, intended to track total request volume per key.
// Today the application reads `request_count` from ZERO files
// at the SELECT layer: the column has no UI surface and no
// route handler that projects it.
//
// This guard freezes that property. Any future SELECT-projection
// of `request_count` is a NEW exposure surface for per-tenant
// API-volume signal — and almost certainly redundant with a
// `count(*)` over `gateway_usage_log` which is already locked by
// Lane 4.140 (owner-scoped SELECT) and Lane 4.142 (mutation
// allow-list). The diff reviewer must justify (and either
// retire `request_count` in favor of computing from the log
// table, or add to this allow-list with an explicit reason)
// before adding a reader.
//
// Why the empty allow-list isn't fragile:
//   - `request_count` is denormalized from `gateway_usage_log`
//     row counts. If a real reader needs the count, computing
//     `SELECT count(*) FROM gateway_usage_log WHERE
//     api_key_id = $1 AND user_id = auth.uid()` in an existing
//     allow-listed file is trivially equivalent and inherits
//     the row-shape lockdown already applied to the log table
//     (Lane 4.140 owner-filter, 4.142 mutation, 4.156-4.158,
//     4.177-4.182 per-column projection guards).
//   - The risk class is per-tenant API-volume disclosure: a
//     reader without `.eq("user_id", auth.uid())` would expose
//     other tenants' usage volume per key. Identical class to
//     gateway_usage_log row-counting reads.
//   - Empty-allow-list is the strongest possible drift guard:
//     "don't project this column, anywhere." Defensible because
//     the same information is reachable via `gateway_usage_log`
//     already (and that path enforces owner-scope by RLS +
//     Lane 4.140 source-level guard).
//
// api_keys is also written via `validate_api_key` RPC and the
// signup / keys-create / keys-rename routes (write-side locked
// by Lanes 4.123, 4.129, 4.131). RPC return-shape reads are NOT
// SELECT-projections and out of scope for this guard.
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('api_keys').select('… request_count …')`
//      anywhere in src/.
//   2. `.returns<{ request_count: … }>()` generic anywhere in src/.
//   3. Raw SQL `SELECT … request_count … FROM api_keys`
//      anywhere in src/.
//
// Source-file regex parser only — registry imports often pull
// in createClient() at module load and crash without prod env
// (memory rule #59).
//
// Sibling guards:
//   - Lane 4.123 (api_keys.user_id immutable write-paths)
//   - Lane 4.129 (api_keys UPDATE/DELETE write-paths)
//   - Lane 4.131 (validate_api_key RPC layer)
//   - Lane 4.143 (api_keys.key_hash projection allow-list)
//   - Lane 4.158 (gateway_usage_log.used_byok empty allow-list — same pattern)
//   - Lane 4.166 (api_keys.key_prefix projection allow-list)
//   - Lane 4.167 (api_keys.is_active projection allow-list)
//   - Lane 4.168 (api_keys.allowed_tools projection allow-list)
//   - Lane 4.169 (api_keys.expires_at projection allow-list)
//   - Lane 4.170 (api_keys.last_used_at projection allow-list)
//   - Lane 4.173 (api_keys.rate_limit_rpm/rpd empty allow-list)
//   - Lane 4.174 (api_keys.name projection allow-list)

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

// Empty allow-list — request_count has zero SELECT-projection
// readers today (denormalized from gateway_usage_log row counts,
// which Lane 4.140 already locks to owner-scope). Adding a reader
// requires a deliberate allow-list expansion + reviewer
// justification.
const PROJECTION_ALLOWLIST = new Set<string>([]);

describe("Lane 4.183 — api_keys.request_count empty SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("no files SELECT request_count from api_keys (empty allow-list)", () => {
    const re =
      /\.from\(\s*["']api_keys["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\brequest_count\b[^"'`]*["'`]/;
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

  it("no files declare request_count in an api_keys .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']api_keys["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\brequest_count\b/;
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

  it("no raw SQL SELECT request_count FROM api_keys in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\brequest_count\b[\s\S]*?\bFROM\s+api_keys\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
