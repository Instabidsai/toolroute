import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.217 — drift guard: tool_providers.updated_at
// SELECT-projection allow-list.
//
// `tool_providers.updated_at` is the master-credential mutation
// timestamp on the gateway-owned provider registry. Pairing
// `updated_at` with `tool_slug` + `cost_per_call` (4.186) +
// `markup_percent` (4.188) + `health_status` (4.194) reconstructs
// the full mutation history of every master credential — when each
// provider's economics changed, when reliability shifted, when the
// gateway last re-keyed. Admin-only inventory signal.
//
// Today's read surface is exactly 1 file:
//
//   - src/app/api/admin/providers/route.ts:172 — admin GET list:
//       projects `id, tool_slug, provider_name, api_base_url,
//       auth_type, auth_header_name, cost_per_call, cost_model,
//       cost_unit, markup_percent, is_active, health_status,
//       last_health_check, avg_latency_ms, error_rate_24h,
//       created_at, updated_at` ordered by tool_slug. Admin-gated
//       (ADMIN_HEADERS, requireAdmin upstream).
//
// Out-of-scope tool_providers callsites (filter-vs-projection):
//
//   - src/app/api/admin/providers/route.ts:77 — `.select("id")`
//       existence check; doesn't project updated_at.
//   - src/lib/gateway.ts:330 — projects `auth_key_encrypted,
//       cost_per_call, cost_model, markup_percent` (4.143
//       lockdown), NOT updated_at.
//   - src/lib/gateway.ts:369 — projects `auth_key_encrypted` only.
//
// Out-of-scope updated_at references in src/ (other tables / writes /
// types / third-party API responses):
//
//   - src/app/api/admin/providers/route.ts:86 — UPDATE write
//       (`.update({ updated_at: ... })`), not projection.
//   - webhooks/stripe/route.ts:161/188/200/384, auth/callback:82,
//       v1/settings:183, v1/billing/setup-payment:52 — gateway_users
//       UPDATE writes.
//   - api/v1/byok/route.ts:34/77/124 — user_provider_keys, not
//       tool_providers.
//   - api/a2a/route.ts:18/232/259/361 — local in-memory Task type.
//   - lib/types.ts, gateway-types.ts, dashboard/providers/page.tsx
//       — TypeScript type declarations.
//   - lib/adapters/github-adapter.ts — third-party API mapping.
//   - app/sitemap.ts:409 — `tool.updated_at` from `tools` table.
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('tool_providers').select('… updated_at …')` outside
//      the allow-list.
//   2. `.returns<{ updated_at: … }>()` generic outside the
//      allow-list.
//   3. Raw SQL `SELECT … updated_at … FROM tool_providers`
//      anywhere in src/.
//
// REGEX PRECISION:
//
// `updated_at` is long-enough (10 chars) — standard
// `[\s\S]{0,500}?` window suffices. Adjacent tables' `updated_at`
// projections are caught by their own table-specific guards.
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards on tool_providers (column family complete):
//   - 4.143 (auth_key_encrypted projection)
//   - 4.186 (cost_per_call projection)
//   - 4.187 (cost_model projection)
//   - 4.188 (markup_percent projection)
//   - 4.189 (cost_unit projection)
//   - 4.190 (api_base_url projection)
//   - 4.191 (auth_type projection)
//   - 4.192 (auth_header_name projection)
//   - 4.193 (provider_name projection)
//   - 4.194 (health_status projection)
//   - 4.195 (last_health_check projection)
//   - 4.196 (avg_latency_ms projection)
//   - 4.197 (error_rate_24h projection)
//   - 4.198 (is_active projection)
//   - 4.209 (id projection)
//   - 4.215 (created_at projection)

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

// Files allowed to SELECT `updated_at` from `tool_providers`.
// Each entry has a real reason — see lane comment above.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/app/api/admin/providers/route.ts",
]);

describe("Lane 4.217 — tool_providers.updated_at SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT updated_at from tool_providers", () => {
    const re =
      /\.from\(\s*["']tool_providers["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\bupdated_at\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare updated_at in a tool_providers .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']tool_providers["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\bupdated_at\b/;
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

  it("no raw SQL SELECT updated_at FROM tool_providers in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\bupdated_at\b[\s\S]*?\bFROM\s+tool_providers\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
