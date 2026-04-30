import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.182 — drift guard: gateway_usage_log.response_status
// SELECT-projection allow-list.
//
// `gateway_usage_log.response_status` is the per-call HTTP-style
// status integer stamped by `log_gateway_request` from the
// upstream adapter response (200 / 4xx / 5xx). It pairs with
// `latency_ms` (Lane 4.181) to disclose per-tenant reliability
// profiles per upstream provider — error rates, retry storms,
// adapter degradations are all visible in this column row-by-row.
//
// Today's read surface is exactly 2 files, each with a real reason:
//
//   - src/app/api/v1/usage/route.ts —
//       Owner-scoped per-call usage history. Projects
//       response_status alongside id, tool_slug, provider_used,
//       latency_ms, cost_to_user, error_message, created_at
//       (line ~45). Filtered by `.eq("user_id", userId)`.
//
//   - src/app/api/admin/stats/route.ts —
//       Admin-gated platform-wide stats. Projects
//       response_status alongside tool_slug, cost_to_user,
//       cost_to_us (line ~79) for tool-level reliability
//       rollups. Cross-tenant by design — gated by validateAdmin
//       upstream.
//
// No other gateway_usage_log SELECT projects response_status
// today. dashboard/usage/page.tsx and dashboard/page.tsx
// reference `response_status` as a TS field on the JSON
// consumer shape (line ~11/45) and render it via
// `<StatusBadge status={row.response_status} />` — those are
// downstream of /api/v1/usage and out of scope. admin/stats
// also has a non-projection consumer at line 93
// (`if (row.response_status !== 200) entry.errors++`) inside
// the same file as the line 79 projection, so allow-list entry
// already covers it.
//
// Why guard response_status even though it's not a credential:
//
//   - Per-tenant error-rate profile is competitive intel: which
//     adapters a customer fights with, which providers they get
//     rate-limited by, when their workload broke. A new SELECT
//     reader without `.eq("user_id", auth.uid())` or admin-gate
//     would expose other tenants' reliability profile per row.
//   - Combined with `latency_ms` (Lane 4.181), `tool_slug`
//     (Lane 4.179), `provider_used` (Lane 4.178), `cost_to_user`
//     (Lane 4.177), `cost_to_us` (Lane 4.156), `key_source`
//     (Lane 4.157), `used_byok` (Lane 4.158), and
//     `error_message` (Lane 4.180), `response_status` further
//     fills out the per-row workload-shape picture this
//     drift-guard family locks down. After this lane ships, the
//     per-row sensitive columns on gateway_usage_log are
//     bracketed; the remaining unbracketed columns are
//     non-sensitive structural fields (id, user_id, api_key_id,
//     created_at).
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('gateway_usage_log').select('… response_status …')`
//      outside the allow-list.
//   2. `.returns<{ response_status: … }>()` generic outside the
//      allow-list.
//   3. Raw SQL `SELECT … response_status … FROM gateway_usage_log`
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
//   - Lane 4.181 (latency_ms — owner only)

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

// Files allowed to SELECT `response_status` from `gateway_usage_log`.
// Each entry has a real reason — see lane comment above.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/app/api/v1/usage/route.ts",
  "src/app/api/admin/stats/route.ts",
]);

describe("Lane 4.182 — gateway_usage_log.response_status SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT response_status from gateway_usage_log", () => {
    const re =
      /\.from\(\s*["']gateway_usage_log["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\bresponse_status\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare response_status in a gateway_usage_log .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']gateway_usage_log["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\bresponse_status\b/;
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

  it("no raw SQL SELECT response_status FROM gateway_usage_log in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\bresponse_status\b[\s\S]*?\bFROM\s+gateway_usage_log\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
