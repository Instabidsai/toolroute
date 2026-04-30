import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.206 — drift guard: api_keys.id SELECT-projection
// allow-list.
//
// `api_keys.id` is the PK on the per-tenant API-key table. Lane
// 4.202 already locked `api_keys.user_id` projection to an EMPTY
// allow-list (zero readers — user_id is exclusively a WHERE-
// predicate filter, never projected). This complement guards the
// PK column.
//
// Risk class is mostly indirect: `id` alone is opaque to a caller
// that doesn't already have the row, but `id` paired with `user_id`
// (4.202), `key_hash` (4.143), `key_prefix` (4.166), `name` (4.174),
// `allowed_tools` (4.168), or `is_active` (4.167) reconstructs key-
// inventory snapshots across tenants.
//
// Today's read surface is exactly 1 file:
//
//   - src/app/api/v1/keys/route.ts — owner-scoped management
//       endpoints. Four `id` projection callsites:
//         * line ~113: GET /api/v1/keys list — projects
//             `id, name, key_prefix, allowed_tools, is_active,
//             last_used_at, created_at, expires_at` filtered by
//             `eq("user_id", userId)`.
//         * line ~171: revoke (DELETE) existence check —
//             `.select("id").eq("id", body.key_id).eq("user_id",
//             userId).single()`.
//         * line ~261: rename (PATCH) existence check — same
//             shape as ~171.
//         * line ~275: rename (PATCH) returns updated row —
//             `.update({name}).eq("id", keyId).eq("user_id",
//             userId).select("id, name, key_prefix, ...")`.
//
// `src/lib/gateway.ts:75` uses `id` as a WHERE filter
// (`.eq("id", keyId)`) but projects `expires_at`, not `id` — so
// it's NOT in scope for this guard. (Same disambiguation pattern
// as Lane 4.199 user_id: filter-vs-projection.)
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('api_keys').select('… id …')` outside the
//      allow-list.
//   2. `.returns<{ id: … }>()` generic outside the allow-list.
//   3. Raw SQL `SELECT … id … FROM api_keys` anywhere in src/.
//
// REGEX PRECISION (reusable pattern for short-identifier cols, first
// proven in Lane 4.204):
//
// Because `id` is a 2-char common identifier, the standard
// `[\s\S]{0,500}?` window over-matches when a `.from("api_keys")`
// is followed within 500 chars by a `.from(other_table).select(
// "id")`. The negative-lookahead `(?:(?!\.from\()[\s\S]){0,500}?`
// bars intervening `.from(` calls. (Lane 4.204 caught this on
// dashboard/page.tsx where gateway_users + gateway_usage_log
// appear within ~10 lines.) Same pattern reused in 4.205.
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards on api_keys:
//   - 4.123 (user_id immutable write-paths)
//   - 4.129 (UPDATE/DELETE write-paths)
//   - 4.143 (key_hash projection)
//   - 4.166 (key_prefix projection)
//   - 4.167 (is_active projection)
//   - 4.168 (allowed_tools projection)
//   - 4.169 (expires_at projection)
//   - 4.170 (last_used_at projection)
//   - 4.173 (rate_limit_rpm/rpd empty allow-list)
//   - 4.174 (name projection)
//   - 4.183 (request_count empty allow-list)
//   - 4.202 (user_id empty allow-list)
//
// Sibling PK projection guards:
//   - 4.204 (gateway_users.id, where the negative-lookahead pattern
//     was first proven)
//   - 4.205 (credit_transactions.id)

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

// Files allowed to SELECT `id` from `api_keys`.
// Each entry has a real reason — see lane comment above.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/app/api/v1/keys/route.ts",
]);

describe("Lane 4.206 — api_keys.id SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT id from api_keys", () => {
    const re =
      /\.from\(\s*["']api_keys["']\s*\)(?:(?!\.from\()[\s\S]){0,500}?\.select\(\s*["'`][^"'`]*\bid\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare id in an api_keys .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']api_keys["']\s*\)(?:(?!\.from\()[\s\S]){0,500}?\.returns<[\s\S]*?\bid\b/;
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

  it("no raw SQL SELECT id FROM api_keys in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\bid\b[\s\S]*?\bFROM\s+api_keys\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
