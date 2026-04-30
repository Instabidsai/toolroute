import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.174 — drift guard: api_keys.name SELECT-projection allow-list.
//
// `api_keys.name` is the user-supplied human label for each API key
// ("Production key", "Staging webhook", "John's laptop", etc.). It's
// not a credential (the secret lives in `key_hash`, gated by Lane 4.143),
// but it's user-controlled string content that can embed identifying
// information — customer naming conventions, project names, internal
// codenames, occasionally PII (a person's name, an email).
//
// Today's read surface is exactly 1 file:
//
//   - src/app/api/v1/keys/route.ts —
//       Owner-scoped key CRUD endpoint. Three projection sites:
//         POST  : .select("id, name, key_prefix, allowed_tools, is_active,
//                          created_at, expires_at")  (line ~65, create response)
//         GET   : .select("id, name, key_prefix, allowed_tools, is_active,
//                          last_used_at, created_at, expires_at")
//                 .eq("user_id", userId)             (line ~115, list response)
//         PATCH : .select("id, name, key_prefix, allowed_tools, is_active,
//                          last_used_at, created_at, expires_at")
//                 .eq("id", keyId).eq("user_id", userId)  (line ~279, rename response)
//
// All three are owner-scoped (`.eq("user_id", userId)` or implicit via
// the row just inserted). No `name` callsite exists anywhere else in
// src/.
//
// Why guard this column even though it's not a credential:
//
//   - User-supplied strings can carry PII or product context. A new
//     SELECT reader without `.eq("user_id", auth.uid())` would expose
//     other tenants' key names — disclosing internal naming patterns,
//     project codenames, or PII.
//   - `name` is the one column on `api_keys` that's free-form
//     user-controlled; its content surface is unbounded.
//   - The 1-file projection surface (the canonical CRUD endpoint)
//     is the natural lock — every other api_keys reader uses
//     `.select("id")` for idempotency probes (see lines ~172, ~262)
//     or RPC return shapes via validate_api_key (Lane 4.131-locked
//     to gateway.ts).
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('api_keys').select('… name …')` outside the allow-list.
//   2. `.returns<{ name: … }>()` generic outside the allow-list (no
//      callsite uses this today, but lock it down anyway because
//      TS-narrowing makes the leak invisible to readers).
//   3. Raw SQL `SELECT … name … FROM api_keys` anywhere in src/.
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards:
//   - Lane 4.143 (api_keys.key_hash projection — credential)
//   - Lane 4.166 (api_keys.key_prefix projection)
//   - Lane 4.167 (api_keys.is_active projection)
//   - Lane 4.168 (api_keys.allowed_tools projection)
//   - Lane 4.169 (api_keys.expires_at projection)
//   - Lane 4.170 (api_keys.last_used_at projection)
//   - Lane 4.173 (api_keys.rate_limit_rpm/rpd empty allow-list)

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

// Files allowed to SELECT `name` from `api_keys`.
// Exactly one read path: owner-scoped key CRUD endpoint.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/app/api/v1/keys/route.ts",
]);

describe("Lane 4.174 — api_keys.name SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT name from api_keys", () => {
    const re =
      /\.from\(\s*["']api_keys["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\bname\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare name in an api_keys .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']api_keys["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\bname\b/;
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

  it("no raw SQL SELECT name FROM api_keys in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\bname\b[\s\S]*?\bFROM\s+api_keys\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
