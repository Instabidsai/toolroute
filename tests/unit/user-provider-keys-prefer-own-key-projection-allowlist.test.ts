import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.200 — drift guard: user_provider_keys.prefer_own_key
// SELECT-projection allow-list.
//
// `user_provider_keys.prefer_own_key` is the per-row flag the
// gateway consults at routing time to decide whether to prefer
// the user's BYOK key over the master-pool key for a given
// tool_slug. Per-row it discloses each user's preference toggle;
// aggregate it discloses the BYOK-vs-master preference distribution
// across the tenant base.
//
// Why guard prefer_own_key:
//   - Per-row: combined with tool_slug (4.184) reveals which tools
//     a given tenant has explicitly opted out of master-pool
//     billing for — a competitive signal (tenant has their own
//     account at upstream X).
//   - Aggregate: BYOK-preference rate per provider is operational
//     intel ("90% of pro users prefer own key on Anthropic" =
//     master-pool revenue ceiling).
//   - Lane 4.145 already locks api_key_encrypted (the credential).
//     The preference flag is the routing-decision-disclosure
//     complement.
//
// Today's read surface is exactly 1 file:
//
//   - src/app/api/v1/byok/route.ts (lines ~38 and ~77) —
//       Session-authed BYOK CRUD. Line 38 is the POST upsert
//       response shape; line 77 is the GET list of caller's own
//       BYOK rows. Both filter by user_id (owner-scoped) so no
//       cross-tenant disclosure even within this file.
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('user_provider_keys').select('… prefer_own_key …')`
//      outside the allow-list.
//   2. `.returns<{ prefer_own_key: … }>()` generic outside the
//      allow-list.
//   3. Raw SQL `SELECT … prefer_own_key … FROM user_provider_keys`
//      anywhere in src/.
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards on user_provider_keys:
//   - 4.127 (write-paths drift guard)
//   - 4.145 (api_key_encrypted projection — the credential)
//   - 4.184 (tool_slug projection)
//   - 4.185 (is_active projection)
//   - 4.200 (prefer_own_key) ← THIS LANE

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

// Files allowed to SELECT `prefer_own_key` from `user_provider_keys`.
// Each entry has a real reason — see lane comment above.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/app/api/v1/byok/route.ts",
]);

describe("Lane 4.200 — user_provider_keys.prefer_own_key SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT prefer_own_key from user_provider_keys", () => {
    const re =
      /\.from\(\s*["']user_provider_keys["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\bprefer_own_key\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare prefer_own_key in a user_provider_keys .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']user_provider_keys["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\bprefer_own_key\b/;
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

  it("no raw SQL SELECT prefer_own_key FROM user_provider_keys in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\bprefer_own_key\b[\s\S]*?\bFROM\s+user_provider_keys\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
