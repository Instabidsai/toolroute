import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";

// Lane 4.53 — drift guard for adapter-controlled cost override.
//
// Why: gateway.ts:330 reads `result.actual_cost ?? estimatedCost` and
// bills the user that value. The override path is unbounded. Today no
// adapter populates `actual_cost` — every user pays `estimateCost`,
// which is a known surface (Lane 4.51 locks return-0 there). This test
// locks the runtime side: the moment an adapter starts returning
// `actual_cost`, CI fails and forces a deliberate conversation about
// upper-bounding, logging, and cost-table sync.
//
// To extend: add `<adapter-slug>:<reason>` to ALLOWLIST after the
// gateway has been updated with clamping + cost-table sync.

const ADAPTERS_DIR = join(process.cwd(), "src/lib/adapters");

// Allowlist entries are `<adapter-slug>` strings. Empty by design — no
// adapter currently populates actual_cost. Adding the first entry
// requires a code-review conversation about clamping and sync.
const ALLOWLIST = new Set<string>([
  // (empty)
]);

interface ActualCostHit {
  file: string;
  adapterSlug: string;
  line: number;
  context: string;
}

function adapterSlugFromFilename(name: string): string {
  return name.replace(/-adapter\.ts$/, "");
}

function findActualCostReturns(content: string, file: string): ActualCostHit[] {
  const out: ActualCostHit[] = [];
  const slug = adapterSlugFromFilename(basename(file));

  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Strip line comments and string literals (cheap pass — false-negative
    // on weird quoting is fine; we want false-positives, not silent passes).
    const stripped = line
      .replace(/\/\/.*$/, "")
      .replace(/"[^"]*"/g, '""')
      .replace(/'[^']*'/g, "''");

    // Match `actual_cost:` only as an object key (not in identifiers like
    // `actual_cost_usd:`). Anchor on `,` `{` `(` whitespace before the key.
    if (/(?:^|[\s,{(])actual_cost\s*:/.test(stripped)) {
      out.push({
        file,
        adapterSlug: slug,
        line: i + 1,
        context: line.trim().slice(0, 120),
      });
    }
  }

  return out;
}

describe("adapter results must not populate `actual_cost` (Lane 4.53)", () => {
  it("no adapter file returns `actual_cost` outside the allowlist", () => {
    const files = readdirSync(ADAPTERS_DIR)
      .filter((n) => n.endsWith("-adapter.ts"))
      .map((n) => join(ADAPTERS_DIR, n));

    const violations: ActualCostHit[] = [];

    for (const file of files) {
      const content = readFileSync(file, "utf8");
      for (const hit of findActualCostReturns(content, file)) {
        if (!ALLOWLIST.has(hit.adapterSlug)) {
          violations.push(hit);
        }
      }
    }

    expect(
      violations,
      `\nLane 4.53: ${violations.length} adapter(s) populate \`actual_cost\` without allowlist entry.\n\n` +
        `Why this matters: gateway.ts:330 reads \`result.actual_cost ?? estimatedCost\` and bills the user that value, ` +
        `unbounded. The override path is dead today (no adapter populates it). Adding it without clamping risks: ` +
        `bug-induced overcharge, cost-table desync, or compromised-adapter mint.\n\n` +
        `Before unblocking:\n` +
        `  1. Add upper-bound clamp in gateway.ts (e.g., Math.min(actual_cost, max(estimateCost * 5, 0.01))).\n` +
        `  2. Log when actual_cost > 1.5x estimateCost so spend anomalies surface.\n` +
        `  3. Verify cost-table page does not promise a different price than will be billed.\n` +
        `  4. Then add \`<adapter-slug>\` to ALLOWLIST in this test.\n\n` +
        `Violations:\n` +
        violations
          .map((v) => `  - ${v.file}:${v.line}  ${v.adapterSlug}\n      ${v.context}`)
          .join("\n")
    ).toEqual([]);
  });
});
