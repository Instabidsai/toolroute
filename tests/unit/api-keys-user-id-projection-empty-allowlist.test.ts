import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.202 — drift guard: api_keys.user_id
// SELECT-projection EMPTY allow-list (no readers today).
//
// `api_keys.user_id` is the FK from each `tr_live_*` / `tr_test_*`
// API key row to the owning gateway_users.id. Today the application
// reads `user_id` from ZERO files: every `.from("api_keys")` SELECT
// uses `user_id` exclusively as a row predicate (`.eq("user_id",
// userId)`) and projects only `id`, `name`, `key_prefix`,
// `allowed_tools`, `is_active`, `last_used_at`, `created_at`,
// `expires_at`. Auth resolution flows through the validate_api_key
// RPC (Lane 4.131), not direct .from("api_keys") projections.
//
// This guard freezes that property. Any future SELECT-projection
// of `user_id` would be a NEW cross-tenant identifier exposure on
// the API-key surface — and is almost certainly redundant (caller
// already knows the user_id from the WHERE predicate or from the
// validate_api_key RPC return).
//
// Why the empty allow-list isn't fragile:
//   - Per-row reads are owner-scoped: the WHERE clause already
//     filters by user_id, so projecting it back is redundant.
//   - The validate_api_key RPC (Lane 4.131) is the canonical path
//     for resolving an API key → user_id, and that RPC's callsite
//     allow-list is already locked.
//   - Cross-tenant API-key admin views don't exist today; if they
//     did, the diff reviewer must add this file's allow-list entry
//     with explicit reason — empty-allow-list forces that
//     conversation rather than allowing silent drift.
//
// Risk class if violated:
//   - Combined with `key_prefix` (4.166) or `name` (4.174):
//     per-user API-key inventory disclosure.
//   - Combined with `last_used_at` (4.170): per-user activity
//     fingerprint.
//   - Combined with `is_active` (4.167) or `expires_at` (4.169):
//     per-user revocation / lifecycle posture.
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('api_keys').select('… user_id …')` anywhere in src/.
//   2. `.returns<{ user_id: … }>()` generic anywhere in src/.
//   3. Raw SQL `SELECT … user_id … FROM api_keys` anywhere in src/.
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards on api_keys:
//   - 4.123 (user_id immutable on UPDATE — write-side complement)
//   - 4.129 (UPDATE/DELETE write-paths)
//   - 4.143 (key_hash projection — credential)
//   - 4.166 (key_prefix projection)
//   - 4.167 (is_active projection)
//   - 4.168 (allowed_tools projection)
//   - 4.169 (expires_at projection)
//   - 4.170 (last_used_at projection)
//   - 4.173 (rate_limit_rpm/rpd empty)
//   - 4.174 (name projection)
//   - 4.183 (request_count empty)
//   - 4.202 (user_id empty) ← THIS LANE

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

// Empty allow-list — api_keys.user_id has zero SELECT-projection
// readers today. Adding a reader requires deliberate allow-list
// expansion + reviewer justification.
const PROJECTION_ALLOWLIST = new Set<string>([]);

describe("Lane 4.202 — api_keys.user_id empty SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("no files SELECT user_id from api_keys (empty allow-list)", () => {
    const re =
      /\.from\(\s*["']api_keys["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\buser_id\b[^"'`]*["'`]/;
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

  it("no files declare user_id in an api_keys .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']api_keys["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\buser_id\b/;
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

  it("no raw SQL SELECT user_id FROM api_keys in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\buser_id\b[\s\S]*?\bFROM\s+api_keys\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
