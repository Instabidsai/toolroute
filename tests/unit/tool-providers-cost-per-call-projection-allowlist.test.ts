import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.186 — drift guard: tool_providers.cost_per_call
// SELECT-projection allow-list.
//
// `tool_providers.cost_per_call` is the wholesale per-call cost
// ToolRoute pays the upstream provider (in USD) for the master-pool
// API key. Combined with `markup_percent` (sibling column), it
// fully discloses ToolRoute's COGS structure and per-tool gross
// margin. Exfiltration of this column is a direct competitive-
// intel leak: anyone reading the row can compute "ToolRoute pays
// $X to upstream, charges customers $X*(1+markup) — what's their
// margin headroom on tool Y?".
//
// Today's read surface is exactly 2 files:
//
//   - src/lib/gateway.ts (line ~331) —
//       Server-side internal gateway lookup. Runs on every gateway
//       request via service-role client (sb0). Reads
//       `auth_key_encrypted, cost_per_call, cost_model,
//       markup_percent` filtered by `.eq("tool_slug", adapter.slug)
//       .eq("is_active", true)`. The cost_per_call value feeds the
//       per-request cost calc (gateway.ts:340 `Number(providerRow.
//       cost_per_call)` — that's a consumer of the projection,
//       NOT a separate SELECT, and out of scope for this guard).
//
//   - src/app/api/admin/providers/route.ts (line ~174) —
//       Admin-gated GET (validateAdmin upstream). Returns full
//       provider catalog including cost_per_call so the admin UI
//       can render the wholesale-cost / margin column. The other
//       three matches in this file (lines ~52, ~92, ~123) are
//       request-body parsing on the WRITE side (POST/PATCH) —
//       projection guard is SELECT-side only, so those are out
//       of scope.
//
// Why guard cost_per_call:
//
//   - Per-row cost_per_call is the wholesale cost ToolRoute pays
//     the upstream provider. With `markup_percent` it fully
//     describes per-tool gross margin.
//   - A new SELECT reader without admin-gating would expose
//     ToolRoute's COGS structure via any unauthenticated route.
//   - The same row also carries `auth_key_encrypted` (Lane 4.144
//     — already locked to gateway.ts only). The cost columns sit
//     on the same table but have a 2-file allow-list because
//     admin/providers/route.ts deliberately projects the cost
//     fields without touching auth_key_encrypted.
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('tool_providers').select('… cost_per_call …')`
//      outside the allow-list.
//   2. `.returns<{ cost_per_call: … }>()` generic outside the
//      allow-list.
//   3. Raw SQL `SELECT … cost_per_call … FROM tool_providers`
//      anywhere in src/.
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards:
//   - Lane 4.144 (tool_providers.auth_key_encrypted projection — gateway.ts only)
//   - Lane 4.184 (user_provider_keys.tool_slug projection — different table)
//   - Lane 4.185 (user_provider_keys.is_active projection — different table)

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

// Files allowed to SELECT `cost_per_call` from `tool_providers`.
// Each entry has a real reason — see lane comment above.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/lib/gateway.ts",
  "src/app/api/admin/providers/route.ts",
]);

describe("Lane 4.186 — tool_providers.cost_per_call SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT cost_per_call from tool_providers", () => {
    const re =
      /\.from\(\s*["']tool_providers["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\bcost_per_call\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare cost_per_call in a tool_providers .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']tool_providers["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\bcost_per_call\b/;
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

  it("no raw SQL SELECT cost_per_call FROM tool_providers in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\bcost_per_call\b[\s\S]*?\bFROM\s+tool_providers\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
