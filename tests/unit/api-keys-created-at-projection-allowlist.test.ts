import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.211 — drift guard: api_keys.created_at SELECT-projection
// allow-list.
//
// `api_keys.created_at` is the issuance-timestamp axis on the
// session-authed API-key catalog. Pairing `created_at` with
// `key_prefix` (4.166) + `last_used_at` (4.170) + `expires_at`
// (4.169) reconstructs the full lifecycle of every key a tenant
// has ever minted — issuance cadence, dormant-key inventory,
// rotation hygiene drift.
//
// On its own, `created_at` is just a row timestamp. In combination
// with the api_keys column family already locked (4.166-4.170,
// 4.174, 4.206) it adds the *issuance time axis* required for any
// longitudinal key-lifecycle reconstruction. Lock it so the
// session-authed reader stays exactly where the keys page expects
// it.
//
// Today's read surface is exactly 1 file:
//
//   - src/app/api/v1/keys/route.ts — owner-scoped key catalog
//       endpoints:
//         * line ~65: POST /api/v1/keys (create) — re-reads
//             newly-inserted row to return canonical shape
//             `id, name, key_prefix, allowed_tools, is_active,
//             created_at, expires_at`.
//         * line ~115: GET /api/v1/keys list — returns
//             `id, name, key_prefix, allowed_tools, is_active,
//             last_used_at, created_at, expires_at` ordered
//             by `created_at desc`. Owner-scoped via session JWT.
//         * line ~279: PATCH (rename) return-shape — projects
//             same column set including `created_at` so the UI
//             can re-render without a follow-up GET.
//
// `src/lib/gateway.ts:75` USES `api_keys` but projects
// `expires_at` only (key-expiry check), NOT `created_at` — so
// it is NOT in scope (filter-vs-projection disambiguation, same
// as Lanes 4.199 / 4.206 / 4.208 / 4.210).
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('api_keys').select('… created_at …')` outside the
//      allow-list.
//   2. `.returns<{ created_at: … }>()` generic outside the
//      allow-list.
//   3. Raw SQL `SELECT … created_at … FROM api_keys` anywhere
//      in src/.
//
// REGEX PRECISION:
//
// `created_at` is a long-enough column name (10 chars, distinctive
// underscore) that the standard `[\s\S]{0,500}?` window doesn't
// over-match across intervening `.from(other_table).select(...)`
// calls — adjacent tables also project `created_at` but they're
// caught by their own table-specific guards (e.g., Lane 4.210 for
// credit_transactions). No need for the negative-lookahead barrier
// pattern here (unlike short-id columns 4.204-4.209).
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards on api_keys:
//   - 4.123 (user_id immutability — write-side)
//   - 4.129 (UPDATE/DELETE write-paths)
//   - 4.143 (key_hash projection)
//   - 4.166 (key_prefix projection)
//   - 4.167 (is_active projection)
//   - 4.168 (allowed_tools projection)
//   - 4.169 (expires_at projection)
//   - 4.170 (last_used_at projection)
//   - 4.173 (rate_limit_rpm/rpd empty projection)
//   - 4.174 (name projection)
//   - 4.183 (request_count empty projection)
//   - 4.202 (user_id empty projection)
//   - 4.206 (id projection)

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

// Files allowed to SELECT `created_at` from `api_keys`.
// Each entry has a real reason — see lane comment above.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/app/api/v1/keys/route.ts",
]);

describe("Lane 4.211 — api_keys.created_at SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT created_at from api_keys", () => {
    const re =
      /\.from\(\s*["']api_keys["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\bcreated_at\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare created_at in an api_keys .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']api_keys["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\bcreated_at\b/;
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

  it("no raw SQL SELECT created_at FROM api_keys in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\bcreated_at\b[\s\S]*?\bFROM\s+api_keys\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
