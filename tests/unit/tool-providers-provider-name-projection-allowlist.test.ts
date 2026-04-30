import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.193 — drift guard: tool_providers.provider_name
// SELECT-projection allow-list.
//
// `tool_providers.provider_name` is the human-readable name of
// the upstream provider for each tool_slug (e.g., "OpenAI",
// "DeepL", "RapidAPI - Pixabay"). It is the most direct vendor-
// catalog disclosure column on the table: aggregate it across
// rows and you have ToolRoute's full upstream-vendor map by
// human-readable name.
//
// Why guard provider_name:
//   - Per-row: discloses which named vendor backs each tool_slug.
//     This is the cleanest cross-reference for who-pays-whom in
//     the ToolRoute supply chain.
//   - Aggregate: full set of provider_name values is competitive
//     intel — reveals direct-vs-reseller posture (e.g.,
//     "RapidAPI - Pixabay" exposes resale; "OpenAI" exposes
//     direct integration), which is what Lane 6 (provider ToS
//     resale audit) is concerned with.
//   - Adapters in `src/lib/adapters/*.ts` are the actual upstream
//     callers and don't need provider_name from this row at
//     request time. This column is admin-UI metadata only.
//
// Today's read surface is exactly 1 file:
//
//   - src/app/api/admin/providers/route.ts (line ~173) —
//       Admin-gated GET (validateAdmin upstream). Sole reader.
//       Other matches in this file (lines ~47, ~88, ~118) are
//       request-body parsing on the WRITE side.
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('tool_providers').select('… provider_name …')`
//      outside the allow-list.
//   2. `.returns<{ provider_name: … }>()` generic outside the
//      allow-list.
//   3. Raw SQL `SELECT … provider_name … FROM tool_providers`
//      anywhere in src/.
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards on tool_providers:
//   - 4.144 (auth_key_encrypted)
//   - 4.186/4.187/4.188 (cost_per_call/cost_model/markup_percent)
//   - 4.189 (cost_unit)
//   - 4.190 (api_base_url)
//   - 4.191 (auth_type)
//   - 4.192 (auth_header_name)

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

// Files allowed to SELECT `provider_name` from `tool_providers`.
// Each entry has a real reason — see lane comment above.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/app/api/admin/providers/route.ts",
]);

describe("Lane 4.193 — tool_providers.provider_name SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT provider_name from tool_providers", () => {
    const re =
      /\.from\(\s*["']tool_providers["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\bprovider_name\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare provider_name in a tool_providers .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']tool_providers["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\bprovider_name\b/;
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

  it("no raw SQL SELECT provider_name FROM tool_providers in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\bprovider_name\b[\s\S]*?\bFROM\s+tool_providers\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
