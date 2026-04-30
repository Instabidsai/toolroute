import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.187 — drift guard: tool_providers.cost_model
// SELECT-projection allow-list.
//
// `tool_providers.cost_model` is the per-provider pricing-shape
// label ("per_call", "per_token", etc.) that tells the gateway
// HOW to interpret cost_per_call (Lane 4.186). It's structural
// metadata about ToolRoute's cost basis: combined with
// cost_per_call + markup_percent it fully describes the wholesale
// cost formula per provider.
//
// Why guard alongside cost_per_call:
//   - cost_per_call is meaningless without cost_model — together
//     they reveal whether ToolRoute pays per-call vs per-token vs
//     per-MB, which discloses upstream contract type and
//     operational assumptions.
//   - Same 2-file read surface as 4.186 (one shared SELECT in
//     gateway.ts; one shared SELECT in admin/providers GET).
//
// Today's read surface is exactly 2 files:
//
//   - src/lib/gateway.ts (line ~331) —
//       Server-side gateway lookup. Same SELECT as 4.186; reads
//       cost_model into `masterCostModel` (line ~341 consumer).
//
//   - src/app/api/admin/providers/route.ts (line ~174) —
//       Admin-gated GET (validateAdmin upstream). Other matches
//       in this file (lines ~53, ~93, ~124) are request-body
//       parsing on the WRITE side — projection guard is
//       SELECT-side only.
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('tool_providers').select('… cost_model …')` outside
//      the allow-list.
//   2. `.returns<{ cost_model: … }>()` generic outside the
//      allow-list.
//   3. Raw SQL `SELECT … cost_model … FROM tool_providers`
//      anywhere in src/.
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards:
//   - Lane 4.144 (tool_providers.auth_key_encrypted — gateway.ts only)
//   - Lane 4.186 (tool_providers.cost_per_call — same 2-file allow-list)

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

// Files allowed to SELECT `cost_model` from `tool_providers`.
// Each entry has a real reason — see lane comment above.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/lib/gateway.ts",
  "src/app/api/admin/providers/route.ts",
]);

describe("Lane 4.187 — tool_providers.cost_model SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT cost_model from tool_providers", () => {
    const re =
      /\.from\(\s*["']tool_providers["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\bcost_model\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare cost_model in a tool_providers .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']tool_providers["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\bcost_model\b/;
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

  it("no raw SQL SELECT cost_model FROM tool_providers in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\bcost_model\b[\s\S]*?\bFROM\s+tool_providers\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
