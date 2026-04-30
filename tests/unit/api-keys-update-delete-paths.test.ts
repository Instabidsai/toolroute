import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.129 — drift guard: api_keys UPDATE/DELETE write paths.
//
// Lane 4.123 (PR #170) covered api_keys.user_id immutability (INSERT-only
// allow-list + no UPDATE rebinds user_id). This lane extends to the rest
// of the surface: which files may UPDATE, which columns may be UPDATEd,
// and the absence of DELETEs.
//
// Tampering surface if these drift:
//   1. is_active flip on someone else's key — un-revokes a previously-
//      compromised key, or revokes a victim's working key. Today both
//      UPDATE call sites in keys/route.ts scope by `.eq("user_id", userId)`.
//   2. last_used_at rewrite — audit-log poisoning (key shows "never used"
//      when it's actively in attacker's hands; or "used recently" to
//      hide a slumbering key). Today no .update() in src/ touches this
//      column — the bump is RPC-only.
//   3. Hard DELETE — silently removes the key + breaks billing audit
//      across credit_transactions / usage_events back-refs. Today
//      revocation is soft (is_active=false). Hard delete would break the
//      forensic chain.
//
// Today's UPDATE paths (audited Lane 4.129):
//   src/app/api/v1/keys/route.ts:186 — `.update({ is_active: false })` revoke
//   src/app/api/v1/keys/route.ts:276 — `.update({ name })` rename
// Both scoped by `.eq("user_id", userId)`. No raw SQL UPDATE/DELETE/UPSERT
// against api_keys anywhere in src/.
//
// Source-file regex parser (NOT runtime import) — registry imports often pull
// in createClient() and crash without prod env (memory feedback rule #59).
// Sibling guards: 4.121-4.128 (financial + account-takeover families),
// extends 4.123 api_keys.user_id INSERT-only guard.

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

// Files allowed to UPDATE api_keys (today: revoke is_active=false, rename name).
const API_KEYS_UPDATE_ALLOWLIST = new Set<string>([
  "src/app/api/v1/keys/route.ts", // DELETE handler revokes via is_active=false; PATCH handler renames via name
]);

describe("Lane 4.129 — api_keys UPDATE/DELETE write paths drift guard", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files UPDATE api_keys", () => {
    // Catches `.from("api_keys").update(...)`.
    const re = /\.from\(\s*["']api_keys["']\s*\)[\s\S]{0,500}?\.update\(/;
    const violators: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      if (re.test(src)) {
        const rel = file.replace(SRC_ROOT, "src").replace(/\\/g, "/");
        if (!API_KEYS_UPDATE_ALLOWLIST.has(rel)) {
          violators.push(rel);
        }
      }
    }
    expect(violators).toEqual([]);
  });

  it("no .from('api_keys').delete(...) anywhere in src/", () => {
    // Hard DELETE would lose the audit trail (credit_transactions /
    // usage_events back-references go dangling). Revocation is soft
    // via is_active=false.
    const re = /\.from\(\s*["']api_keys["']\s*\)[\s\S]{0,500}?\.delete\(/;
    const violators: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      if (re.test(src)) {
        violators.push(file.replace(SRC_ROOT, "src").replace(/\\/g, "/"));
      }
    }
    expect(violators).toEqual([]);
  });

  it("no .from('api_keys').upsert(...) anywhere in src/", () => {
    // Adding upsert would side-channel both Lane 4.123's INSERT allow-list
    // and this lane's UPDATE allow-list.
    const re = /\.from\(\s*["']api_keys["']\s*\)[\s\S]{0,500}?\.upsert\(/;
    const violators: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      if (re.test(src)) {
        violators.push(file.replace(SRC_ROOT, "src").replace(/\\/g, "/"));
      }
    }
    expect(violators).toEqual([]);
  });

  it("no UPDATE payload against api_keys mutates last_used_at", () => {
    // last_used_at is bumped via SECDEF RPC (under the application layer).
    // Drift = a future PR adds `.update({ last_used_at: ... })` directly,
    // enabling audit-log poisoning (rewrite to NULL, or arbitrary timestamp).
    const re = /\.from\(\s*["']api_keys["']\s*\)[\s\S]{0,500}?\.update\(\s*\{[^}]*last_used_at/;
    const violators: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      if (re.test(src)) {
        violators.push(file.replace(SRC_ROOT, "src").replace(/\\/g, "/"));
      }
    }
    expect(violators).toEqual([]);
  });

  it("no UPDATE payload against api_keys mutates key_hash or key_prefix", () => {
    // key_hash is the bcrypt-checked authentication material; key_prefix is
    // the public identifier prefix. Either changing means the key is
    // either replaced or impersonates another. Both are INSERT-only fields.
    const reHash = /\.from\(\s*["']api_keys["']\s*\)[\s\S]{0,500}?\.update\(\s*\{[^}]*key_hash/;
    const rePrefix = /\.from\(\s*["']api_keys["']\s*\)[\s\S]{0,500}?\.update\(\s*\{[^}]*key_prefix/;
    const violators: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      if (reHash.test(src) || rePrefix.test(src)) {
        violators.push(file.replace(SRC_ROOT, "src").replace(/\\/g, "/"));
      }
    }
    expect(violators).toEqual([]);
  });

  it("no raw SQL UPDATE/DELETE against api_keys in src/", () => {
    const re = /(UPDATE\s+api_keys\b|DELETE\s+FROM\s+api_keys\b)/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      if (re.test(src)) {
        violators.push(file.replace(SRC_ROOT, "src").replace(/\\/g, "/"));
      }
    }
    expect(violators).toEqual([]);
  });
});
