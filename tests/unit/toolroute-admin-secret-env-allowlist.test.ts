import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.155 — drift guard: TOOLROUTE_ADMIN_SECRET env-var
// direct-read allow-list.
//
// `TOOLROUTE_ADMIN_SECRET` is the shared-secret that gates every
// route under `src/app/api/admin/*`. The canonical comparator is
// `validateAdmin(request)` in `src/lib/admin-auth.ts`, which reads
// the env var, length-checks, and calls `crypto.timingSafeEqual`
// against the `x-admin-secret` request header. Lane 4.134 already
// guards the *callsite* surface (every admin/* route must call
// validateAdmin first). This guard locks the *env-var read*
// surface — the missing layer.
//
// If a new file reads `TOOLROUTE_ADMIN_SECRET` directly, two things
// can go wrong:
//   1. Re-implements the compare without timingSafeEqual → side-
//      channel timing attack against the secret.
//   2. Logs / returns / hashes the value as part of "debug" output →
//      secret leaks to caller, then any caller becomes admin.
//
// Today's env-var read surface is exactly ONE file:
//
//   - src/lib/admin-auth.ts — the canonical helper. Exports
//     `validateAdmin()` that performs the timing-safe compare.
//
// Any new file reading `TOOLROUTE_ADMIN_SECRET` directly is a new
// admin-secret exposure surface AND almost certainly a Lane 4.134
// validateAdmin() bypass. The diff reviewer must justify and either
// add to the allow-list (with a real reason) or reroute through
// `validateAdmin()`.
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards:
//   - Lane 4.152 (SUPABASE_SERVICE_ROLE_KEY env-var allow-list)
//   - Lane 4.153 (STRIPE_SECRET_KEY env-var allow-list)
//   - Lane 4.154 (STRIPE_WEBHOOK_SECRET env-var allow-list)
//   - Lane 4.134 (admin/* validateAdmin() callsite coverage)
//   - Lane 4.11 (extract validateAdmin to single source of truth)
//   - Lane 4.28 (admin endpoint auth coverage audit)

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
// matching so JSDoc references to the env var don't trigger false
// positives (memory rule from prior drift-guard work).
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function rel(file: string): string {
  return file.replace(SRC_ROOT, "src").replace(/\\/g, "/");
}

// Files allowed to read `TOOLROUTE_ADMIN_SECRET` from process.env.
// Each entry has a real reason — see lane comment above.
const ENV_READ_ALLOWLIST = new Set<string>([
  "src/lib/admin-auth.ts",
]);

describe("Lane 4.155 — TOOLROUTE_ADMIN_SECRET env-var direct-read allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files read process.env.TOOLROUTE_ADMIN_SECRET", () => {
    // Match `process.env.TOOLROUTE_ADMIN_SECRET` (dot access) and
    // `process.env["TOOLROUTE_ADMIN_SECRET"]` (bracket access).
    const re =
      /process\.env\s*(?:\.\s*TOOLROUTE_ADMIN_SECRET\b|\[\s*["']TOOLROUTE_ADMIN_SECRET["']\s*\])/;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) {
        const r = rel(file);
        if (!ENV_READ_ALLOWLIST.has(r)) violators.push(r);
      }
    }
    expect(violators).toEqual([]);
  });

  it("no destructured `const { TOOLROUTE_ADMIN_SECRET } = process.env` outside allow-list", () => {
    // Destructuring assignment leaks the same value but evades dot/bracket
    // access regex. Match `{ TOOLROUTE_ADMIN_SECRET` ... `} = process.env`.
    const re =
      /\{\s*[^}]*\bTOOLROUTE_ADMIN_SECRET\b[^}]*\}\s*=\s*process\.env/;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) {
        const r = rel(file);
        if (!ENV_READ_ALLOWLIST.has(r)) violators.push(r);
      }
    }
    expect(violators).toEqual([]);
  });
});
