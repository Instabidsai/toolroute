import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.132 — drift guard: supabaseAdmin() callsite locality.
//
// supabaseAdmin() returns a service-role-keyed Supabase client. Service-role
// BYPASSES RLS — every table is readable + writable, gateway_users inclusive
// of Stripe customer IDs, api_keys with their hashes, credit_transactions
// ledger, the lot. So every callsite is a security-load-bearing line.
//
// Lane 4.33 + 4.116 (route-auth-coverage) already gate `src/app/**/route.ts`:
// every route file MUST declare its auth class (api_key/session/admin/dual/
// stripe_webhook/public). That covers the 22 route-level callsites.
//
// What Lane 4.33 DOESN'T cover: `src/lib/*` helpers that import
// supabaseAdmin. A new `src/lib/some-billing-helper.ts` with a
// supabaseAdmin() call inside an exported function could be imported by
// ANY route — including a route classified "public" by Lane 4.33 — and
// transitively grant that route service-role bypass. The route-auth test
// reads only the route file's source; it can't follow imports.
//
// This lane closes that gap: in `src/lib/`, supabaseAdmin() may ONLY be
// called from `gateway.ts`, where the function is defined and used by
// `validateRequest` / `checkRateLimit` / `executeToolRequest` /
// `getKeyInfo` / `getUserFromSession` (all auth-bound by construction).
// Any new lib file calling supabaseAdmin trips this guard, forcing the
// reviewer to either (a) move the helper into a route file (gated by
// Lane 4.33) or (b) explicitly add it to this allow-list with a
// documented auth invariant.
//
// Today's lib-layer supabaseAdmin() callers (audited Lane 4.132):
//   src/lib/gateway.ts:16   — `export function supabaseAdmin()` (definer)
//   src/lib/gateway.ts:45,100,174,276,330,379,466,556 — 9 internal use sites
//
// Source-file regex parser (NOT runtime import) — registry imports often
// pull in createClient() and crash without prod env (memory rule #59).
//
// Sibling guards: Lane 4.33 + 4.116 (route auth coverage), Lane 4.131
// (RPC callsite allow-list). Together: every service-role-using surface
// in src/ is either route-classified (Lane 4.33) or lib-layer-allow-listed
// (Lane 4.132).

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

// Strip JS block comments and line comments. Imperfect for `//` inside
// strings/templates, but good enough — this test only flags structural
// drift, and any inline `//` inside a string here is itself a code smell.
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

// Files in src/lib/ allowed to call supabaseAdmin().
// gateway.ts is the only legitimate site — it both defines the helper and
// uses it for auth-bound internals (validateRequest, checkRateLimit,
// executeToolRequest, getKeyInfo, getUserFromSession). Any new lib file
// calling supabaseAdmin would be a new transitive service-role surface
// that Lane 4.33 (which scans route files only) cannot see.
const LIB_SUPABASE_ADMIN_ALLOWLIST = new Set<string>([
  "src/lib/gateway.ts",
]);

describe("Lane 4.132 — supabaseAdmin() callsite drift guard", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed src/lib files call supabaseAdmin()", () => {
    // Match `supabaseAdmin()` call expressions. Doesn't match imports
    // (`import { supabaseAdmin }`) or type references.
    const re = /\bsupabaseAdmin\s*\(\s*\)/;
    const violators: string[] = [];
    for (const file of files) {
      const rel = file.replace(SRC_ROOT, "src").replace(/\\/g, "/");
      // Only enforce on src/lib/. src/app/**/route.ts callsites are
      // gated by Lane 4.33 (route-auth-coverage).
      if (!rel.startsWith("src/lib/")) continue;
      const src = readFileSync(file, "utf-8");
      if (re.test(stripComments(src))) {
        if (!LIB_SUPABASE_ADMIN_ALLOWLIST.has(rel)) {
          violators.push(rel);
        }
      }
    }
    expect(violators).toEqual([]);
  });

  it("no createClient() with service-role key outside gateway.ts", () => {
    // Defense-in-depth: someone could side-channel by calling
    // `createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY)` directly
    // instead of going through the supabaseAdmin() helper. Catch that too
    // (anywhere in src/, not just lib/).
    const re = /createClient\([^)]*SUPABASE_SERVICE_ROLE_KEY/;
    const violators: string[] = [];
    for (const file of files) {
      const rel = file.replace(SRC_ROOT, "src").replace(/\\/g, "/");
      if (rel === "src/lib/gateway.ts") continue; // canonical home
      const src = readFileSync(file, "utf-8");
      if (re.test(stripComments(src))) {
        violators.push(rel);
      }
    }
    expect(violators).toEqual([]);
  });

  it("no hardcoded service-role JWT in src/", () => {
    // Lane 4.26 service-role JWT bundle exposure audit + memory rule #54
    // (hardcoded-JWT recurring class). A future PR could ship a
    // `const SUPABASE_SR = "eyJ..."` shortcut at file top to avoid the
    // env-var ceremony — same drift class as Lane 4.32 + memory rule #54.
    // Caught here too because hardcoded JWT === service-role bypass.
    //
    // Match a bare `eyJ` JWT followed by any non-whitespace, length >40
    // (real JWTs are long). False-positive risk: docs/markdown — but we
    // already exclude .md and walk only .ts/.tsx.
    const re = /["']eyJ[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{20,}["']/;
    const violators: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      if (re.test(stripComments(src))) {
        violators.push(file.replace(SRC_ROOT, "src").replace(/\\/g, "/"));
      }
    }
    expect(violators).toEqual([]);
  });
});
