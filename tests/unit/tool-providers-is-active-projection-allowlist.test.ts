import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.198 — drift guard: tool_providers.is_active
// SELECT-projection allow-list.
//
// `tool_providers.is_active` is the per-row enable/disable boolean
// for each upstream-provider catalog entry — closes out the
// tool_providers projection family (15 columns). Per-row it
// discloses which tool_slugs ToolRoute currently routes via the
// master pool vs which are disabled.
//
// Why guard is_active:
//   - Per-row disclosure: which providers are LIVE in the master
//     pool right now. Combined with provider_name (4.193) +
//     api_base_url (4.190), reveals the exact live-vendor set
//     a competitor would need to match.
//   - Aggregate: the active-vs-disabled split is operational
//     intel — "ToolRoute disabled X provider" is a competitive
//     signal (cost/ToS/quality issue at upstream).
//   - This is the THIRD `is_active` lockdown in the family,
//     each on a different table — see "Sibling-table
//     disambiguation" below.
//
// Today's read surface is exactly 1 file:
//
//   - src/app/api/admin/providers/route.ts (line ~174) —
//       Admin-gated GET (validateAdmin upstream). Sole reader.
//
// Sibling-table disambiguation (CRITICAL — same column name
// appears on 3 tables, each with its own lockdown lane):
//
//   - api_keys.is_active        → Lane 4.167 (different table)
//   - user_provider_keys.is_active → Lane 4.185 (different table)
//   - tool_providers.is_active  → Lane 4.198 (THIS LANE)
//
// Filter-vs-projection disambiguation:
//
//   - gateway.ts:329-334 chains `.eq("is_active", true)` as a
//     ROW FILTER on the master-key SELECT (the SELECT itself
//     reads `auth_key_encrypted, cost_per_call, cost_model,
//     markup_percent` — does NOT include is_active).
//   - gateway.ts:368-371 same pattern, filtering the
//     `auth_key_encrypted` SELECT.
//   - The regex correctly distinguishes: it only matches
//     `is_active` INSIDE the quoted `.select(...)` argument
//     that's preceded by `.from("tool_providers")`. `.eq()`
//     filters chain AFTER `.select()` and don't trigger.
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('tool_providers').select('… is_active …')` outside
//      the allow-list.
//   2. `.returns<{ is_active: … }>()` generic outside the
//      allow-list.
//   3. Raw SQL `SELECT … is_active … FROM tool_providers`
//      anywhere in src/.
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards on tool_providers (15-column projection family
// now COMPLETE):
//   - 4.144 (auth_key_encrypted)
//   - 4.186-4.188 (cost cols)
//   - 4.189-4.193 (admin metadata)
//   - 4.194-4.197 (operational fingerprint)
//   - 4.198 (is_active) ← THIS LANE

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

// Files allowed to SELECT `is_active` from `tool_providers`.
// Each entry has a real reason — see lane comment above.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/app/api/admin/providers/route.ts",
]);

describe("Lane 4.198 — tool_providers.is_active SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT is_active from tool_providers", () => {
    const re =
      /\.from\(\s*["']tool_providers["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\bis_active\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare is_active in a tool_providers .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']tool_providers["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\bis_active\b/;
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

  it("no raw SQL SELECT is_active FROM tool_providers in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\bis_active\b[\s\S]*?\bFROM\s+tool_providers\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
