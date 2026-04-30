import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.179 — drift guard: gateway_usage_log.tool_slug
// SELECT-projection allow-list.
//
// `gateway_usage_log.tool_slug` is the per-call tool identifier
// (e.g., "screenshotone/capture", "openai/chat", "anthropic/messages").
// It's stamped onto each usage row by `log_gateway_request` so that
// per-call billing, history, and admin analytics can attribute spend
// and traffic to specific adapters.
//
// Today's read surface is exactly 2 files, each with a real reason:
//
//   - src/app/api/v1/usage/route.ts —
//       Owner-scoped per-call usage history. Projects tool_slug
//       alongside id, provider_used, response_status, latency_ms,
//       cost_to_user, error_message, created_at (line ~45).
//       Filtered by `.eq("user_id", userId)`. Same SELECT also
//       supports a tool_slug filter param (.eq("tool_slug", ...)) —
//       owner is locked first.
//
//   - src/app/api/admin/stats/route.ts —
//       Admin-gated platform-wide stats. Projects tool_slug
//       alongside cost_to_user, cost_to_us, response_status (line
//       ~79). Cross-tenant by design — gated by validateAdmin
//       upstream.
//
// No other gateway_usage_log SELECT projects tool_slug today.
// `dashboard/page.tsx:185-192` uses .select("id") count queries
// only.
//
// Why guard this column even though it's not a credential:
//
//   - `tool_slug` discloses each customer's product mix —
//     which adapters they call, at what frequency, in what
//     combinations. A new SELECT reader without
//     `.eq("user_id", auth.uid())` or admin-gate would expose
//     other tenants' tool routing per row.
//   - Combined with `provider_used` (Lane 4.178),
//     `cost_to_user` (Lane 4.177), `cost_to_us` (Lane 4.156),
//     `key_source` (Lane 4.157), and `used_byok` (Lane 4.158),
//     `tool_slug` completes the per-row traffic-shape picture
//     that this drift-guard family locks down.
//   - Cross-tenant tool-mix data is competitive intel about
//     ToolRoute's customer base AND about each customer's
//     product strategy.
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('gateway_usage_log').select('… tool_slug …')`
//      outside the allow-list.
//   2. `.returns<{ tool_slug: … }>()` generic outside the
//      allow-list.
//   3. Raw SQL `SELECT … tool_slug … FROM gateway_usage_log`
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

// Files allowed to SELECT `tool_slug` from `gateway_usage_log`.
// Each entry has a real reason — see lane comment above.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/app/api/v1/usage/route.ts",
  "src/app/api/admin/stats/route.ts",
]);

describe("Lane 4.179 — gateway_usage_log.tool_slug SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT tool_slug from gateway_usage_log", () => {
    const re =
      /\.from\(\s*["']gateway_usage_log["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\btool_slug\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare tool_slug in a gateway_usage_log .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']gateway_usage_log["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\btool_slug\b/;
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

  it("no raw SQL SELECT tool_slug FROM gateway_usage_log in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\btool_slug\b[\s\S]*?\bFROM\s+gateway_usage_log\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
