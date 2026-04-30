import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.145 — drift guard: user_provider_keys.api_key_encrypted
// SELECT-projection allow-list (BYOK plaintext-key column).
//
// `user_provider_keys.api_key_encrypted` holds users' BYOK provider
// credentials. Despite the column name, the value is plaintext at rest
// today (Lane 4.36 audit memo, Codex #52 ticket pending Vault encryption).
// Until Vault lands, every callsite that SELECTs this column is, in
// effect, holding a plaintext user-supplied provider key.
//
// Today the application layer reads `api_key_encrypted` in only ONE
// file:
//
//   - src/lib/gateway.ts — BYOK key resolution. Two .select() calls,
//     one in the executeAdapter inner block (line ~308) and one inside
//     the resolveKeyForSlug helper (line ~350), both used to resolve
//     the user's prefer_own_key row before falling through to the
//     master-pool path.
//
// Any other read site is a new place a BYOK plaintext key crosses the
// SQL→TS boundary. Keep the surface at exactly one file.
//
// This guard intentionally does NOT cover writes — Lane 4.127 already
// allow-lists writes against user_provider_keys (POST upsert + DELETE
// soft-update from byok/route.ts only), and Lane 4.36 (byok-plaintext-
// guard) already targets the `api_key_encrypted: <plaintext>` write
// property pattern with a grandfathered offender list.
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('user_provider_keys').select('… api_key_encrypted …')`
//      outside `src/lib/gateway.ts`.
//   2. `.returns<{ api_key_encrypted: … }>()` generic outside
//      `src/lib/gateway.ts`.
//   3. Raw SQL `SELECT … api_key_encrypted … FROM user_provider_keys`
//      anywhere in src/.
//
// Source-file regex parser (NOT runtime import) — registry imports often
// pull in createClient() and crash without prod env (memory rule #59).
// Sibling guards: Lane 4.143 (api_keys.key_hash projection), Lane 4.144
// (tool_providers.auth_key_encrypted projection + write), Lane 4.127
// (user_provider_keys writes), Lane 4.36 (BYOK plaintext write
// property).

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

// Strip /* … */ block comments and // line comments before regex matching
// so JSDoc references to the column don't trigger false positives
// (memory rule from prior drift-guard work).
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function rel(file: string): string {
  return file.replace(SRC_ROOT, "src").replace(/\\/g, "/");
}

// Files allowed to SELECT `api_key_encrypted` from `user_provider_keys`.
// Exactly one read path: BYOK key resolution in the gateway.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/lib/gateway.ts",
]);

describe("Lane 4.145 — user_provider_keys.api_key_encrypted SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT api_key_encrypted from user_provider_keys", () => {
    const re =
      /\.from\(\s*["']user_provider_keys["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\bapi_key_encrypted\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare api_key_encrypted in a user_provider_keys .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']user_provider_keys["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\bapi_key_encrypted\b/;
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

  it("no raw SQL SELECT api_key_encrypted FROM user_provider_keys in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\bapi_key_encrypted\b[\s\S]*?\bFROM\s+user_provider_keys\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
