import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.130 — drift guard: gateway_users.metadata write paths.
//
// metadata is a jsonb grab-bag column that today carries:
//   - accepted_tos_at, signup_source       (set on password signup)
//   - email_verified, email_verified_at    (set on auth/callback after OAuth/magic link)
// Future PRs are likely to add more keys (preferences, notifications, etc).
//
// The drift surface this lane closes:
//
//   1. WHOLESALE CLOBBER on UPDATE — `update({ metadata: { only_x: y } })`
//      would erase email_verified, accepted_tos_at, and any future keys. The
//      ONE existing UPDATE site that touches metadata (auth/callback) does
//      the right thing: spread `existing.metadata` first, then overlay the
//      new keys. That merge pattern must hold across drift — a future direct
//      `update({ metadata })` without the spread is silent data loss.
//
//   2. NEW FILE writes metadata — INSERT and UPDATE allow-lists prevent a
//      future PR from adding a side-channel write site that bypasses the
//      merge invariant.
//
//   3. RAW SQL touching metadata — same drift class, different verb.
//
//   4. UPSERT — would side-channel both INSERT and UPDATE allow-lists.
//
// Today's writes touching the metadata payload (audited Lane 4.130):
//   src/app/api/v1/signup/route.ts:168    INSERT { ..., metadata: { accepted_tos_at, signup_source } }
//   src/app/auth/callback/route.ts:94     INSERT { ..., metadata: { ...existing?.metadata, email_verified, email_verified_at } }
//   src/app/auth/callback/route.ts:78     UPDATE { email, metadata, updated_at }  // metadata pre-built via spread
//
// gateway.ts:576 lazy auto-provision INSERT does NOT include metadata. That's
// the side path (rare race-window only — primary signup paths are signup +
// auth/callback). It's not a drift offender today, just an artifact of
// pre-metadata code; covered separately under Lane 4.66 audit.
//
// Source-file regex parser (NOT runtime import) — registry imports often pull
// in createClient() and crash without prod env (memory feedback rule #59).
// Sibling guards: 4.121 credit_balance, 4.122 plan_slug, 4.123 api_keys.user_id,
// 4.124 stripe_customer_id, 4.125 auto_topup_*, 4.128 gateway_users.email.
// Together with this PR, every gateway_users column has CI drift coverage.

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

// Files allowed to UPDATE gateway_users with a metadata payload.
// Today: auth/callback (email-verification flow merges into existing.metadata).
const METADATA_UPDATE_ALLOWLIST = new Set<string>([
  "src/app/auth/callback/route.ts",
]);

// Files allowed to INSERT gateway_users with a metadata payload.
// Today: signup (password flow, sets accepted_tos_at + signup_source) and
// auth/callback (OAuth/magic-link flow, sets email_verified + email_verified_at).
const METADATA_INSERT_ALLOWLIST = new Set<string>([
  "src/app/api/v1/signup/route.ts",
  "src/app/auth/callback/route.ts",
]);

describe("Lane 4.130 — gateway_users.metadata write paths drift guard", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files UPDATE gateway_users with a metadata payload", () => {
    // Catches `.from("gateway_users").update({ ... metadata: ... })`.
    // Permits payloads that don't touch metadata (e.g., webhook plan flips).
    // `[,{\s]metadata\s*[,:}]` anchors metadata as its own property name —
    // avoids false-positive on substrings like `user_metadata` or
    // `email_verified_at_metadata_key`.
    const re = /\.from\(\s*["']gateway_users["']\s*\)[\s\S]{0,500}?\.update\(\s*\{[^}]*[,{\s]metadata\s*[,:}]/;
    const violators: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      if (re.test(src)) {
        const rel = file.replace(SRC_ROOT, "src").replace(/\\/g, "/");
        if (!METADATA_UPDATE_ALLOWLIST.has(rel)) {
          violators.push(rel);
        }
      }
    }
    expect(violators).toEqual([]);
  });

  it("only allow-listed files INSERT gateway_users with a metadata payload", () => {
    // Catches `.from("gateway_users").insert({ ... metadata: ... })`.
    // Anchored as property name (see UPDATE test for why).
    const re = /\.from\(\s*["']gateway_users["']\s*\)\.insert\(\s*\{[\s\S]{0,800}?[,{\s]metadata\s*[,:}]/;
    const violators: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      if (re.test(src)) {
        const rel = file.replace(SRC_ROOT, "src").replace(/\\/g, "/");
        if (!METADATA_INSERT_ALLOWLIST.has(rel)) {
          violators.push(rel);
        }
      }
    }
    expect(violators).toEqual([]);
  });

  it("no .from('gateway_users').upsert(...) anywhere in src/", () => {
    // upsert would side-channel both the INSERT and UPDATE allow-lists.
    const re = /\.from\(\s*["']gateway_users["']\s*\)[\s\S]{0,500}?\.upsert\(/;
    const violators: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      if (re.test(src)) {
        violators.push(file.replace(SRC_ROOT, "src").replace(/\\/g, "/"));
      }
    }
    expect(violators).toEqual([]);
  });

  it("no raw SQL UPDATE/INSERT against gateway_users.metadata", () => {
    // Catches `UPDATE gateway_users SET metadata = ...` or
    // `INSERT INTO gateway_users (metadata, ...) VALUES (...)`.
    const re =
      /(UPDATE\s+gateway_users\s+SET[^;]*\bmetadata\b|INSERT\s+INTO\s+gateway_users\s*\([^)]*\bmetadata\b)/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      if (re.test(src)) {
        violators.push(file.replace(SRC_ROOT, "src").replace(/\\/g, "/"));
      }
    }
    expect(violators).toEqual([]);
  });

  it("auth/callback metadata UPDATE preserves existing keys via spread (merge-not-clobber)", () => {
    // auth/callback's email-verification UPDATE must build the metadata object
    // from `existing.metadata` (or equivalent prior-state read) before adding
    // email_verified. Otherwise a wholesale `metadata: { email_verified }`
    // clobbers accepted_tos_at + signup_source + any future keys.
    //
    // Today's pattern:
    //   const metadata = {
    //     ...(isRecord(existing?.metadata) ? existing.metadata : {}),
    //     email_verified: true,
    //     email_verified_at: verifiedAt,
    //   };
    //
    // Drift would be: a future PR rewrites this as
    //   .update({ metadata: { email_verified: true } })
    // which silently drops every other key in the row. This test guards the
    // merge invariant by requiring a spread of existing*.metadata in the file.
    const file = resolve(SRC_ROOT, "app/auth/callback/route.ts");
    const src = readFileSync(file, "utf-8");
    // Match `...existing.metadata`, `...existing?.metadata`,
    // `...(isRecord(existing?.metadata) ? existing.metadata : {})`,
    // or any future variant that spreads an "existing" prior-state object's
    // metadata field. The spread is the load-bearing invariant — anything
    // omitting it is the drift offender.
    expect(src).toMatch(/\.\.\.[^,;}]*existing[^,;}]*\.metadata/);
  });
});
