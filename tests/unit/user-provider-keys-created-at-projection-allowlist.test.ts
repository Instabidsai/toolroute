import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.213 — drift guard: user_provider_keys.created_at
// SELECT-projection allow-list.
//
// `user_provider_keys.created_at` is the issuance-timestamp axis
// on the per-tenant BYOK table. Pairing `created_at` with
// `tool_slug` (4.184) + `is_active` (4.185) + `prefer_own_key`
// (4.200) reconstructs the user's full BYOK adoption timeline —
// when each provider key was registered, churn rates, dormant-
// key inventory.
//
// On its own, `created_at` is just a row timestamp. In combination
// with the user_provider_keys column family already locked
// (4.184/4.185/4.200/4.208) it adds the *issuance time axis*
// required for any longitudinal BYOK-adoption profiling.
//
// Today's read surface is exactly 1 file:
//
//   - src/app/api/v1/byok/route.ts — owner-scoped BYOK management
//       endpoint:
//         * line ~38: POST register/upsert — returns canonical
//             shape `id, tool_slug, is_active, prefer_own_key,
//             created_at` after upsert.
//         * line ~77: GET list — projects `id, tool_slug,
//             is_active, prefer_own_key, created_at, updated_at`
//             filtered by `eq("user_id", userId)`. Same-tenant
//             by construction.
//
// `src/lib/gateway.ts:308, :350` use `user_id + tool_slug` filters
// but project `api_key_encrypted` only (4.145 lockdown), NOT
// `created_at` — so they are NOT in scope (filter-vs-projection
// disambiguation, same as Lanes 4.208 / 4.210 / 4.211 / 4.212).
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('user_provider_keys').select('… created_at …')`
//      outside the allow-list.
//   2. `.returns<{ created_at: … }>()` generic outside the
//      allow-list.
//   3. Raw SQL `SELECT … created_at … FROM user_provider_keys`
//      anywhere in src/.
//
// REGEX PRECISION:
//
// `created_at` is long-enough (10 chars) — standard
// `[\s\S]{0,500}?` window suffices. Adjacent tables that also
// project `created_at` are caught by their own table-specific
// guards (Lanes 4.210/4.211/4.212).
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
//   - 4.208 (id projection)

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

// Files allowed to SELECT `created_at` from `user_provider_keys`.
// Each entry has a real reason — see lane comment above.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/app/api/v1/byok/route.ts",
]);

describe("Lane 4.213 — user_provider_keys.created_at SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT created_at from user_provider_keys", () => {
    const re =
      /\.from\(\s*["']user_provider_keys["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\bcreated_at\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare created_at in a user_provider_keys .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']user_provider_keys["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\bcreated_at\b/;
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

  it("no raw SQL SELECT created_at FROM user_provider_keys in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\bcreated_at\b[\s\S]*?\bFROM\s+user_provider_keys\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
