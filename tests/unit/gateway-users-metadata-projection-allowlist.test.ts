import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.151 — drift guard: gateway_users.metadata SELECT-projection
// allow-list.
//
// `gateway_users.metadata` is JSONB. Today it carries
// signup-source / starter-credit-seeded / OAuth-provider markers used
// by the auth/callback flow (Lane 4.66 audit). The shape is unbounded
// by the column type, so a SELECT projection of `metadata` exposes
// whatever the writer happened to put there — a future writer might
// stash debug bags, internal notes, plan-experiment ids, or other
// data that should not cross the SQL→TS boundary unintentionally.
//
// Lane 4.130 already locks the WRITE side (only auth/callback +
// signup may set `metadata` today). This is the complementary
// READ-side: every SELECT projection of `metadata` is a place that
// JSONB blob crosses to the application layer.
//
// Today's read-projection surface is exactly ONE file:
//
//   - src/app/auth/callback/route.ts — OAuth/password verify callback
//     reads `metadata, email` to inspect whether the user has already
//     been starter-credit-seeded before re-applying (line ~64).
//
// Any new SELECT projection of `metadata` from `gateway_users`
// outside this 1-file set is a new place arbitrary JSONB crosses the
// boundary — the diff reviewer must justify the new surface (and add
// it here).
//
// Three classes of violation handled:
//
//   1. `.from('gateway_users').select('… metadata …')` outside the
//      allow-list.
//   2. `.returns<{ metadata: … }>()` generic outside the allow-list
//      (no callsite uses this today, but lock it anyway).
//   3. Raw SQL `SELECT … metadata … FROM gateway_users` in src/.
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards:
//   - Lane 4.130 (gateway_users.metadata write-paths)
//   - Lane 4.147 (gateway_users.email projection)
//   - Lane 4.148 (gateway_users.stripe_customer_id projection)
//   - Lane 4.150 (credit_transactions.metadata projection — different
//     table, same JSONB-bag risk class)

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

// Files allowed to SELECT `metadata` from `gateway_users`.
// Single read site: auth/callback inspects the starter-credit-seeded
// marker before re-applying.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/app/auth/callback/route.ts",
]);

describe("Lane 4.151 — gateway_users.metadata SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT metadata from gateway_users", () => {
    const re =
      /\.from\(\s*["']gateway_users["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\bmetadata\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare metadata in a gateway_users .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']gateway_users["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\bmetadata\b/;
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

  it("no raw SQL SELECT metadata FROM gateway_users in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\bmetadata\b[\s\S]*?\bFROM\s+gateway_users\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
