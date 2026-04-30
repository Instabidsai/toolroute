import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.184 — drift guard: user_provider_keys.tool_slug
// SELECT-projection allow-list.
//
// `user_provider_keys.tool_slug` is the per-row identifier of
// which adapter a stored BYOK key targets (e.g., "openai/chat",
// "anthropic/messages", "deepl/translate"). This column maps
// each tenant's BYOK rows to the specific upstream tool — i.e.,
// it discloses each tenant's BYOK provider inventory.
//
// Today's read surface is exactly 1 file:
//
//   - src/app/api/v1/byok/route.ts —
//       Owner-scoped GET BYOK list. Projects tool_slug
//       alongside id, is_active, prefer_own_key, created_at,
//       updated_at (line ~76). Filtered by
//       `.eq("user_id", userId)`.
//
// No other user_provider_keys SELECT projects tool_slug today.
// gateway.ts:308 and gateway.ts:350 both project ONLY
// `api_key_encrypted` (locked by Lane 4.145), filtering by
// `.eq("user_id", ctx.userId).eq("tool_slug", adapter.slug)` —
// that's a filter, not a projection (the projection list is the
// argument to `.select(...)`, the filter list is the chained
// `.eq()` calls). byok/route.ts:123 selects only `id` after a
// soft-delete update. None of these project `tool_slug`.
//
// Why guard tool_slug even though it's not a credential:
//
//   - `tool_slug` discloses each tenant's BYOK provider mix —
//     which AI/SaaS providers they bring their own key for, in
//     what combinations. A new SELECT reader without
//     `.eq("user_id", auth.uid())` would expose other tenants'
//     BYOK provider inventory per row.
//   - Cross-tenant BYOK-mix data is competitive intel about
//     ToolRoute's customer base AND about each customer's
//     vendor strategy (which providers they consider
//     strategic enough to manage their own keys for).
//   - Combined with `api_key_encrypted` (Lane 4.145), the
//     existing user_provider_keys lockdown family closes both
//     the credential AND the per-row inventory channel.
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('user_provider_keys').select('… tool_slug …')`
//      outside the allow-list.
//   2. `.returns<{ tool_slug: … }>()` generic outside the
//      allow-list.
//   3. Raw SQL `SELECT … tool_slug … FROM user_provider_keys`
//      anywhere in src/.
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards:
//   - Lane 4.127 (user_provider_keys write-paths)
//   - Lane 4.145 (user_provider_keys.api_key_encrypted projection)

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

// Files allowed to SELECT `tool_slug` from `user_provider_keys`.
// Each entry has a real reason — see lane comment above.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/app/api/v1/byok/route.ts",
]);

describe("Lane 4.184 — user_provider_keys.tool_slug SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT tool_slug from user_provider_keys", () => {
    const re =
      /\.from\(\s*["']user_provider_keys["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\btool_slug\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare tool_slug in a user_provider_keys .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']user_provider_keys["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\btool_slug\b/;
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

  it("no raw SQL SELECT tool_slug FROM user_provider_keys in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\btool_slug\b[\s\S]*?\bFROM\s+user_provider_keys\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
