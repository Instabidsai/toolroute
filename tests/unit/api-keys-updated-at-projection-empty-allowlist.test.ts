import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.219 — drift guard: api_keys.updated_at
// EMPTY SELECT-projection allow-list.
//
// `api_keys.updated_at` is the API-key mutation timestamp (when did
// the user last rename the key, toggle is_active, or rotate scopes).
// Pairing it with `key_prefix` + `is_active` + `allowed_tools` would
// reconstruct each user's per-key lifecycle. Per-tenant
// infrastructure-fingerprint signal.
//
// Today the read surface is EMPTY — zero callsites SELECT
// updated_at from api_keys. All 5 api_keys SELECT callsites
// enumerated below project other columns but never updated_at:
//
//   - src/lib/gateway.ts:75 — `.select("expires_at")` for
//       expiry check (NO updated_at).
//   - src/app/api/v1/keys/route.ts:113 — list endpoint, projects
//       `id, name, key_prefix, allowed_tools, is_active,
//       last_used_at, created_at, expires_at` (NO updated_at).
//   - src/app/api/v1/keys/route.ts:171 — `.select("id")` ownership
//       check before deactivate.
//   - src/app/api/v1/keys/route.ts:261 — `.select("id")` ownership
//       check before rename.
//   - src/app/api/v1/keys/route.ts:279 — rename PATCH return shape,
//       `id, name, key_prefix, allowed_tools, is_active,
//       last_used_at, created_at, expires_at` (NO updated_at).
//
// Out-of-scope api_keys callsites (not SELECTs):
//
//   - src/app/api/v1/signup/route.ts:191 — INSERT for default key.
//   - src/app/api/v1/keys/route.ts:55 — INSERT for new key.
//   - src/app/api/v1/keys/route.ts:185 — UPDATE deactivate write.
//   - src/app/api/v1/keys/route.ts:275 — UPDATE rename write
//       (chained .select() projects no updated_at — line 279).
//
// Out-of-scope updated_at references in src/ (other tables / writes /
// types / third-party API responses):
//
//   - webhooks/stripe/route.ts:161/188/200/384, auth/callback:82,
//       v1/settings:183, v1/billing/setup-payment:52 — gateway_users
//       UPDATE writes.
//   - api/admin/providers/route.ts:86 — tool_providers UPDATE.
//   - api/admin/providers/route.ts:176 — tool_providers SELECT
//       (locked by 4.217).
//   - api/v1/byok/route.ts:34 — user_provider_keys upsert
//       updated_at field write.
//   - api/v1/byok/route.ts:77 — user_provider_keys SELECT (locked
//       by 4.218).
//   - api/v1/byok/route.ts:124 — user_provider_keys UPDATE write.
//   - api/a2a/route.ts:18/232/259/361 — local in-memory Task type.
//   - lib/types.ts, gateway-types.ts, dashboard/providers/page.tsx
//       — TypeScript type declarations.
//   - lib/adapters/github-adapter.ts — third-party API mapping.
//   - app/sitemap.ts:409 — `tool.updated_at` from `tools` table.
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('api_keys').select('… updated_at …')` anywhere.
//   2. `.returns<{ updated_at: … }>()` generic on api_keys.
//   3. Raw SQL `SELECT … updated_at … FROM api_keys`.
//
// EMPTY allow-list = strongest-form drift guard — any new reader
// trips the test, forcing the diff reviewer to justify projecting
// updated_at and adding the file here.
//
// REGEX PRECISION:
//
// `updated_at` is long-enough (10 chars) — standard
// `[\s\S]{0,500}?` window suffices. Adjacent tables' `updated_at`
// projections are caught by their own table-specific guards
// (4.215/4.217 tool_providers, 4.216 gateway_users empty,
// 4.218 user_provider_keys).
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards on api_keys (column family complete):
//   - 4.143 (key_hash projection)
//   - 4.166 (key_prefix projection)
//   - 4.167 (is_active projection)
//   - 4.168 (allowed_tools projection)
//   - 4.169 (expires_at projection)
//   - 4.170 (last_used_at projection)
//   - 4.173 (rate_limit_rpm/rpd empty projection)
//   - 4.174 (name projection)
//   - 4.183 (request_count empty projection)
//   - 4.202 (user_id empty projection)
//   - 4.206 (id projection)
//   - 4.211 (created_at projection)

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
// matching so JSDoc references to the column don't trigger false
// positives (memory rule from prior drift-guard work).
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function rel(file: string): string {
  return file.replace(SRC_ROOT, "src").replace(/\\/g, "/");
}

// EMPTY allow-list: zero files may SELECT updated_at from api_keys.
const PROJECTION_ALLOWLIST = new Set<string>([]);

describe("Lane 4.219 — api_keys.updated_at EMPTY SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("no file SELECTs updated_at from api_keys", () => {
    const re =
      /\.from\(\s*["']api_keys["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\bupdated_at\b[^"'`]*["'`]/;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) {
        const r = rel(file);
        if (!PROJECTION_ALLOWLIST.has(r)) violators.push(r);
      }
    }
    expect(violators).toEqual([]);
  });

  it("no file declares updated_at in an api_keys .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']api_keys["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\bupdated_at\b/;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) {
        const r = rel(file);
        if (!PROJECTION_ALLOWLIST.has(r)) violators.push(r);
      }
    }
    expect(violators).toEqual([]);
  });

  it("no raw SQL SELECT updated_at FROM api_keys in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\bupdated_at\b[\s\S]*?\bFROM\s+api_keys\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
