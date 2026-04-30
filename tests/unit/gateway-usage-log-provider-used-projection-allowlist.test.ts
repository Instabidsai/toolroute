import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.178 — drift guard: gateway_usage_log.provider_used
// SELECT-projection allow-list.
//
// `gateway_usage_log.provider_used` is the per-call routing
// decision — the slug of the upstream provider that ToolRoute
// actually selected for this request (e.g., "screenshotone",
// "thum.io", "openai", "anthropic"). It's stamped onto each
// usage row by `log_gateway_request` so users can see which
// provider their adapter call hit.
//
// Today's read surface is exactly 1 file:
//
//   - src/app/api/v1/usage/route.ts —
//       Owner-scoped per-call usage history. Projects
//       provider_used alongside id, tool_slug, response_status,
//       latency_ms, cost_to_user, error_message, created_at
//       (line ~45). Filtered by `.eq("user_id", userId)`.
//
// No admin/stats route projects provider_used. No gateway-internal
// path SELECTs it back from the table (it's stamped at write-time
// and never re-read by ToolRoute itself).
//
// Why guard this column even though it's not a credential:
//
//   - `provider_used` discloses the per-call routing fingerprint
//     for each customer — which upstream provider serves which
//     tool for which tenant. Cross-tenant projection (without
//     `.eq("user_id", auth.uid())`) leaks competitive intel
//     about ToolRoute's routing logic AND the customer's tool
//     mix.
//   - Combined with `key_source` (Lane 4.157, admin-only) and
//     `used_byok` (Lane 4.158, empty allow-list), this column
//     completes the routing-fingerprint trio. Where 4.157/4.158
//     lock the BYOK-vs-master signal, this column locks the
//     specific provider slug — a higher-resolution signal
//     because two BYOK keys in the same `key_source=byok`
//     bucket can route to different providers.
//   - The risk class is identical to `cost_to_user` (Lane 4.177)
//     and `tool_slug` — per-tenant traffic-shape data on a
//     per-row basis.
//
// Out of scope (intentionally NOT gateway_usage_log SELECT
// projections):
//   - `dashboard/usage/page.tsx:10` declares provider_used as a
//     TypeScript field on the JSON response shape consumed from
//     /api/v1/usage. Not a `from("gateway_usage_log").select()`.
//   - `lib/adapters/screenshot-adapter.ts` (lines ~70, ~86, ~123,
//     ~138) stamps `provider_used` into the adapter return shape
//     pre-log. Write-side, not SELECT.
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('gateway_usage_log').select('… provider_used …')`
//      outside the allow-list.
//   2. `.returns<{ provider_used: … }>()` generic outside the
//      allow-list.
//   3. Raw SQL `SELECT … provider_used … FROM gateway_usage_log`
//      anywhere in src/.
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards:
//   - Lane 4.140 (gateway_usage_log SELECT owner-filter)
//   - Lane 4.142 (gateway_usage_log direct-mutation allow-list)
//   - Lane 4.156 (cost_to_us — admin only)
//   - Lane 4.157 (key_source — admin only)
//   - Lane 4.158 (used_byok — empty allow-list)
//   - Lane 4.177 (cost_to_user — owner+admin)

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

// Files allowed to SELECT `provider_used` from `gateway_usage_log`.
// Exactly one read path: owner-scoped usage history endpoint.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/app/api/v1/usage/route.ts",
]);

describe("Lane 4.178 — gateway_usage_log.provider_used SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT provider_used from gateway_usage_log", () => {
    const re =
      /\.from\(\s*["']gateway_usage_log["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\bprovider_used\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare provider_used in a gateway_usage_log .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']gateway_usage_log["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\bprovider_used\b/;
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

  it("no raw SQL SELECT provider_used FROM gateway_usage_log in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\bprovider_used\b[\s\S]*?\bFROM\s+gateway_usage_log\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
