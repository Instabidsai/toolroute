import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.123 — drift guard: api_keys.user_id is INSERT-only.
//
// Today's invariant: api_keys.user_id is set once at row creation and never
// updated. All session-authed mutation routes filter by `.eq("user_id", userId)`
// — that's the ownership boundary the entire keys API depends on. If a future
// PR adds something like:
//
//   await sb.from("api_keys").update({ user_id: targetUserId }).eq("id", keyId)
//
// (e.g. an "admin transfer key" tool, or a misguided "merge accounts" flow),
// an attacker that compromises an admin path can re-bind any victim's keys to
// themselves — instant takeover of every tr_live_ key the platform has issued.
//
// Sibling drift guards: Lane 4.121 (credit_balance RPC-only),
// Lane 4.122 (plan_slug allow-listed). Same column-write-allowlist family.
//
// Source-file regex parser only — registry imports pull createClient at top
// level and crash without prod env (memory feedback rule #59).

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

// Files allowed to INSERT into api_keys (must seed user_id at creation).
// Each entry must include a comment in the source explaining the surface.
const API_KEYS_INSERT_ALLOWLIST = new Set<string>([
  "src/app/api/v1/keys/route.ts", // session-authed key creation (POST /api/v1/keys)
  "src/app/api/v1/signup/route.ts", // initial "Default Test Key" seeded at signup
]);

describe("Lane 4.123 — api_keys.user_id is INSERT-only", () => {
  const files = walk(SRC_ROOT);

  it("no .from('api_keys').update({...user_id...}) chain anywhere in src/", () => {
    // Match `.from("api_keys")` followed (within ~500 chars of method chaining)
    // by `.update({ ... user_id ... })`. The 500-char window keeps the regex
    // bounded but still catches realistic Supabase builder chains.
    const re =
      /\.from\(\s*["']api_keys["']\s*\)[\s\S]{0,500}?\.update\(\s*\{[^}]*user_id/;
    const violators: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      if (re.test(src)) {
        violators.push(file.replace(SRC_ROOT, "src").replace(/\\/g, "/"));
      }
    }
    expect(violators).toEqual([]);
  });

  it("no raw SQL UPDATE api_keys ... SET ... user_id = ... in src/", () => {
    const re = /UPDATE\s+api_keys\b[\s\S]{0,200}?SET[^;]*user_id\s*=/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      if (re.test(src)) {
        violators.push(file.replace(SRC_ROOT, "src").replace(/\\/g, "/"));
      }
    }
    expect(violators).toEqual([]);
  });

  it("only allow-listed files INSERT into api_keys", () => {
    // Match `.from("api_keys").insert(` chains. Same 500-char chain window.
    const re =
      /\.from\(\s*["']api_keys["']\s*\)[\s\S]{0,500}?\.insert\(/;
    const violators: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      if (re.test(src)) {
        const rel = file.replace(SRC_ROOT, "src").replace(/\\/g, "/");
        if (!API_KEYS_INSERT_ALLOWLIST.has(rel)) {
          violators.push(rel);
        }
      }
    }
    expect(violators).toEqual([]);
  });

  it("allow-listed api_keys inserts seed user_id at creation", () => {
    const insertChain =
      /\.from\(\s*["']api_keys["']\s*\)[\s\S]{0,500}?\.insert\(/g;
    const missingUserId: string[] = [];

    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      const rel = file.replace(SRC_ROOT, "src").replace(/\\/g, "/");
      if (!API_KEYS_INSERT_ALLOWLIST.has(rel)) continue;

      for (const match of src.matchAll(insertChain)) {
        const chain = src.slice(match.index, match.index + 1000);
        if (!/\.insert\(\s*\{[\s\S]{0,500}?user_id\s*:/.test(chain)) {
          missingUserId.push(rel);
        }
      }
    }

    expect(missingUserId).toEqual([]);
  });
});
