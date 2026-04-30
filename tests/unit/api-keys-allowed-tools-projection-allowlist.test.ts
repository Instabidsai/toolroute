import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.168 — drift guard: api_keys.allowed_tools SELECT-projection
// allow-list.
//
// `api_keys.allowed_tools` is the per-key tool-scope allowlist:
// `string[] | null`, where `null` means "allow every tool" and a
// non-null array restricts the key to the listed slugs. The runtime
// authorization path resolves this via the `validate_api_key` RPC
// (Lane 4.131), which returns `allowed_tools` as part of the auth
// result (see gateway.ts:100, where it's mapped to
// `result.allowed_tools as string[] | null` on the RPC return shape).
// So every SELECT projection of `allowed_tools` here is purely
// user-facing display state — the dashboard renders the per-key
// scope chips on the keys list.
//
// Lane 4.123 already locks the WRITE side of `api_keys.user_id`
// (no post-create owner reassignment), Lane 4.129 locks UPDATE/DELETE
// shape (only owner-scoped + canonical mutation paths), Lane 4.143
// locks the projection of `key_hash`, Lane 4.166 locks `key_prefix`,
// Lane 4.167 locks `is_active`. This guard is the projection
// complement for `allowed_tools`: every SELECT projection that pulls
// the per-key scope crosses the SQL→TS boundary here.
//
// Today's read surface is exactly 1 file with 3 callsites, all
// owner-scoped:
//
//   - src/app/api/v1/keys/route.ts —
//       POST create response (.select("id, name, key_prefix,
//         allowed_tools, is_active, …"), line ~65)
//       GET list, .eq("user_id", userId) (.select("id, name,
//         key_prefix, allowed_tools, is_active, …"), line ~115)
//       PATCH rename response, .eq("user_id", userId)
//         (.select("id, name, key_prefix, allowed_tools,
//         is_active, …"), line ~279)
//
// gateway.ts at line 100 reads `allowed_tools` off the
// validate_api_key RPC RETURN shape (NOT a `.from("api_keys")
// .select()` projection), so it's correctly out of scope for
// this guard — runtime auth uses the RPC (Lane 4.131), not a
// SELECT.
//
// Why guard this column even though authorization runs through an
// RPC, not a SELECT:
//
//   - A new SELECT reader could be a place where stale-cached
//     `allowed_tools` causes the dashboard / admin tool / support UI
//     to mis-render scope chips on a key whose scope was just
//     changed — operational surprise + support churn even when
//     runtime correctly enforces the freshly-scoped allowlist.
//   - Cross-tenant aggregation of `allowed_tools` (e.g., "which
//     keys scope to gpt-4o?") fingerprints customer tool usage
//     patterns.
//   - Lane 4.129 covers the WRITE path of api_keys (scope mutations
//     go through canonical mutation only); this lane covers the
//     READ path of one of its columns.
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('api_keys').select('… allowed_tools …')` outside the
//      allow-list.
//   2. `.returns<{ allowed_tools: … }>()` generic outside the
//      allow-list (no callsite uses this today, but lock it down
//      anyway because TS-narrowing makes the leak invisible to
//      readers).
//   3. Raw SQL `SELECT … allowed_tools … FROM api_keys` anywhere
//      in src/.
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards:
//   - Lane 4.123 (api_keys.user_id immutable write-paths)
//   - Lane 4.129 (api_keys UPDATE/DELETE write-paths)
//   - Lane 4.131 (validate_api_key RPC layer)
//   - Lane 4.143 (api_keys.key_hash SELECT-projection)
//   - Lane 4.166 (api_keys.key_prefix SELECT-projection)
//   - Lane 4.167 (api_keys.is_active SELECT-projection)

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

// Files allowed to SELECT `allowed_tools` from `api_keys`.
// Exactly one read path: owner-scoped key management endpoints.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/app/api/v1/keys/route.ts",
]);

describe("Lane 4.168 — api_keys.allowed_tools SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT allowed_tools from api_keys", () => {
    const re =
      /\.from\(\s*["']api_keys["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\ballowed_tools\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare allowed_tools in an api_keys .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']api_keys["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\ballowed_tools\b/;
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

  it("no raw SQL SELECT allowed_tools FROM api_keys in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\ballowed_tools\b[\s\S]*?\bFROM\s+api_keys\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
