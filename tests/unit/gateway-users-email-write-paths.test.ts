import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.128 — drift guard: gateway_users.email write paths.
//
// Email rebind is the account-takeover surface. If a future PR allows
// attacker A to rewrite victim B's gateway_users.email row to a@evil.com,
// then password reset / OAuth-link / magic-link flows redirect to attacker.
// Subtler variant: a future signup-or-callback drift inserts
// gateway_users.email != authData.user.email (the validated auth user),
// quietly de-syncing the row from the auth boundary.
//
// Today's write paths (audited Lane 4.128):
//
//   INSERT (3 files, each auth-bound):
//     1. src/lib/gateway.ts — getUserFromSession() lazy profile creation;
//        email sourced from `user.email` of the JWT-validated Supabase auth user.
//     2. src/app/auth/callback/route.ts — OAuth first-time profile;
//        email sourced from `user.email` after exchangeCodeForSession().
//     3. src/app/api/v1/signup/route.ts — password signup;
//        email is what was passed to sb.auth.admin.createUser() one block above,
//        so the gateway_users row exactly mirrors the auth row.
//
//   UPDATE (1 file):
//     1. src/app/auth/callback/route.ts — OAuth subsequent visits;
//        email payload is `email || existing.email` where `email = user.email`
//        (auth-validated), with fallback to row's existing value.
//
// This test enumerates every src/ file with an UPDATE/INSERT call site whose
// payload mentions `email` (literal `email:` or shorthand `email,`) against
// gateway_users and asserts the sets match. Each path's email value must be
// auth-derived, NEVER request-body-derived (modulo signup where the auth
// admin call validates the email first).
//
// Source-file regex parser (NOT runtime import) — registry imports often pull
// in createClient() and crash without prod env (memory feedback rule #59).
// Sibling guards: 4.121 credit_balance, 4.122 plan_slug, 4.123 api_keys.user_id,
// 4.124 stripe_customer_id, 4.125 auto_topup_*, 4.126 credit_transactions
// ledger, 4.127 user_provider_keys.

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

// Files allowed to UPDATE gateway_users.email. Today the only legitimate
// rebind path is the OAuth callback (re-syncs after the auth user's email
// changes upstream).
const EMAIL_UPDATE_ALLOWLIST = new Set<string>([
  "src/app/auth/callback/route.ts", // OAuth re-sync; payload = `email || existing.email`, sourced from auth user
]);

// Files allowed to INSERT a gateway_users row whose payload includes email.
// Each writes email derived from the validated Supabase auth user, never
// directly from request body (signup creates the auth user immediately
// upstream, so the literal-same `email` variable is post-validation).
const EMAIL_INSERT_ALLOWLIST = new Set<string>([
  "src/lib/gateway.ts", // getUserFromSession lazy create; email = JWT-validated user.email
  "src/app/auth/callback/route.ts", // OAuth first-time profile; email = exchangeCodeForSession user.email
  "src/app/api/v1/signup/route.ts", // password signup; email validated by sb.auth.admin.createUser one block above
]);

describe("Lane 4.128 — gateway_users.email writes are allow-listed", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files UPDATE gateway_users with an email payload", () => {
    // Catches `.from("gateway_users")...update({ ...email... })`.
    // Matches both `email:` and shorthand `email,` / `email\s*}`.
    const re = /\.from\(\s*["']gateway_users["']\s*\)[\s\S]{0,500}?\.update\(\s*\{[^}]*\bemail\s*[:,}]/;
    const violators: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      if (re.test(src)) {
        const rel = file.replace(SRC_ROOT, "src").replace(/\\/g, "/");
        if (!EMAIL_UPDATE_ALLOWLIST.has(rel)) {
          violators.push(rel);
        }
      }
    }
    expect(violators).toEqual([]);
  });

  it("only allow-listed files INSERT gateway_users with an email payload", () => {
    // Catches `.from("gateway_users")...insert({ ...email... })` plus shorthand.
    const re = /\.from\(\s*["']gateway_users["']\s*\)[\s\S]{0,500}?\.insert\(\s*\{[^}]*\bemail\s*[:,}]/;
    const violators: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      if (re.test(src)) {
        const rel = file.replace(SRC_ROOT, "src").replace(/\\/g, "/");
        if (!EMAIL_INSERT_ALLOWLIST.has(rel)) {
          violators.push(rel);
        }
      }
    }
    expect(violators).toEqual([]);
  });

  it("no UPSERT against gateway_users with an email payload anywhere in src/", () => {
    // gateway_users today is INSERT-or-UPDATE in two distinct code paths,
    // never .upsert(). Adding upsert with email payload would side-channel
    // around both file allow-lists above.
    const re = /\.from\(\s*["']gateway_users["']\s*\)[\s\S]{0,500}?\.upsert\(\s*\{[^}]*\bemail\s*[:,}]/;
    const violators: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      if (re.test(src)) {
        violators.push(file.replace(SRC_ROOT, "src").replace(/\\/g, "/"));
      }
    }
    expect(violators).toEqual([]);
  });

  it("no raw SQL UPDATE/INSERT against gateway_users with email column in src/", () => {
    const re = /(UPDATE\s+gateway_users\s+SET[^;]*\bemail\b\s*=)|(INSERT\s+INTO\s+gateway_users\s*\([^)]*\bemail\b)/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      if (re.test(src)) {
        violators.push(file.replace(SRC_ROOT, "src").replace(/\\/g, "/"));
      }
    }
    expect(violators).toEqual([]);
  });

  it("the lone UPDATE site sources email from auth user, not request body", () => {
    // auth/callback UPDATE must keep the `email || existing.email` shape
    // (where `email = user.email` from exchangeCodeForSession). Drift =
    // someone changes the payload to `email: body.email` or similar.
    const path = require("node:path");
    const fullPath = path.join(SRC_ROOT, "app", "auth", "callback", "route.ts");
    const src = readFileSync(fullPath, "utf-8");

    // Required: `email = user.email` (or .. ?? "") binding before the .update()
    expect(src).toMatch(/const\s+email\s*=\s*user\.email/);
    // Required: the update payload uses `email` or `email || existing.email`
    expect(src).toMatch(/\.update\(\s*\{[\s\S]{0,200}email[\s\S]{0,200}existing\.email/);
    // Forbidden: any payload of shape `email: body.X` / `email: req.body.X`
    expect(src).not.toMatch(/email:\s*(body|req\.body|request\.body|requestBody)/);
  });
});
