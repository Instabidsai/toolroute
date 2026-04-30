import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.197 — drift guard: tool_providers.error_rate_24h
// SELECT-projection allow-list.
//
// `tool_providers.error_rate_24h` is the rolling 24-hour error
// rate per upstream provider — completes the operational-
// fingerprint cluster on tool_providers (health_status,
// last_health_check, avg_latency_ms, error_rate_24h).
//
// Why guard error_rate_24h:
//   - Per-row: discloses the failure rate of each ToolRoute
//     upstream integration over the last 24 hours. High
//     error_rate_24h reveals a degraded provider before it
//     visibly affects ToolRoute customers — early-warning
//     signal for competitors.
//   - Aggregate: cross-provider error-rate profile is the most
//     direct quality-of-service comparison metric. Combined
//     with avg_latency_ms (4.196) it's the full SLO picture
//     ToolRoute internally tracks.
//   - Background health checks compute and write this column;
//     admin UI is the only reader.
//
// Today's read surface is exactly 1 file:
//
//   - src/app/api/admin/providers/route.ts (line ~175) —
//       Admin-gated GET (validateAdmin upstream). Sole reader.
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('tool_providers').select('… error_rate_24h …')`
//      outside the allow-list.
//   2. `.returns<{ error_rate_24h: … }>()` generic outside the
//      allow-list.
//   3. Raw SQL `SELECT … error_rate_24h … FROM tool_providers`
//      anywhere in src/.
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards on tool_providers (operational-fingerprint cluster):
//   - 4.194 (health_status)
//   - 4.195 (last_health_check)
//   - 4.196 (avg_latency_ms)
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

// Files allowed to SELECT `error_rate_24h` from `tool_providers`.
// Each entry has a real reason — see lane comment above.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/app/api/admin/providers/route.ts",
]);

describe("Lane 4.197 — tool_providers.error_rate_24h SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT error_rate_24h from tool_providers", () => {
    const re =
      /\.from\(\s*["']tool_providers["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\berror_rate_24h\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare error_rate_24h in a tool_providers .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']tool_providers["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\berror_rate_24h\b/;
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

  it("no raw SQL SELECT error_rate_24h FROM tool_providers in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\berror_rate_24h\b[\s\S]*?\bFROM\s+tool_providers\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
