import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.127 — drift guard: user_provider_keys write paths.
//
// user_provider_keys holds users' BYOK provider credentials
// (api_key_encrypted column today, hopefully Vault-encrypted post-Lane 4.36-impl).
// Two takeover surfaces if write paths drift:
//
//   1. user_id rebind — a future PR adds a write path that lets attacker A
//      rewrite a row's user_id to victim B, OR seeds an INSERT with
//      user_id from request-body instead of session — attacker A's pasted
//      key is now associated with victim B's account, then attacker A's
//      execution is billed to victim B (if it isn't already worse:
//      attacker A's calls draw on victim B's prefer_own_key path).
//
//   2. is_active / prefer_own_key flip on someone else's row — toggling
//      victim B's keys disabled forces fallback to gateway master-pool
//      (gateway eats the cost = self-mint), or toggling
//      prefer_own_key=false on victim's row to redirect billing.
//
// Today user_provider_keys writes happen only from:
//   src/app/api/v1/byok/route.ts
//     - POST  → upsert seeds user_id from getUserFromSession() (auth-bound)
//     - DELETE → soft-update is_active=false, scoped by .eq("user_id", userId)
//                .eq("tool_slug", tool_slug) (auth-bound + key-bound)
//
// This test enumerates every src/ file containing a write call site against
// user_provider_keys and asserts the set is exactly that one file. Sibling
// assertion: any UPDATE payload against user_provider_keys must NOT mutate
// user_id (allowing only is_active toggles and metadata; not row-rebinding).
//
// Source-file regex parser (NOT runtime import) — registry imports often pull
// in createClient() and crash without prod env (memory feedback rule #59).
// Sibling guards in the financial/auth-binding family: Lane 4.121 credit_balance,
// 4.122 plan_slug, 4.123 api_keys.user_id, 4.124 stripe_customer_id, 4.125
// auto_topup_*, 4.126 credit_transactions ledger.

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

// Files allowed to write user_provider_keys (insert / upsert / update / delete).
// Each entry must include a comment explaining the write-path semantics.
const USER_PROVIDER_KEYS_WRITE_ALLOWLIST = new Set<string>([
  "src/app/api/v1/byok/route.ts", // POST upsert seeds user_id from session; DELETE soft-update scoped by user_id+tool_slug
]);

describe("Lane 4.127 — user_provider_keys writes are allow-listed and user_id-immutable", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files contain a write call against user_provider_keys", () => {
    // Catches .from("user_provider_keys").(insert|upsert|update|delete)(...)
    const re = /\.from\(\s*["']user_provider_keys["']\s*\)[\s\S]{0,500}?\.(insert|upsert|update|delete)\(/;
    const violators: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      if (re.test(src)) {
        const rel = file.replace(SRC_ROOT, "src").replace(/\\/g, "/");
        if (!USER_PROVIDER_KEYS_WRITE_ALLOWLIST.has(rel)) {
          violators.push(rel);
        }
      }
    }
    expect(violators).toEqual([]);
  });

  it("no UPDATE payload against user_provider_keys mutates user_id", () => {
    // Catches .from("user_provider_keys").update({ ... user_id ... })
    // user_id rebinding via update is the row-takeover class — only upsert/insert
    // with session-derived user_id is permitted. Soft-delete updates today only
    // touch is_active + updated_at.
    const re = /\.from\(\s*["']user_provider_keys["']\s*\)[\s\S]{0,500}?\.update\(\s*\{[^}]*user_id/;
    const violators: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      if (re.test(src)) {
        violators.push(file.replace(SRC_ROOT, "src").replace(/\\/g, "/"));
      }
    }
    expect(violators).toEqual([]);
  });

  it("no raw SQL UPDATE/INSERT/DELETE against user_provider_keys in src/", () => {
    const re = /(UPDATE|DELETE\s+FROM|INSERT\s+INTO)\s+user_provider_keys\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      if (re.test(src)) {
        violators.push(file.replace(SRC_ROOT, "src").replace(/\\/g, "/"));
      }
    }
    expect(violators).toEqual([]);
  });

  it("allow-listed file seeds user_id from session, not request body", () => {
    // Sanity: byok/route.ts POST upserts user_id = userId (the value returned
    // by getUserFromSession). Drift = a future PR sets user_id from req.body.
    const allowListed = "src/app/api/v1/byok/route.ts";
    const fullPath = allowListed.replace("src/", `${SRC_ROOT.replace(/\\/g, "/")}/`).replace(/\//g, require("node:path").sep);
    const src = readFileSync(fullPath, "utf-8");

    // Must contain getUserFromSession() — the auth boundary
    expect(src).toMatch(/(getAccountActor|getUserFromSession)\s*\(/);
    // Must contain user_id: userId in the upsert (not user_id: body.user_id)
    expect(src).toMatch(/user_id:\s*userId\b/);
    // Must NOT contain user_id: body, user_id: req.body, etc.
    expect(src).not.toMatch(/user_id:\s*(body|req\.body|request\.body|requestBody)/);
  });
});
