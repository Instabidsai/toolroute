import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.218 — drift guard: user_provider_keys.updated_at
// SELECT-projection allow-list.
//
// `user_provider_keys.updated_at` is the BYOK-credential mutation
// timestamp (when did the user last upsert / activate / deactivate
// their bring-your-own-key for a given tool). Pairing it with
// `tool_slug` + `is_active` + `prefer_own_key` reconstructs the
// per-tenant BYOK lifecycle — when each key was added, when it was
// rotated, when it was disabled. Per-tenant infrastructure-
// fingerprint signal; cross-tenant projection (e.g., admin views)
// would leak BYOK adoption patterns.
//
// Today's read surface is exactly 1 file:
//
//   - src/app/api/v1/byok/route.ts:77 — GET /api/v1/byok list:
//       projects `id, tool_slug, is_active, prefer_own_key,
//       created_at, updated_at` ordered by tool_slug, owner-filtered
//       (`.eq("user_id", userId)`). Powers the dashboard BYOK list.
//
// Out-of-scope user_provider_keys callsites (filter-vs-projection):
//
//   - src/app/api/v1/byok/route.ts:38 — POST upsert return shape:
//       `id, tool_slug, is_active, prefer_own_key, created_at`
//       (NO updated_at — verified iter 127).
//   - src/app/api/v1/byok/route.ts:124 — `.update({ is_active,
//       updated_at })` write, not projection.
//   - src/lib/gateway.ts:308 — `.select("api_key_encrypted")`
//       (4.145 lockdown), NOT updated_at.
//   - src/lib/gateway.ts:350 — `.select("api_key_encrypted")`
//       (4.145 lockdown), NOT updated_at.
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
//   - api/v1/byok/route.ts:34 — upsert `updated_at` field write.
//   - api/a2a/route.ts:18/232/259/361 — local in-memory Task type.
//   - lib/types.ts, gateway-types.ts, dashboard/providers/page.tsx
//       — TypeScript type declarations.
//   - lib/adapters/github-adapter.ts — third-party API mapping.
//   - app/sitemap.ts:409 — `tool.updated_at` from `tools` table.
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('user_provider_keys').select('… updated_at …')`
//      outside the allow-list.
//   2. `.returns<{ updated_at: … }>()` generic outside the
//      allow-list.
//   3. Raw SQL `SELECT … updated_at … FROM user_provider_keys`
//      anywhere in src/.
//
// REGEX PRECISION:
//
// `updated_at` is long-enough (10 chars) — standard
// `[\s\S]{0,500}?` window suffices. Adjacent tables' `updated_at`
// projections are caught by their own table-specific guards
// (4.215/4.217 for tool_providers, 4.216 for gateway_users).
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards on user_provider_keys (column family complete):
//   - 4.145 (api_key_encrypted projection)
//   - 4.184 (tool_slug projection)
//   - 4.185 (is_active projection)
//   - 4.200 (prefer_own_key projection)
//   - 4.208 (id projection)
//   - 4.213 (created_at projection)

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

// Files allowed to SELECT `updated_at` from `user_provider_keys`.
// Each entry has a real reason — see lane comment above.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/app/api/v1/byok/route.ts",
]);

describe("Lane 4.218 — user_provider_keys.updated_at SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT updated_at from user_provider_keys", () => {
    const re =
      /\.from\(\s*["']user_provider_keys["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\bupdated_at\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare updated_at in a user_provider_keys .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']user_provider_keys["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\bupdated_at\b/;
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

  it("no raw SQL SELECT updated_at FROM user_provider_keys in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\bupdated_at\b[\s\S]*?\bFROM\s+user_provider_keys\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
