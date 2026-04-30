import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.167 — drift guard: api_keys.is_active SELECT-projection
// allow-list.
//
// `api_keys.is_active` is the boolean revocation state of each API
// key. A request authenticated by a key whose `is_active = false`
// should be rejected at validate-time; a key whose `is_active = true`
// authorizes paid gateway access. The runtime authorization path
// goes through the `validate_api_key` RPC (Lane 4.131), NOT through
// a SELECT projection — so every projection of `is_active` here is
// purely user-facing display state, not authorization state.
//
// Lane 4.123 already locks the WRITE side of `api_keys.user_id` (no
// post-create owner reassignment), Lane 4.129 locks UPDATE/DELETE
// shape (only owner-scoped + canonical mutation paths), Lane 4.143
// locks the projection of `key_hash`, and Lane 4.166 locks the
// projection of `key_prefix`. This guard is the projection complement
// for `is_active`: every SELECT projection that pulls `is_active` is
// a place the revocation state crosses the SQL→TS boundary.
//
// Today's read surface is exactly 1 file with 3 callsites, all
// owner-scoped:
//
//   - src/app/api/v1/keys/route.ts —
//       POST create response (.select("id, name, key_prefix,
//         allowed_tools, is_active, …"), line ~65)
//       GET list, .eq("user_id", userId) (.select("id, name,
//         key_prefix, allowed_tools, is_active, …"), line ~115)
//       PATCH rename response, .eq("user_id", userId)
//         (.select("id, name, key_prefix, allowed_tools,
//         is_active, …"), line ~279)
//
// Every other `.from('api_keys')` callsite in src/ is either an
// idempotency probe (`.select("id")`), a TTL probe
// (`.select("expires_at")` in gateway.ts), an INSERT, an UPDATE, or
// a DELETE — none project `is_active`.
//
// Why guard this column even though authorization runs through an
// RPC, not a SELECT:
//
//   - A new SELECT reader could be a place where stale-cached
//     `is_active` causes the dashboard / admin tool / support UI to
//     mis-render a revoked key as active (or vice-versa) — operational
//     surprise + support churn even when the runtime correctly rejects
//     requests.
//   - Cross-tenant aggregation of `is_active` (e.g., "how many active
//     paid keys does each tenant have") fingerprints account scale.
//   - Lane 4.129 covers the WRITE path (revocation goes through
//     canonical mutation only); this lane covers the READ path of the
//     same boolean.
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('api_keys').select('… is_active …')` outside the
//      allow-list.
//   2. `.returns<{ is_active: … }>()` generic outside the allow-list
//      (no callsite uses this today, but lock it down anyway because
//      TS-narrowing makes the leak invisible to readers).
//   3. Raw SQL `SELECT … is_active … FROM api_keys` anywhere in src/.
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards:
//   - Lane 4.123 (api_keys.user_id immutable write-paths)
//   - Lane 4.129 (api_keys UPDATE/DELETE write-paths)
//   - Lane 4.131 (validate_api_key RPC layer)
//   - Lane 4.143 (api_keys.key_hash SELECT-projection)
//   - Lane 4.166 (api_keys.key_prefix SELECT-projection)

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

// Files allowed to SELECT `is_active` from `api_keys`.
// Exactly one read path: owner-scoped key management endpoints.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/app/api/v1/keys/route.ts",
]);

describe("Lane 4.167 — api_keys.is_active SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT is_active from api_keys", () => {
    const re =
      /\.from\(\s*["']api_keys["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\bis_active\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare is_active in an api_keys .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']api_keys["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\bis_active\b/;
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

  it("no raw SQL SELECT is_active FROM api_keys in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\bis_active\b[\s\S]*?\bFROM\s+api_keys\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
