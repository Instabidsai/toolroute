import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.190 — drift guard: tool_providers.api_base_url
// SELECT-projection allow-list.
//
// `tool_providers.api_base_url` is the upstream API endpoint URL
// ToolRoute hits when proxying a request through the master pool
// (e.g., `https://api.openai.com/v1`, `https://api.deepl.com/v2`).
// It is provider-fingerprinting metadata: per-row it discloses
// WHICH upstream provider ToolRoute integrates with for each
// tool_slug, and per-table aggregate it reveals ToolRoute's full
// upstream-vendor catalog.
//
// Why guard api_base_url:
//   - Per-row: confirms which provider backs a given tool_slug
//     (e.g., is "deepgram" routed through deepgram.com or some
//     reseller / proxy vendor?). That's a competitive-intel
//     signal — Margin compression depends on direct-vs-reseller
//     status of the upstream.
//   - Aggregate: the full set of api_base_url values is
//     ToolRoute's vendor footprint — a competitor scraping this
//     table learns the entire "who does ToolRoute pay" map.
//   - Adapters in `src/lib/adapters/*.ts` hardcode their base
//     URLs at integration time (e.g., DeepLAdapter has
//     `https://api.deepl.com/v2` in source). Today the runtime
//     gateway DOES NOT read api_base_url from this row at request
//     time — adapters drive the actual call. This column is
//     admin-UI metadata.
//
// Today's read surface is exactly 1 file:
//
//   - src/app/api/admin/providers/route.ts (line ~173) —
//       Admin-gated GET (validateAdmin upstream). Sole reader.
//       Other matches in this file (lines ~49, ~89, ~119) are
//       request-body parsing on the WRITE side.
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('tool_providers').select('… api_base_url …')`
//      outside the allow-list.
//   2. `.returns<{ api_base_url: … }>()` generic outside the
//      allow-list.
//   3. Raw SQL `SELECT … api_base_url … FROM tool_providers`
//      anywhere in src/.
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards on tool_providers:
//   - 4.144 (auth_key_encrypted)
//   - 4.186 (cost_per_call)
//   - 4.187 (cost_model)
//   - 4.188 (markup_percent)
//   - 4.189 (cost_unit — also 1-file admin-only)

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

// Files allowed to SELECT `api_base_url` from `tool_providers`.
// Each entry has a real reason — see lane comment above.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/app/api/admin/providers/route.ts",
]);

describe("Lane 4.190 — tool_providers.api_base_url SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT api_base_url from tool_providers", () => {
    const re =
      /\.from\(\s*["']tool_providers["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\bapi_base_url\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare api_base_url in a tool_providers .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']tool_providers["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\bapi_base_url\b/;
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

  it("no raw SQL SELECT api_base_url FROM tool_providers in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\bapi_base_url\b[\s\S]*?\bFROM\s+tool_providers\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
