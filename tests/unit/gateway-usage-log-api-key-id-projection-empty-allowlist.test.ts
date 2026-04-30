import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.203 — drift guard: gateway_usage_log.api_key_id
// SELECT-projection EMPTY allow-list (no readers today).
//
// `gateway_usage_log.api_key_id` is the FK to api_keys.id stamped
// at write-time by `log_gateway_request`. It identifies WHICH
// api_key row attributed a given gateway call (multi-key per
// tenant). Today the application reads `api_key_id` from ZERO
// files: it is never projected from gateway_usage_log into
// application code.
//
// This guard freezes that property. Any future SELECT-projection
// of `api_key_id` is a NEW per-key disclosure surface — and is
// almost always redundant with `user_id` for tenant-level
// aggregation.
//
// Why the empty allow-list isn't fragile:
//   - Per-tenant aggregation uses `user_id` (4.199) — admin/stats
//     groups by user, not by api_key. Per-key usage isn't a
//     surfaced product feature.
//   - User-facing per-key dashboards don't exist today; the
//     /dashboard/api-keys panel projects api_keys row data, not
//     gateway_usage_log rows.
//   - If a future "per-key usage panel" needs api_key_id, the diff
//     reviewer must add this file's allow-list entry with explicit
//     reason — empty-allow-list forces that conversation.
//
// Risk class if violated:
//   - Combined with `cost_to_user` (4.177) or `cost_to_us` (4.156):
//     per-API-key revenue / margin trace.
//   - Combined with `tool_slug` (4.179): per-key tool-mix
//     fingerprint (which tools each key uses, useful for
//     competitor reverse-engineering of customer integrations).
//   - Aggregated across tenants: cross-key attribution would
//     enable identifying "this key did X" patterns — useful for
//     abuse detection but also for cross-tenant inference if
//     leaked outside admin paths.
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('gateway_usage_log').select('… api_key_id …')`
//      anywhere in src/.
//   2. `.returns<{ api_key_id: … }>()` generic anywhere in src/.
//   3. Raw SQL `SELECT … api_key_id … FROM gateway_usage_log`
//      anywhere in src/.
//
// Source-file regex parser only — registry imports often pull
// in createClient() at module load and crash without prod env
// (memory rule #59).
//
// Sibling guards on gateway_usage_log:
//   - 4.140 (owner SELECT filter)
//   - 4.142 (direct-mutation allow-list)
//   - 4.156 (cost_to_us)
//   - 4.157 (key_source)
//   - 4.158 (used_byok empty)
//   - 4.177 (cost_to_user)
//   - 4.178 (provider_used)
//   - 4.179 (tool_slug)
//   - 4.180 (error_message)
//   - 4.181 (latency_ms)
//   - 4.182 (response_status)
//   - 4.199 (user_id)
//   - 4.203 (api_key_id empty) ← THIS LANE

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

// Empty allow-list — gateway_usage_log.api_key_id has zero
// SELECT-projection readers today. Adding a reader requires
// deliberate allow-list expansion + reviewer justification.
const PROJECTION_ALLOWLIST = new Set<string>([]);

describe("Lane 4.203 — gateway_usage_log.api_key_id empty SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("no files SELECT api_key_id from gateway_usage_log (empty allow-list)", () => {
    const re =
      /\.from\(\s*["']gateway_usage_log["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\bapi_key_id\b[^"'`]*["'`]/;
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

  it("no files declare api_key_id in a gateway_usage_log .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']gateway_usage_log["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\bapi_key_id\b/;
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

  it("no raw SQL SELECT api_key_id FROM gateway_usage_log in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\bapi_key_id\b[\s\S]*?\bFROM\s+gateway_usage_log\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
