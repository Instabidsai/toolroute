import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.195 — drift guard: tool_providers.last_health_check
// SELECT-projection allow-list.
//
// `tool_providers.last_health_check` is the timestamp of the most
// recent background health probe per provider. Sibling to
// health_status (Lane 4.194) — when the admin UI shows a status,
// last_health_check shows when that status was last verified.
//
// Why guard last_health_check:
//   - Per-row: discloses when ToolRoute last touched each upstream.
//     Stale timestamps reveal which integrations the health
//     pipeline has stopped probing (silent integration rot signal).
//   - Combined with health_status it answers "is this provider
//     down right now, or has it been down for a week?". Aggregated
//     it leaks the cadence of ToolRoute's health-check infrastructure.
//   - Background health checks are the only writer; admin UI is
//     the only reader. No request-time gateway dependency.
//
// Today's read surface is exactly 1 file:
//
//   - src/app/api/admin/providers/route.ts (line ~175) —
//       Admin-gated GET (validateAdmin upstream). Sole reader.
//       No write-side body parsing in admin/providers — the
//       column is updated by background health checks (out of
//       scope for projection guards).
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('tool_providers').select('… last_health_check …')`
//      outside the allow-list.
//   2. `.returns<{ last_health_check: … }>()` generic outside
//      the allow-list.
//   3. Raw SQL `SELECT … last_health_check … FROM tool_providers`
//      anywhere in src/.
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards on tool_providers (health-fingerprint cluster):
//   - 4.194 (health_status — paired)
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

// Files allowed to SELECT `last_health_check` from `tool_providers`.
// Each entry has a real reason — see lane comment above.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/app/api/admin/providers/route.ts",
]);

describe("Lane 4.195 — tool_providers.last_health_check SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT last_health_check from tool_providers", () => {
    const re =
      /\.from\(\s*["']tool_providers["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\blast_health_check\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare last_health_check in a tool_providers .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']tool_providers["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\blast_health_check\b/;
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

  it("no raw SQL SELECT last_health_check FROM tool_providers in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\blast_health_check\b[\s\S]*?\bFROM\s+tool_providers\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
