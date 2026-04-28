import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// Walk the docs + blog tree and assert no published HMAC/signature verify
// snippet uses raw `===` for the compare. Customer copy-paste = customer
// timing-attack surface, even though our production code is fine.
//
// Detection rule: if a CodeBlock contains both an HMAC construction
// (`createHmac` / `Hmac` / `hash_hmac` / `hmac.new`) AND a string compare
// against the digest using `===` or `==`, fail.

const DOCS_ROOTS = [
  join(process.cwd(), "src", "app", "docs"),
  join(process.cwd(), "src", "app", "blog"),
];

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      walk(path, out);
    } else if (/\.(ts|tsx|md|mdx)$/.test(name)) {
      out.push(path);
    }
  }
  return out;
}

const HMAC_HINT = /createHmac|hash_hmac|hmac\.new|HMAC|Hmac/;
// Lines comparing a "signature"-shaped variable to a digest string.
// Catches `signature === \`sha256=...\`` and `sig == "..."`.
const INSECURE_COMPARE = /\b(sig\w*|signature|hmac|digest)\s*[=!]==/;

describe("timing-safe HMAC compare in docs/blog snippets (Lane 4.44)", () => {
  it("no published HMAC verification snippet uses === for compare", () => {
    const violations: { file: string; line: number; text: string }[] = [];
    for (const root of DOCS_ROOTS) {
      for (const file of walk(root)) {
        const content = readFileSync(file, "utf8");
        if (!HMAC_HINT.test(content)) continue;
        const lines = content.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          if (INSECURE_COMPARE.test(lines[i])) {
            violations.push({
              file: relative(process.cwd(), file),
              line: i + 1,
              text: lines[i].trim().slice(0, 160),
            });
          }
        }
      }
    }
    expect(
      violations,
      `\nLEAK: docs/blog snippet teaches non-constant-time HMAC compare.\n` +
        `Customers will copy this into their webhook handlers and ship a timing\n` +
        `attack surface. Use crypto.timingSafeEqual after a length check.\n\n` +
        `Violations:\n` +
        violations
          .map((v) => `  - ${v.file}:${v.line}\n      ${v.text}`)
          .join("\n") +
        `\n\nFix:\n` +
        `  import { timingSafeEqual } from "crypto";\n` +
        `  const a = Buffer.from(expected); const b = Buffer.from(received);\n` +
        `  if (a.length !== b.length) return false;\n` +
        `  return timingSafeEqual(a, b);\n`
    ).toEqual([]);
  });
});
