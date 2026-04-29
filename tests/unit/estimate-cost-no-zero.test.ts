import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";

// Lane 4.51 — defense-in-depth drift guard for estimateCost bypasses.
//
// Why: gateway.ts:227-238 only enforces the credit-balance gate when
// `estimatedCost > 0`. Any adapter returning literal 0 from
// estimateCost short-circuits the gate — a $0-credit key can call the
// op without a balance check. For free upstream ops this is a DoS
// amplifier (we still pay infra rate); for any future paid op someone
// adds via copy-paste of a `return 0` line it's a real COGS bypass.
//
// Fix: every adapter must return at least a "free-tier ping cost"
// (>0) so the balance gate always fires. The four legitimately-free
// upstream ops below are allowlisted with explicit justification.
//
// To extend: add `<adapter-slug>:<operation>` to ALLOWLIST with a
// comment justifying *why* the upstream is free. A drift PR adding a
// new `return 0` will fail CI and force the discussion.

const ADAPTERS_DIR = join(process.cwd(), "src/lib/adapters");

// Allowlist of (adapter slug, operation) pairs that may legitimately
// `return 0`. Each entry MUST cite the upstream reason.
const ALLOWLIST = new Set([
  // Higgsfield catalog read — public, free per provider docs.
  "higgsfield:list-models",
  // OpenAI omni-moderation API — officially free per OpenAI pricing.
  "openai:moderation",
  // Replicate public model catalog — free per Replicate docs.
  "replicate:list-models",
  // Textbelt status endpoint — free per Textbelt docs.
  "textbelt:check-status",
]);

interface ZeroReturn {
  file: string;
  adapterSlug: string;
  operation: string | null; // null = unconditional `return 0`
  line: number;
}

function adapterSlugFromFilename(name: string): string {
  // claude-adapter.ts → claude
  return name.replace(/-adapter\.ts$/, "");
}

function findZeroReturns(content: string, file: string): ZeroReturn[] {
  const out: ZeroReturn[] = [];
  const slug = adapterSlugFromFilename(basename(file));

  // Find the estimateCost block. Match from `estimateCost(` to the
  // matching closing `}` of its arrow/method body. We use a simple
  // brace counter starting at the first `{` after the signature.
  const sigMatch = /estimateCost\s*\([^)]*\)\s*:\s*number\s*\{/.exec(content);
  if (!sigMatch) return out;
  const startIdx = sigMatch.index + sigMatch[0].length;

  let depth = 1;
  let endIdx = startIdx;
  for (let i = startIdx; i < content.length; i++) {
    const c = content[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        endIdx = i;
        break;
      }
    }
  }

  const body = content.slice(startIdx, endIdx);
  // Compute base line number for the body (line of the `{` after sig).
  const baseLine = content.slice(0, startIdx).split("\n").length;

  const lines = body.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Conditional: `if (operation === "X") return 0;` on one line
    const condMatch =
      /if\s*\(\s*operation\s*===\s*['"`]([a-zA-Z0-9_\-]+)['"`]\s*\)\s*return\s+0(?:\.0+)?\s*;/.exec(
        line
      );
    if (condMatch) {
      out.push({
        file,
        adapterSlug: slug,
        operation: condMatch[1],
        line: baseLine + i,
      });
      continue;
    }

    // Unconditional: `return 0;` (no operation guard on same line)
    if (/^\s*return\s+0(?:\.0+)?\s*;/.test(line)) {
      out.push({
        file,
        adapterSlug: slug,
        operation: null,
        line: baseLine + i,
      });
    }
  }

  return out;
}

describe("adapter `estimateCost` must not `return 0` (Lane 4.51)", () => {
  it("every `return 0` in adapter estimateCost is allowlisted with a justification", () => {
    const files = readdirSync(ADAPTERS_DIR)
      .filter((n) => n.endsWith("-adapter.ts"))
      .map((n) => join(ADAPTERS_DIR, n));

    const violations: ZeroReturn[] = [];

    for (const file of files) {
      const content = readFileSync(file, "utf8");
      for (const hit of findZeroReturns(content, file)) {
        const key =
          hit.operation === null
            ? `${hit.adapterSlug}:*`
            : `${hit.adapterSlug}:${hit.operation}`;
        if (!ALLOWLIST.has(key)) {
          violations.push(hit);
        }
      }
    }

    expect(
      violations,
      `\nLane 4.51: ${violations.length} adapter(s) return 0 from estimateCost without allowlist entry.\n\n` +
        `Why this matters: gateway.ts:227 gates execution on \`creditBalance < estimatedCost && estimatedCost > 0\`. ` +
        `A return-0 short-circuits the balance check — \$0-credit keys can call the op.\n\n` +
        `Fix:\n` +
        `  1. If the upstream op is genuinely free, add \`<slug>:<operation>\` to ALLOWLIST with justification, OR\n` +
        `  2. Replace \`return 0\` with \`return 0.0001\` (free-tier ping cost) so the balance gate fires.\n\n` +
        `Violations:\n` +
        violations
          .map(
            (v) =>
              `  - ${v.file}:${v.line}  ${v.adapterSlug}:${v.operation ?? "*"}`
          )
          .join("\n")
    ).toEqual([]);
  });
});
