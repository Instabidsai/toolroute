import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.152 — drift guard: SUPABASE_SERVICE_ROLE_KEY env-var
// direct-read allow-list.
//
// `SUPABASE_SERVICE_ROLE_KEY` is the master credential — once read,
// the holder bypasses every RLS policy on every table and can call
// SECURITY DEFINER RPCs as superuser. Lane 4.132/4.135 already lock
// the supabaseAdmin() *callsite* surface, but those guards check who
// calls the helper, not who reads the env var. A new file that
// fetches `process.env.SUPABASE_SERVICE_ROLE_KEY` directly to build
// its own client (a parallel `createClient(URL, SERVICE_KEY)` factory,
// a one-off "I just need to escalate this single query" temptation)
// would slip past both 4.132 and 4.135 because the call doesn't go
// through the named helper.
//
// Today's env-var read surface is exactly TWO files:
//
//   - src/lib/supabase-server.ts — the canonical helper. Exports
//     `supabaseAdmin = createClient(url, service_key)` that the rest
//     of the app imports through Lane 4.132/4.135's allow-list.
//   - src/lib/gateway.ts — the gateway has its own `supabaseAdmin()`
//     factory function (line ~19-22) that reads the env var directly.
//     Historical duplication; consolidating into the single helper is
//     a separate refactor lane. Today's drift guard freezes today's
//     2-file surface.
//
// Any new file reading `SUPABASE_SERVICE_ROLE_KEY` directly is a new
// service-role-construction surface — and almost certainly a
// supabaseAdmin() callsite-allowlist bypass. The diff reviewer must
// justify and either add to the allow-list or reroute through the
// canonical helper.
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards:
//   - Lane 4.132 (supabaseAdmin() callsite hygiene — read-only audit)
//   - Lane 4.135 (supabaseAdmin() callsite allow-list, src/app/**)
//   - Lane 4.26 (service-role JWT bundle exposure audit — historical)
//   - Lane 4.42 (NEXT_PUBLIC_* envvar discipline drift guard)

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

// Files allowed to read `SUPABASE_SERVICE_ROLE_KEY` from process.env.
// Each entry has a real reason — see lane comment above.
const ENV_READ_ALLOWLIST = new Set<string>([
  "src/lib/supabase-server.ts",
  "src/lib/gateway.ts",
]);

describe("Lane 4.152 — SUPABASE_SERVICE_ROLE_KEY env-var direct-read allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files read process.env.SUPABASE_SERVICE_ROLE_KEY", () => {
    // Match `process.env.SUPABASE_SERVICE_ROLE_KEY` (dot access) and
    // `process.env["SUPABASE_SERVICE_ROLE_KEY"]` (bracket access).
    const re =
      /process\.env\s*(?:\.\s*SUPABASE_SERVICE_ROLE_KEY\b|\[\s*["']SUPABASE_SERVICE_ROLE_KEY["']\s*\])/;
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

  it("no destructured `const { SUPABASE_SERVICE_ROLE_KEY } = process.env` outside allow-list", () => {
    // Destructuring assignment leaks the same value but evades dot/bracket
    // access regex. Match `{ SUPABASE_SERVICE_ROLE_KEY` ... `} = process.env`.
    const re =
      /\{\s*[^}]*\bSUPABASE_SERVICE_ROLE_KEY\b[^}]*\}\s*=\s*process\.env/;
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
