import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.144 — drift guard: tool_providers.auth_key_encrypted projection
// + write allow-list.
//
// `tool_providers.auth_key_encrypted` holds master-pool API keys for the
// 51 tool adapters (despite the column name, the value is plaintext today
// — Lane 4.106 audit memo, Codex #52 ticket pending for Vault encryption).
// Until Vault lands, the surface area is simple: any callsite that reads
// or writes that column is, in effect, holding a plaintext provider key.
//
// Today the application layer touches the column in only TWO places:
//
//   - READ: `src/lib/gateway.ts` selects `auth_key_encrypted` once per
//     gateway request to resolve the master-pool key when no BYOK row
//     applies (executeAdapter inner block, lines ~295-310).
//
//   - WRITE: `src/app/api/admin/providers/route.ts` writes the column on
//     admin POST (insert + update branches). This is the only admin
//     rotation/seeding path. The route is gated by validateAdmin().
//
// All other code MUST stay off this column. Any new READ callsite is a
// new place a plaintext key crosses the SQL→TS boundary; any new WRITE
// callsite is a new path that bypasses the admin gate. Keep the surface
// at exactly one read site and one write site.
//
// Three classes of violation:
//
//   1. SELECT projection that names `auth_key_encrypted` outside
//      `src/lib/gateway.ts`.
//   2. WRITE (.insert / .update / .upsert) that names `auth_key_encrypted`
//      in its payload outside `src/app/api/admin/providers/route.ts`.
//   3. Raw SQL `INSERT/UPDATE … auth_key_encrypted …` anywhere in src/
//      (no current callsite — block defense-in-depth).
//
// Source-file regex parser (NOT runtime import) — registry imports often
// pull in createClient() and crash without prod env (memory rule #59).
// Sibling guards: Lane 4.142 (gateway_usage_log mutation allow-list),
// Lane 4.143 (api_keys.key_hash projection allow-list), Lane 4.127
// (user_provider_keys write allow-list).

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
// so JSDoc references to `auth_key_encrypted` (e.g. the explanatory comment
// at the top of admin/providers/route.ts) don't trigger false positives.
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function rel(file: string): string {
  return file.replace(SRC_ROOT, "src").replace(/\\/g, "/");
}

// Files allowed to SELECT `auth_key_encrypted` from `tool_providers`.
// Exactly one read path: master-pool key resolution in the gateway.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/lib/gateway.ts",
]);

// Files allowed to WRITE `auth_key_encrypted` into `tool_providers`.
// Exactly one write path: admin POST (insert + update) for rotation/seed.
const WRITE_ALLOWLIST = new Set<string>([
  "src/app/api/admin/providers/route.ts",
]);

describe("Lane 4.144 — tool_providers.auth_key_encrypted projection + write allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT auth_key_encrypted from tool_providers", () => {
    // .from('tool_providers').select('… auth_key_encrypted …')
    const re =
      /\.from\(\s*["']tool_providers["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\bauth_key_encrypted\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare auth_key_encrypted in a tool_providers .returns<>() generic", () => {
    // .from('tool_providers') … .returns<{ auth_key_encrypted: … }>()
    const re =
      /\.from\(\s*["']tool_providers["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\bauth_key_encrypted\b/;
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

  it("only allow-listed files WRITE auth_key_encrypted into tool_providers", () => {
    // .from('tool_providers') … .insert/.update/.upsert({ … auth_key_encrypted: … })
    // — payload may be inline object or referenced var; we look for the column
    // name following insert/update/upsert within the same statement window.
    const re =
      /\.from\(\s*["']tool_providers["']\s*\)[\s\S]{0,500}?\.(?:insert|update|upsert)\([\s\S]{0,800}?\bauth_key_encrypted\b/;
    // Also catch the var-then-write pattern used in admin/providers/route.ts
    // (updateFields.auth_key_encrypted = … then .update(updateFields)).
    const reVarAssign = /\bauth_key_encrypted\b\s*[:=]/;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      const writesViaInline = re.test(src);
      // Var-assign pattern only counts as a WRITE if the file also calls
      // .from('tool_providers').(insert|update|upsert). Otherwise a SELECT-
      // typed result destructure would false-positive.
      const mentionsTable = /\.from\(\s*["']tool_providers["']\s*\)/.test(src);
      const writesViaTable =
        mentionsTable &&
        /\.(?:insert|update|upsert)\(/.test(src) &&
        reVarAssign.test(src);
      if (writesViaInline || writesViaTable) {
        const r = rel(file);
        if (!WRITE_ALLOWLIST.has(r)) violators.push(r);
      }
    }
    expect(violators).toEqual([]);
  });

  it("no raw SQL INSERT/UPDATE against tool_providers names auth_key_encrypted", () => {
    const re =
      /(INSERT\s+INTO|UPDATE)\s+tool_providers\b[\s\S]{0,1000}?\bauth_key_encrypted\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
