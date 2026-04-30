import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.135 — drift guard: supabaseAdmin() callsites in src/app/** are
// allow-listed.
//
// Lane 4.132 closed the lib-layer surface (src/lib/* may only call
// supabaseAdmin() from gateway.ts). Its rationale comment said
// "src/app/**/route.ts callsites are gated by Lane 4.33 (route-auth-
// coverage)." That's TRUE for the route-classification gate (every new
// route file must appear in the route map with a declared auth class),
// but it leaves three drift classes uncaught:
//
//   1. NEW src/app/**/page.tsx or layout.tsx that calls supabaseAdmin().
//      Lane 4.33's walker only reads route.ts files. A Server Component
//      page that calls supabaseAdmin() to read a sensitive table is
//      memory rule #58's exact failure mode — but for service-role
//      reads, where the row would otherwise be RLS-locked. A future PR
//      adding `src/app/dashboard/admin-leaderboard/page.tsx` with a
//      service-role read of gateway_users.email + plan_slug across all
//      users sails past Lane 4.33.
//
//   2. NEW src/app/api/<x>/<helper>.ts (a non-route util file imported by
//      a route). Lane 4.33 walks route.ts only; Lane 4.132 walks
//      src/lib/. A util colocated under src/app/api/ falls into neither
//      net.
//
//   3. EXISTING route file that previously didn't call supabaseAdmin()
//      adds a call. Lane 4.33 doesn't re-check imports (only the auth-
//      class banner). The new transitive surface is invisible.
//
// This lane locks down the SET of src/app/** files that may call
// supabaseAdmin(). Any new file calling it trips the test — reviewer
// must (a) confirm the auth class is correct via Lane 4.33's map AND
// (b) explicitly add to this allow-list with a rationale comment.
//
// Today's src/app/ supabaseAdmin() callers (audited Lane 4.135 —
// audit date 2026-04-29):
//   - api/admin/providers/route.ts          (admin)
//   - api/admin/stats/route.ts              (admin)
//   - api/v1/keys/route.ts                  (session)
//   - api/v1/byok/route.ts                  (session)
//   - api/v1/settings/route.ts              (session)
//   - api/v1/usage/route.ts                 (dual)
//   - api/v1/billing/setup-payment/route.ts (session)
//   - api/v1/registry/usage/route.ts        (api_key)
//   - api/v1/registry/challenge/route.ts    (api_key)
//   - api/v1/registry/request/route.ts      (api_key)
//   - api/v1/tools/route.ts                 (public — catalog read only)
//   - api/v1/signup/route.ts                (public — inserts new user row)
//   - api/webhooks/stripe/route.ts          (stripe_webhook)
//   - auth/callback/route.ts                (oauth — server-managed
//                                            session creation)
//
// The two "public" classifications (tools, signup) are legitimate:
//   - tools: reads the public tool catalog. No PII surface.
//   - signup: inserts a gateway_users row for the new account. The
//     account is the caller's own; service-role is needed to bypass
//     RLS for the initial INSERT before a session exists.
//
// Source-file regex parser (NOT runtime import) — registry imports
// often pull createClient() and crash without prod env (memory rule
// #59). stripComments() pass before regex check so the JSDoc reference
// in src/lib/admin-auth.ts:13 ("touching supabaseAdmin().") doesn't
// false-positive (this same false-positive class hit Lane 4.132 on
// first run — see memory rule #59 hygiene tactical section).
//
// Sibling guards:
//   - Lane 4.33 + 4.116: route auth class declaration
//   - Lane 4.132: lib-layer supabaseAdmin allow-list
//   - Lane 4.131: gateway RPC EXECUTE allow-list
//   - Lane 4.134: admin/* validateAdmin() coverage

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

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

const APP_SUPABASE_ADMIN_ALLOWLIST = new Set<string>([
  "src/app/api/admin/providers/route.ts",
  "src/app/api/admin/stats/route.ts",
  "src/app/api/v1/keys/route.ts",
  "src/app/api/v1/byok/route.ts",
  "src/app/api/v1/settings/route.ts",
  "src/app/api/v1/usage/route.ts",
  "src/app/api/v1/billing/setup-payment/route.ts",
  "src/app/api/v1/registry/usage/route.ts",
  "src/app/api/v1/registry/challenge/route.ts",
  "src/app/api/v1/registry/request/route.ts",
  "src/app/api/v1/tools/route.ts",
  "src/app/api/v1/signup/route.ts",
  "src/app/api/webhooks/stripe/route.ts",
  "src/app/auth/callback/route.ts",
]);

describe("Lane 4.135 — supabaseAdmin() callsite drift guard for src/app/**", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed src/app/ files call supabaseAdmin()", () => {
    const re = /\bsupabaseAdmin\s*\(\s*\)/;
    const violators: string[] = [];
    for (const file of files) {
      const rel = file.replace(SRC_ROOT, "src").replace(/\\/g, "/");
      if (!rel.startsWith("src/app/")) continue;
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src) && !APP_SUPABASE_ADMIN_ALLOWLIST.has(rel)) {
        violators.push(rel);
      }
    }
    expect(violators).toEqual([]);
  });

  it("every allow-listed file actually calls supabaseAdmin() (no stale entries)", () => {
    // Defense against allow-list rot. If a file is removed from the
    // codebase or refactored to no longer use supabaseAdmin(), the
    // allow-list entry must be removed too. Otherwise a future file
    // with the same path would silently inherit the allow-list grant.
    const re = /\bsupabaseAdmin\s*\(\s*\)/;
    const stale: string[] = [];
    for (const allowed of APP_SUPABASE_ADMIN_ALLOWLIST) {
      const full = resolve(SRC_ROOT, allowed.replace(/^src\//, "").replace(/\//g, "/"));
      let src: string;
      try {
        src = readFileSync(full, "utf-8");
      } catch {
        stale.push(`${allowed} (file does not exist)`);
        continue;
      }
      if (!re.test(stripComments(src))) {
        stale.push(`${allowed} (no supabaseAdmin() call)`);
      }
    }
    expect(stale).toEqual([]);
  });

  it("non-route src/app/ files (.tsx, helpers) do not call supabaseAdmin()", () => {
    // Targeted defense for memory rule #58 (anon-client-in-server-
    // components) class but for SERVICE-ROLE: a Server Component
    // page.tsx or layout.tsx calling supabaseAdmin() bypasses RLS
    // on EVERY render. Auth context is whoever loads the page.
    // High blast radius if it lands.
    const re = /\bsupabaseAdmin\s*\(\s*\)/;
    const violators: string[] = [];
    for (const file of files) {
      const rel = file.replace(SRC_ROOT, "src").replace(/\\/g, "/");
      if (!rel.startsWith("src/app/")) continue;
      // Routes are covered by the first assertion; this assertion
      // narrows to NON-route src/app/ files (page.tsx, layout.tsx,
      // helpers under api/<x>/<helper>.ts that aren't route.ts).
      if (rel.endsWith("/route.ts")) continue;
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) {
        violators.push(rel);
      }
    }
    expect(violators).toEqual([]);
  });
});
