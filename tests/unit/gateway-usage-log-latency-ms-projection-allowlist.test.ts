import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.181 — drift guard: gateway_usage_log.latency_ms
// SELECT-projection allow-list.
//
// `gateway_usage_log.latency_ms` is the per-call wall-clock
// duration of an upstream tool invocation (Date.now() bracket
// around the adapter call, stamped by `log_gateway_request`).
// It's a per-tenant performance fingerprint — bursts of long
// latencies disclose which adapters a customer is leaning on
// at what scale, and pairs with response_status to disclose
// reliability profiles per upstream provider per tenant.
//
// Today's read surface is exactly 1 file:
//
//   - src/app/api/v1/usage/route.ts —
//       Owner-scoped per-call usage history. Projects
//       latency_ms alongside id, tool_slug, provider_used,
//       response_status, cost_to_user, error_message,
//       created_at (line ~45). Filtered by
//       `.eq("user_id", userId)`.
//
// No other gateway_usage_log SELECT projects latency_ms today.
// Many adapter files (deepl/deepgram/dataforseo/creatomate/etc.)
// have local `healthCheck()` functions returning
// `{ healthy, latency_ms }` from a Date.now() bracket — that's
// the adapter's own health-probe timing, NOT a SELECT
// projection from gateway_usage_log. gateway-types.ts declares
// `latency_ms: number` as a TS field on the consumer
// GatewayResponse shape (line ~29) and adapter HealthCheckResult
// (line ~140). gateway.ts:427/528 build response objects with
// `latency_ms: latencyMs` and gateway.ts:409/465 pass
// `p_latency_ms: latencyMs` as an RPC parameter — both are
// write-side / response-shape constructions, not
// `.from("gateway_usage_log").select(...)` reads. mcp/route.ts
// and playground/page.tsx consume `latency_ms` off the
// /api/v1/execute response shape downstream. None of these
// are in scope for this guard.
//
// Why guard latency_ms even though it's not a credential:
//
//   - Per-tenant latency profile is a competitive-intel
//     signal: which adapters a customer is hot on, when
//     their batch jobs run, which providers they retry. A
//     new SELECT reader without `.eq("user_id", auth.uid())`
//     or admin-gate would leak other tenants' workload
//     timing per row.
//   - Combined with `tool_slug` (Lane 4.179),
//     `provider_used` (Lane 4.178), `cost_to_user`
//     (Lane 4.177), `cost_to_us` (Lane 4.156), `key_source`
//     (Lane 4.157), `used_byok` (Lane 4.158), and
//     `error_message` (Lane 4.180), `latency_ms` further
//     fills out the per-row workload-shape picture this
//     drift-guard family locks down. After this lane ships,
//     the per-row diagnostic + cost + identity columns on
//     gateway_usage_log are bracketed; the remaining
//     unbracketed columns are non-sensitive structural
//     fields (id, user_id, api_key_id, response_status,
//     created_at) — response_status is queued as a follow-up
//     lane.
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('gateway_usage_log').select('… latency_ms …')`
//      outside the allow-list.
//   2. `.returns<{ latency_ms: … }>()` generic outside the
//      allow-list.
//   3. Raw SQL `SELECT … latency_ms … FROM gateway_usage_log`
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
//   - Lane 4.178 (provider_used — owner only)
//   - Lane 4.179 (tool_slug — owner+admin)
//   - Lane 4.180 (error_message — owner only)

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

// Files allowed to SELECT `latency_ms` from `gateway_usage_log`.
// Each entry has a real reason — see lane comment above.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/app/api/v1/usage/route.ts",
]);

describe("Lane 4.181 — gateway_usage_log.latency_ms SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT latency_ms from gateway_usage_log", () => {
    const re =
      /\.from\(\s*["']gateway_usage_log["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\blatency_ms\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare latency_ms in a gateway_usage_log .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']gateway_usage_log["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\blatency_ms\b/;
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

  it("no raw SQL SELECT latency_ms FROM gateway_usage_log in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\blatency_ms\b[\s\S]*?\bFROM\s+gateway_usage_log\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
