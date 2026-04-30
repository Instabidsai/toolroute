import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.189 — drift guard: tool_providers.cost_unit
// SELECT-projection allow-list.
//
// `tool_providers.cost_unit` is the cost denomination label
// ("call", "1K_tokens", "MB", etc.) — the unit-of-measure for
// `cost_per_call` (Lane 4.186). Together with cost_model
// (Lane 4.187) it disambiguates how the provider charges:
// e.g., cost_per_call=0.002 + cost_model=per_token +
// cost_unit=1K_tokens means "$0.002 per 1000 tokens", whereas
// cost_unit=token means $0.002 per single token.
//
// Why guard alongside the cost columns:
//   - cost_unit alone discloses unit-of-measure conventions
//     (per-call vs per-token vs per-MB), and combined with
//     cost_per_call/cost_model fully resolves the wholesale
//     pricing formula.
//   - DIFFERENT 1-file allow-list than 4.186/4.187/4.188.
//     gateway.ts:331 reads `auth_key_encrypted, cost_per_call,
//     cost_model, markup_percent` — NOTABLY EXCLUDES cost_unit.
//     The gateway already settled on a fixed denomination per
//     adapter at integration time; cost_unit is admin-UI metadata
//     only.
//
// Today's read surface is exactly 1 file:
//
//   - src/app/api/admin/providers/route.ts (line ~174) —
//       Admin-gated GET (validateAdmin upstream). Returns the
//       full provider catalog. Other matches in this file
//       (lines ~54, ~94, ~125) are request-body parsing on the
//       WRITE side — projection guard is SELECT-side only.
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('tool_providers').select('… cost_unit …')` outside
//      the allow-list.
//   2. `.returns<{ cost_unit: … }>()` generic outside the
//      allow-list.
//   3. Raw SQL `SELECT … cost_unit … FROM tool_providers`
//      anywhere in src/.
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards (full tool_providers cost-disclosure family):
//   - Lane 4.144 (auth_key_encrypted — gateway.ts only)
//   - Lane 4.186 (cost_per_call — gateway.ts + admin/providers)
//   - Lane 4.187 (cost_model — gateway.ts + admin/providers)
//   - Lane 4.188 (markup_percent — gateway.ts + admin/providers)
//   - Lane 4.189 (cost_unit — admin/providers only) ← THIS LANE

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

// Files allowed to SELECT `cost_unit` from `tool_providers`.
// Each entry has a real reason — see lane comment above.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/app/api/admin/providers/route.ts",
]);

describe("Lane 4.189 — tool_providers.cost_unit SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT cost_unit from tool_providers", () => {
    const re =
      /\.from\(\s*["']tool_providers["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\bcost_unit\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare cost_unit in a tool_providers .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']tool_providers["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\bcost_unit\b/;
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

  it("no raw SQL SELECT cost_unit FROM tool_providers in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\bcost_unit\b[\s\S]*?\bFROM\s+tool_providers\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
