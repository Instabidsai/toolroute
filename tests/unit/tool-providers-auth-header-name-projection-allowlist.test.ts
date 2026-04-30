import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.192 — drift guard: tool_providers.auth_header_name
// SELECT-projection allow-list.
//
// `tool_providers.auth_header_name` is the per-provider auth
// header label ("Authorization", "X-API-Key", "x-rapidapi-key",
// etc.) — names WHICH HTTP header carries the credential when
// the gateway calls upstream. Combined with auth_type (Lane
// 4.191) it fully describes the auth-injection shape:
// "Bearer <token> in Authorization header" vs
// "raw key in X-API-Key header" vs the various provider-
// specific quirks.
//
// Why guard auth_header_name:
//   - Per-row: discloses the exact header name a given upstream
//     accepts. Combined with auth_type + api_base_url leaks the
//     full upstream auth contract per provider.
//   - Cross-provider analysis of header names is itself a
//     fingerprint: e.g., x-rapidapi-key implies RapidAPI
//     resale, X-API-Key implies direct, Authorization+Bearer
//     implies OAuth-style. Each combination reveals upstream
//     vendor relationship type.
//   - Adapters in `src/lib/adapters/*.ts` hardcode their auth
//     header at integration time. Runtime gateway does NOT read
//     auth_header_name from this row at request time.
//
// Today's read surface is exactly 1 file:
//
//   - src/app/api/admin/providers/route.ts (line ~173) —
//       Admin-gated GET (validateAdmin upstream). Sole reader.
//       Other matches in this file (lines ~51, ~91, ~122) are
//       request-body parsing on the WRITE side.
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('tool_providers').select('… auth_header_name …')`
//      outside the allow-list.
//   2. `.returns<{ auth_header_name: … }>()` generic outside
//      the allow-list.
//   3. Raw SQL `SELECT … auth_header_name … FROM tool_providers`
//      anywhere in src/.
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards on tool_providers (auth-disclosure family):
//   - 4.144 (auth_key_encrypted — gateway only)
//   - 4.190 (api_base_url — admin-only)
//   - 4.191 (auth_type — admin-only)
//   - 4.192 (auth_header_name — admin-only) ← THIS LANE

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

// Files allowed to SELECT `auth_header_name` from `tool_providers`.
// Each entry has a real reason — see lane comment above.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/app/api/admin/providers/route.ts",
]);

describe("Lane 4.192 — tool_providers.auth_header_name SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT auth_header_name from tool_providers", () => {
    const re =
      /\.from\(\s*["']tool_providers["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\bauth_header_name\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare auth_header_name in a tool_providers .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']tool_providers["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\bauth_header_name\b/;
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

  it("no raw SQL SELECT auth_header_name FROM tool_providers in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\bauth_header_name\b[\s\S]*?\bFROM\s+tool_providers\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
