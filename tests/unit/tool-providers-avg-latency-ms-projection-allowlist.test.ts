import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.196 — drift guard: tool_providers.avg_latency_ms
// SELECT-projection allow-list.
//
// `tool_providers.avg_latency_ms` is the rolling average response
// latency per upstream provider. Sibling to health_status
// (Lane 4.194) and last_health_check (Lane 4.195) — together
// they describe ToolRoute's per-provider operational performance.
//
// Why guard avg_latency_ms:
//   - Per-row: discloses real-time response latency for each
//     upstream. Combined with health_status it tells competitors
//     whether ToolRoute's integrations are slow under load.
//   - Aggregate: cross-provider latency profile is competitive
//     intel — reveals which upstreams are bottlenecks for
//     ToolRoute's customers (and thus where competitors might
//     win on latency).
//   - Background health checks compute and write this column;
//     admin UI is the only reader.
//
// Today's read surface is exactly 1 file:
//
//   - src/app/api/admin/providers/route.ts (line ~175) —
//       Admin-gated GET (validateAdmin upstream). Sole reader.
//
// Disambiguation:
//   - src/app/api/v1/tools/route.ts:165 contains the literal
//     property assignment `avg_latency_ms: null` inside a public
//     tool-catalog response shape. That is NOT a SELECT projection
//     of `tool_providers.avg_latency_ms` — the regex correctly
//     ignores it because it only matches `avg_latency_ms` inside
//     the quoted `.select(...)` argument that is preceded by
//     `.from("tool_providers")`. The public catalog response
//     uses a constant null placeholder; no row data crosses the
//     boundary.
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('tool_providers').select('… avg_latency_ms …')`
//      outside the allow-list.
//   2. `.returns<{ avg_latency_ms: … }>()` generic outside the
//      allow-list.
//   3. Raw SQL `SELECT … avg_latency_ms … FROM tool_providers`
//      anywhere in src/.
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards on tool_providers (operational-fingerprint cluster):
//   - 4.194 (health_status)
//   - 4.195 (last_health_check)
//   - 4.144/4.186-4.193 (other tool_providers cols)

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

// Files allowed to SELECT `avg_latency_ms` from `tool_providers`.
// Each entry has a real reason — see lane comment above.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/app/api/admin/providers/route.ts",
]);

describe("Lane 4.196 — tool_providers.avg_latency_ms SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT avg_latency_ms from tool_providers", () => {
    const re =
      /\.from\(\s*["']tool_providers["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\bavg_latency_ms\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare avg_latency_ms in a tool_providers .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']tool_providers["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\bavg_latency_ms\b/;
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

  it("no raw SQL SELECT avg_latency_ms FROM tool_providers in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\bavg_latency_ms\b[\s\S]*?\bFROM\s+tool_providers\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
