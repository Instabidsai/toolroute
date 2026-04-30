import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.143 — drift guard: api_keys.key_hash SELECT-projection allow-list.
//
// `key_hash` is the bcrypt/crypt hash of every issued tr_live_/tr_test_ key.
// It is the ONLY linkage between an API key string the user holds and the
// row in api_keys that owns request_count, plan, allowed_tools, is_active.
//
// Three reasons no application-layer code should ever READ key_hash:
//
//   1. Validation happens in PG. The validate_api_key RPC (Lane 4.131
//      allow-listed) takes the user-presented key, hashes it server-side,
//      and compares via crypt() — the hash never crosses the SQL boundary
//      back to TS. Any `.select("key_hash")` is a code smell for "I'm about
//      to compare in JS," which means timing-attack surface (rule #44) and
//      no SECURITY DEFINER chokepoint.
//
//   2. Hash material returning to TS gives an attacker who reaches a
//      log/error/JSON.stringify path the rainbow-tableable hash. Keys are
//      bcrypt(tr_live_<32-bytes-of-secret>) — strong today, but if the
//      hash function ever weakens or the cost factor is dialed down for
//      perf, leaked hashes become offline-crackable.
//
//   3. Lane 4.141 already blocks `.select("*")` on api_keys (the wide-net
//      column-overscope guard). This guard is the targeted column-name
//      version: catches `.select("id, key_hash, user_id, ...")` projections
//      that 4.141 misses because they aren't `*`.
//
// Today every TS callsite touching key_hash WRITES it (insert at signup or
// at /api/v1/keys POST), or passes it to the validate_api_key RPC as a
// parameter (gateway.ts:53 `p_key_hash: keyHash`). Zero callsites READ it
// via `.select()`. This guard freezes that surface — allow-list is empty.
//
// Source-file regex parser (NOT runtime import) — registry imports often
// pull in createClient() and crash without prod env (memory feedback #59).
// Sibling guards: Lane 4.123 (api_keys.user_id immutable), Lane 4.129
// (api_keys UPDATE/DELETE write-paths), Lane 4.141 (sensitive-table
// .select("*") guard with api_keys included), Lane 4.142 (gateway_usage_log
// mutation allow-list — same pass-today pattern).

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

// Strip /* … */ block comments and // line comments before regex.
// JSDoc/file headers may legitimately mention key_hash in prose; we only
// care about real code paths.
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1"); // line comments (avoid http://)
}

// Files allowed to project key_hash via .select(). Empty today.
// If a future feature legitimately needs the hash in TS (extremely unlikely
// — validation belongs in PG), add the path here AND extend the rationale
// in this header. Default answer is: write a SECURITY DEFINER PG RPC instead.
const KEY_HASH_PROJECTION_ALLOWLIST = new Set<string>([]);

describe("Lane 4.143 — api_keys.key_hash SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("no .from('api_keys').select(...) projection contains key_hash outside the (empty) allow-list", () => {
    // Match: .from("api_keys") ... .select("...key_hash...") within 500 chars
    const re =
      /\.from\(\s*["']api_keys["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\bkey_hash\b[^"'`]*["'`]/;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) {
        const rel = file.replace(SRC_ROOT, "src").replace(/\\/g, "/");
        if (!KEY_HASH_PROJECTION_ALLOWLIST.has(rel)) {
          violators.push(rel);
        }
      }
    }
    expect(violators).toEqual([]);
  });

  it("no .returns<{...key_hash...}>() generic on api_keys queries (TS-typed projection drift)", () => {
    // Catches: .from("api_keys")...returns<{ key_hash: string; ... }>()
    // Even if .select() projection is correct, a returns<T> with key_hash
    // signals intent to read it; lock that down too.
    const re =
      /\.from\(\s*["']api_keys["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\bkey_hash\b/;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) {
        const rel = file.replace(SRC_ROOT, "src").replace(/\\/g, "/");
        if (!KEY_HASH_PROJECTION_ALLOWLIST.has(rel)) {
          violators.push(rel);
        }
      }
    }
    expect(violators).toEqual([]);
  });

  it("no raw SQL SELECT key_hash FROM api_keys in src/", () => {
    // Catches: `SELECT id, key_hash FROM api_keys WHERE ...`
    // `SELECT key_hash, ...` and `SELECT *, key_hash` shapes.
    const re = /SELECT\s+[\s\S]*?\bkey_hash\b[\s\S]*?\bFROM\s+api_keys\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) {
        violators.push(file.replace(SRC_ROOT, "src").replace(/\\/g, "/"));
      }
    }
    expect(violators).toEqual([]);
  });
});
