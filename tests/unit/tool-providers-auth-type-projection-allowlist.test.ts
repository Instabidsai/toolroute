import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.191 — drift guard: tool_providers.auth_type
// SELECT-projection allow-list.
//
// `tool_providers.auth_type` is the per-provider auth scheme label
// ("bearer", "api_key", "basic", "oauth", etc.) — describes HOW
// the upstream API expects credentials. Combined with
// `auth_header_name` (sibling, lane 4.192 next) it fully describes
// the auth-injection shape the gateway uses when calling upstream.
//
// Why guard auth_type:
//   - Per-row: discloses which auth mechanism a given upstream
//     uses ("api_key" vs "oauth" vs "bearer"). Combined with
//     api_base_url (lane 4.190) and auth_header_name, leaks the
//     full upstream auth contract per provider.
//   - This is reconnaissance metadata — anyone reading auth_type
//     across the table learns the auth-fingerprint of every
//     upstream ToolRoute integrates with, which feeds direct
//     credential-stuffing or replay attacks against those
//     upstreams (separate from ToolRoute's own credentials).
//   - Adapters in `src/lib/adapters/*.ts` hardcode their auth
//     mechanism at integration time. Runtime gateway does NOT
//     read auth_type from this row at request time.
//
// Today's read surface is exactly 1 file:
//
//   - src/app/api/admin/providers/route.ts (line ~173) —
//       Admin-gated GET (validateAdmin upstream). Sole reader.
//       Other matches in this file (lines ~50, ~90, ~120) are
//       request-body parsing on the WRITE side.
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('tool_providers').select('… auth_type …')` outside
//      the allow-list.
//   2. `.returns<{ auth_type: … }>()` generic outside the
//      allow-list.
//   3. Raw SQL `SELECT … auth_type … FROM tool_providers`
//      anywhere in src/.
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards on tool_providers:
//   - 4.144 (auth_key_encrypted)
//   - 4.186/4.187/4.188 (cost_per_call/cost_model/markup_percent)
//   - 4.189 (cost_unit — admin-only)
//   - 4.190 (api_base_url — admin-only)

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

// Files allowed to SELECT `auth_type` from `tool_providers`.
// Each entry has a real reason — see lane comment above.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/app/api/admin/providers/route.ts",
]);

describe("Lane 4.191 — tool_providers.auth_type SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT auth_type from tool_providers", () => {
    const re =
      /\.from\(\s*["']tool_providers["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\bauth_type\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare auth_type in a tool_providers .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']tool_providers["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\bauth_type\b/;
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

  it("no raw SQL SELECT auth_type FROM tool_providers in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\bauth_type\b[\s\S]*?\bFROM\s+tool_providers\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
