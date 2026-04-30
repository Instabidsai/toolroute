import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.180 — drift guard: gateway_usage_log.error_message
// SELECT-projection allow-list.
//
// `gateway_usage_log.error_message` is the per-call diagnostic
// string stamped by `log_gateway_request` when an upstream tool
// call fails. It can carry incidental information leakage:
// stack traces, provider request IDs, internal paths, raw HTTP
// bodies from failed adapter calls. Locking the projection
// surface keeps that diagnostic exhaust from drifting into a
// new reader without owner-scoping or admin-gating.
//
// Today's read surface is exactly 1 file:
//
//   - src/app/api/v1/usage/route.ts —
//       Owner-scoped per-call usage history. Projects
//       error_message alongside id, tool_slug, provider_used,
//       response_status, latency_ms, cost_to_user, created_at
//       (line ~45). Filtered by `.eq("user_id", userId)`.
//
// No other gateway_usage_log SELECT projects error_message
// today. dashboard/usage/page.tsx and dashboard/page.tsx
// reference `error_message` as a TS field on the JSON consumer
// shape (rendered via `{row.error_message || "-"}`), not as a
// `.from("gateway_usage_log").select(...)` projection — those
// are downstream of /api/v1/usage and out of scope for this
// guard. redact-creds.ts has a single comment reference
// (stripped by stripComments). docs/page.tsx has the column
// listed in a docs-string array (stripped is N/A but it is
// not a `.from().select()` callsite).
//
// Why guard this column even though it's not a credential:
//
//   - error_message is the most leak-prone of the per-row
//     diagnostic fields. Provider error responses commonly
//     embed: request IDs, internal IPs, sanitized-but-not-
//     stripped stack frames, partial prompt text. A new
//     SELECT reader without `.eq("user_id", auth.uid())` or
//     admin-gate would expose other tenants' diagnostic
//     exhaust per row.
//   - Combined with `tool_slug` (Lane 4.179),
//     `provider_used` (Lane 4.178), `cost_to_user`
//     (Lane 4.177), `cost_to_us` (Lane 4.156), `key_source`
//     (Lane 4.157), and `used_byok` (Lane 4.158),
//     `error_message` is the last per-row diagnostic /
//     traffic-shape column on this table — after this lane
//     ships, gateway_usage_log per-row reads are fully
//     bracketed.
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('gateway_usage_log').select('… error_message …')`
//      outside the allow-list.
//   2. `.returns<{ error_message: … }>()` generic outside the
//      allow-list.
//   3. Raw SQL `SELECT … error_message … FROM gateway_usage_log`
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

// Files allowed to SELECT `error_message` from `gateway_usage_log`.
// Each entry has a real reason — see lane comment above.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/app/api/v1/usage/route.ts",
]);

describe("Lane 4.180 — gateway_usage_log.error_message SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT error_message from gateway_usage_log", () => {
    const re =
      /\.from\(\s*["']gateway_usage_log["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\berror_message\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare error_message in a gateway_usage_log .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']gateway_usage_log["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\berror_message\b/;
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

  it("no raw SQL SELECT error_message FROM gateway_usage_log in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\berror_message\b[\s\S]*?\bFROM\s+gateway_usage_log\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
