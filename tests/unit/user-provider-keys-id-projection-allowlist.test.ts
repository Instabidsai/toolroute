import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.208 — drift guard: user_provider_keys.id SELECT-projection
// allow-list.
//
// `user_provider_keys.id` is the PK on the per-tenant BYOK table.
// Closes the PK family across all 5 financial tables:
//   - 4.204 (gateway_users.id)
//   - 4.205 (credit_transactions.id)
//   - 4.206 (api_keys.id)
//   - 4.207 (gateway_usage_log.id)
//   - 4.208 (user_provider_keys.id) ← THIS LANE
//
// Risk class is mostly indirect: `id` alone is opaque, but `id`
// paired with `user_id`, `tool_slug` (4.184), `is_active` (4.185),
// `prefer_own_key` (4.200), `created_at` enables BYOK-inventory
// reconstruction across tenants — Class-A audit signal (which
// tenants have BYOK keys for which providers).
//
// Today's read surface is exactly 1 file:
//
//   - src/app/api/v1/byok/route.ts — owner-scoped BYOK management
//       endpoint:
//         * line ~76: GET /api/v1/byok list — projects
//             `id, tool_slug, is_active, prefer_own_key,
//             created_at, updated_at` filtered by
//             `eq("user_id", userId)`. Same-tenant by construction.
//         * line ~127: DELETE (soft) — `.update({is_active:false})
//             .eq("user_id", userId).eq("tool_slug", tool_slug)
//             .select("id")` — returns id of the deleted row for
//             the response payload.
//
// `src/lib/gateway.ts:308, :350` use `user_id + tool_slug` filters
// but project `api_key_encrypted` only (4.145 lockdown), NOT `id` —
// so they are NOT in scope (filter-vs-projection disambiguation,
// same as Lane 4.199 user_id and Lane 4.206 api_keys.id).
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('user_provider_keys').select('… id …')` outside the
//      allow-list.
//   2. `.returns<{ id: … }>()` generic outside the allow-list.
//   3. Raw SQL `SELECT … id … FROM user_provider_keys` anywhere
//      in src/.
//
// REGEX PRECISION (reusable pattern for short-identifier cols, first
// proven in Lane 4.204):
//
// Because `id` is a 2-char common identifier, the standard
// `[\s\S]{0,500}?` window over-matches when an unrelated
// `.from(other_table).select("id")` falls within 500 chars. The
// negative-lookahead `(?:(?!\.from\()[\s\S]){0,500}?` bars
// intervening `.from(` calls. Same pattern reused in 4.205, 4.206,
// 4.207.
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards on user_provider_keys:
//   - 4.127 (write-paths)
//   - 4.145 (api_key_encrypted projection)
//   - 4.184 (tool_slug projection)
//   - 4.185 (is_active projection)
//   - 4.200 (prefer_own_key projection)
//
// Sibling PK projection guards:
//   - 4.204 (gateway_users.id, where the negative-lookahead pattern
//     was first proven)
//   - 4.205 (credit_transactions.id)
//   - 4.206 (api_keys.id)
//   - 4.207 (gateway_usage_log.id)

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

// Files allowed to SELECT `id` from `user_provider_keys`.
// Each entry has a real reason — see lane comment above.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/app/api/v1/byok/route.ts",
]);

describe("Lane 4.208 — user_provider_keys.id SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT id from user_provider_keys", () => {
    const re =
      /\.from\(\s*["']user_provider_keys["']\s*\)(?:(?!\.from\()[\s\S]){0,500}?\.select\(\s*["'`][^"'`]*\bid\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare id in a user_provider_keys .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']user_provider_keys["']\s*\)(?:(?!\.from\()[\s\S]){0,500}?\.returns<[\s\S]*?\bid\b/;
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

  it("no raw SQL SELECT id FROM user_provider_keys in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\bid\b[\s\S]*?\bFROM\s+user_provider_keys\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
