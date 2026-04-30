import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.185 — drift guard: user_provider_keys.is_active
// SELECT-projection allow-list.
//
// `user_provider_keys.is_active` is the per-row soft-delete /
// enable-disable boolean on each tenant's stored BYOK key. It
// discloses, per row, whether a tenant has a live BYOK key for
// a given provider. Combined with `tool_slug` (Lane 4.184) it
// answers "does tenant X actively use BYOK for provider Y" —
// the per-tenant adoption signal that competitive intel cares
// about.
//
// Today's read surface is exactly 1 file (two callsites within
// the same file):
//
//   - src/app/api/v1/byok/route.ts —
//       (a) Line ~38: UPSERT response shape after a BYOK key
//           is registered/refreshed. Returns id, tool_slug,
//           is_active, prefer_own_key, created_at — owner-
//           scoped because the upsert targeted the caller's
//           own user_id.
//       (b) Line ~77: GET BYOK list. Returns id, tool_slug,
//           is_active, prefer_own_key, created_at, updated_at —
//           filtered by `.eq("user_id", userId)`.
//
// No other user_provider_keys SELECT projects is_active today.
// gateway.ts lines 312/334/354/371 chain `.eq("is_active", true)`
// as a filter to the api_key_encrypted SELECT — that's a row-
// filter, not a projection (the regex correctly distinguishes:
// it only matches `is_active` inside the `.select(...)` quoted
// argument). admin/providers/route.ts:174 projects `is_active`
// from the DIFFERENT `tool_providers` table (provider catalog),
// not user_provider_keys. api_keys.is_active is locked
// separately by Lane 4.167 — different table, same column name.
//
// Why guard is_active even though it's not a credential:
//
//   - Per-row is_active discloses per-tenant BYOK adoption
//     status. A new SELECT reader without
//     `.eq("user_id", auth.uid())` would expose other tenants'
//     BYOK adoption posture per row.
//   - Combined with `tool_slug` (Lane 4.184), it answers the
//     "active BYOK provider mix" query for any tenant — which
//     is the exact piece of competitive intel that motivates
//     locking down user_provider_keys.
//   - Combined with `api_key_encrypted` (Lane 4.145), the
//     user_provider_keys lockdown family closes the credential
//     channel, the inventory channel, AND the adoption-status
//     channel.
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('user_provider_keys').select('… is_active …')`
//      outside the allow-list.
//   2. `.returns<{ is_active: … }>()` generic outside the
//      allow-list.
//   3. Raw SQL `SELECT … is_active … FROM user_provider_keys`
//      anywhere in src/.
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards:
//   - Lane 4.127 (user_provider_keys write-paths)
//   - Lane 4.145 (user_provider_keys.api_key_encrypted projection)
//   - Lane 4.167 (api_keys.is_active projection — different table, same column name)
//   - Lane 4.184 (user_provider_keys.tool_slug projection)

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

// Files allowed to SELECT `is_active` from `user_provider_keys`.
// Each entry has a real reason — see lane comment above.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/app/api/v1/byok/route.ts",
]);

describe("Lane 4.185 — user_provider_keys.is_active SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT is_active from user_provider_keys", () => {
    const re =
      /\.from\(\s*["']user_provider_keys["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\bis_active\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare is_active in a user_provider_keys .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']user_provider_keys["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\bis_active\b/;
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

  it("no raw SQL SELECT is_active FROM user_provider_keys in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\bis_active\b[\s\S]*?\bFROM\s+user_provider_keys\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
