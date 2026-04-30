import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.194 — drift guard: tool_providers.health_status
// SELECT-projection allow-list.
//
// `tool_providers.health_status` is the rolling per-provider
// health label ("healthy", "degraded", "down") that the admin UI
// renders next to each upstream. It's the customer-facing summary
// of recent error_rate_24h + last_health_check observations.
//
// Why guard health_status:
//   - Per-row: discloses operational status of each upstream
//     vendor relationship. Aggregate gives competitor a real-time
//     view of which ToolRoute integrations are flaky.
//   - Combined with avg_latency_ms (next lane) + error_rate_24h
//     it's a rich operational-fingerprint signal: "ToolRoute's
//     OpenAI integration is healthy with 200ms avg latency,
//     RapidAPI - X is degraded at 12% errors" — enough to time
//     competitive launches against ToolRoute's outages.
//   - Runtime gateway does NOT consult health_status for routing
//     today; admin UI is the sole reader.
//
// Today's read surface is exactly 1 file:
//
//   - src/app/api/admin/providers/route.ts (line ~175) —
//       Admin-gated GET (validateAdmin upstream). Sole reader.
//       This column has NO write-side body parsing in
//       admin/providers — it's updated by background health
//       checks (out of scope for projection guards).
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('tool_providers').select('… health_status …')`
//      outside the allow-list.
//   2. `.returns<{ health_status: … }>()` generic outside the
//      allow-list.
//   3. Raw SQL `SELECT … health_status … FROM tool_providers`
//      anywhere in src/.
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards on tool_providers (operational-fingerprint cluster):
//   - 4.144 (auth_key_encrypted)
//   - 4.186-4.193 (cost / auth / vendor metadata)

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

// Files allowed to SELECT `health_status` from `tool_providers`.
// Each entry has a real reason — see lane comment above.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/app/api/admin/providers/route.ts",
]);

describe("Lane 4.194 — tool_providers.health_status SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT health_status from tool_providers", () => {
    const re =
      /\.from\(\s*["']tool_providers["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\bhealth_status\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare health_status in a tool_providers .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']tool_providers["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\bhealth_status\b/;
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

  it("no raw SQL SELECT health_status FROM tool_providers in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\bhealth_status\b[\s\S]*?\bFROM\s+tool_providers\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
