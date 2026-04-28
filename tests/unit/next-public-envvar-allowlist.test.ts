import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC_ROOT = join(process.cwd(), "src");

// Vars intentionally exposed to the client bundle. Adding to this set is a
// review checkpoint: justify why public exposure is safe before extending.
// See .agent/lane-4.42-next-public-envvar-audit.md for rationale.
const ALLOWED = new Set([
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
]);

const REFERENCE_RE = /process\.env\.(NEXT_PUBLIC_[A-Z0-9_]+)/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      walk(path, out);
    } else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(name)) {
      out.push(path);
    }
  }
  return out;
}

describe("NEXT_PUBLIC_* envvar allowlist (Lane 4.42)", () => {
  it("every NEXT_PUBLIC_* reference in src/ is in the allowlist", () => {
    const violations: { file: string; varName: string }[] = [];
    for (const file of walk(SRC_ROOT)) {
      const content = readFileSync(file, "utf8");
      for (const match of content.matchAll(REFERENCE_RE)) {
        const varName = match[1];
        if (!ALLOWED.has(varName)) {
          violations.push({
            file: relative(process.cwd(), file),
            varName,
          });
        }
      }
    }
    expect(
      violations,
      `\nLEAK: NEXT_PUBLIC_* references in src/ that are not on the allowlist.\n` +
        `Anything prefixed NEXT_PUBLIC_ is inlined into the client bundle and visible\n` +
        `to every visitor — provider API keys, signing secrets, service-role JWTs etc.\n` +
        `MUST NOT be NEXT_PUBLIC_*.\n\n` +
        `Violations:\n` +
        violations
          .map((v) => `  - ${v.varName} in ${v.file}`)
          .join("\n") +
        `\n\nFix:\n` +
        `  - If genuinely public (URLs, publishable keys): add to ALLOWED set with rationale.\n` +
        `  - If secret: rename to non-NEXT_PUBLIC_* and read server-side only.\n`
    ).toEqual([]);
  });
});
