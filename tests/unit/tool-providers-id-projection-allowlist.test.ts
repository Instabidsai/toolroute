import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.209 — drift guard: tool_providers.id SELECT-projection
// allow-list.
//
// `tool_providers.id` is the PK on the master-key (gateway-owned)
// provider registry — every tool's master credential, cost basis,
// markup, and health metrics live here. Sibling to the user-side
// BYOK table (`user_provider_keys`, locked by 4.208).
//
// Risk class: indirect but high-leverage. `id` alone is opaque,
// but `id` paired with `tool_slug`, `auth_key_encrypted` (4.143),
// `cost_per_call` (4.121), `markup_percent`, `is_active`,
// `health_status` enables full master-key inventory + cost-model
// reconstruction across the entire 51-adapter catalog. A single
// stray `.select('id, …')` outside admin = full margin model leak.
//
// Today's read surface is exactly 1 file:
//
//   - src/app/api/admin/providers/route.ts — admin master-key
//       management endpoint:
//         * line ~76: existence check before insert/update —
//             `.select("id").eq("tool_slug", tool_slug)`. Scoped
//             by tool_slug.
//         * line ~171: GET admin list — projects
//             `id, tool_slug, provider_name, api_base_url,
//             auth_type, auth_header_name, cost_per_call,
//             cost_model, cost_unit, markup_percent, is_active,
//             health_status, last_health_check, avg_latency_ms,
//             error_rate_24h, created_at, updated_at` ordered by
//             tool_slug. Admin-gated route (ADMIN_HEADERS,
//             requireAdmin upstream).
//
// `src/lib/gateway.ts:329, :368` use `tool_slug` filters but
// project `auth_key_encrypted, cost_per_call, cost_model,
// markup_percent` (4.143 lockdown), NOT `id` — so they are NOT
// in scope (filter-vs-projection disambiguation, same as Lanes
// 4.199 / 4.206 / 4.208).
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('tool_providers').select('… id …')` outside the
//      allow-list.
//   2. `.returns<{ id: … }>()` generic outside the allow-list.
//   3. Raw SQL `SELECT … id … FROM tool_providers` anywhere
//      in src/.
//
// REGEX PRECISION (reusable pattern for short-identifier cols, first
// proven in Lane 4.204):
//
// Because `id` is a 2-char common identifier, the standard
// `[\s\S]{0,500}?` window over-matches when an unrelated
// `.from(other_table).select("id")` falls within 500 chars. The
// negative-lookahead `(?:(?!\.from\()[\s\S]){0,500}?` bars
// intervening `.from(` calls. Same pattern reused in 4.205, 4.206,
// 4.207, 4.208.
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards on tool_providers:
//   - 4.121 (cost_per_call projection)
//   - 4.143 (auth_key_encrypted projection)
//
// Sibling PK projection guards (closes the PK family for all
// gateway-owned + per-tenant credential/billing tables):
//   - 4.204 (gateway_users.id, where the negative-lookahead pattern
//     was first proven)
//   - 4.205 (credit_transactions.id)
//   - 4.206 (api_keys.id)
//   - 4.207 (gateway_usage_log.id)
//   - 4.208 (user_provider_keys.id)
//   - 4.209 (tool_providers.id) ← THIS LANE

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

// Files allowed to SELECT `id` from `tool_providers`.
// Each entry has a real reason — see lane comment above.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/app/api/admin/providers/route.ts",
]);

describe("Lane 4.209 — tool_providers.id SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT id from tool_providers", () => {
    const re =
      /\.from\(\s*["']tool_providers["']\s*\)(?:(?!\.from\()[\s\S]){0,500}?\.select\(\s*["'`][^"'`]*\bid\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare id in a tool_providers .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']tool_providers["']\s*\)(?:(?!\.from\()[\s\S]){0,500}?\.returns<[\s\S]*?\bid\b/;
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

  it("no raw SQL SELECT id FROM tool_providers in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\bid\b[\s\S]*?\bFROM\s+tool_providers\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
