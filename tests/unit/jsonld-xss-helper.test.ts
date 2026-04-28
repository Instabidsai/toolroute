import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { safeJsonLd } from "../../src/lib/json-ld";

// Walk src/ and assert no JSON-LD <script> uses raw JSON.stringify in
// dangerouslySetInnerHTML. JSON.stringify does NOT escape "<", so any
// DB-controllable string containing "</script>" terminates the script
// element early and ships stored DOM XSS. Use safeJsonLd() instead.
//
// Detection rule: literal substring `dangerouslySetInnerHTML={{ __html: JSON.stringify(`
// anywhere in src/. The fix is a one-token swap to `safeJsonLd(`.

const SRC_ROOT = join(process.cwd(), "src");
const VIOLATING_PATTERN = /dangerouslySetInnerHTML\s*=\s*\{\{\s*__html\s*:\s*JSON\.stringify\(/;

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === "node_modules" || name === ".next") continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      walk(path, out);
    } else if (/\.(ts|tsx|jsx|js)$/.test(name)) {
      out.push(path);
    }
  }
  return out;
}

describe("JSON-LD XSS helper (Lane 4.46)", () => {
  it("safeJsonLd escapes </script> so the HTML tokenizer can't terminate the script body early", () => {
    const evil = { name: "</script><img src=x onerror=alert(1)>" };
    const escaped = safeJsonLd(evil);
    expect(escaped).not.toMatch(/<\/script/i);
    expect(escaped).not.toContain("<");
    expect(escaped).not.toContain(">");
    // Round-trip: a JSON parser decodes \u003c back to <, so consumers
    // (Google, schema.org validators) still see the original payload.
    expect(JSON.parse(escaped)).toEqual(evil);
  });

  it("safeJsonLd escapes & so HTML entity decoding can't be abused either", () => {
    const escaped = safeJsonLd({ x: "a & b" });
    expect(escaped).not.toContain("&");
    expect(JSON.parse(escaped)).toEqual({ x: "a & b" });
  });

  it("no source file uses raw JSON.stringify inside dangerouslySetInnerHTML", () => {
    const violations: { file: string; line: number; text: string }[] = [];
    for (const file of walk(SRC_ROOT)) {
      const content = readFileSync(file, "utf8");
      if (!VIOLATING_PATTERN.test(content)) continue;
      const lines = content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        if (VIOLATING_PATTERN.test(lines[i])) {
          violations.push({
            file: relative(process.cwd(), file),
            line: i + 1,
            text: lines[i].trim().slice(0, 200),
          });
        }
      }
    }
    expect(
      violations,
      `\nLEAK: ${violations.length} JSON-LD injection site(s) bypass safeJsonLd().\n` +
        `Browsers don't execute application/ld+json as JS, but the HTML tokenizer\n` +
        `still terminates the <script> on any literal "</script>" inside the body.\n` +
        `If any string in the payload comes from the DB (tool.name, etc.), a writer\n` +
        `who can land "</script><img src=x onerror=...>" ships stored DOM XSS.\n\n` +
        `Violations:\n` +
        violations
          .map((v) => `  - ${v.file}:${v.line}\n      ${v.text}`)
          .join("\n") +
        `\n\nFix:\n` +
        `  import { safeJsonLd } from "@/lib/json-ld";\n` +
        `  <script\n` +
        `    type="application/ld+json"\n` +
        `    dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}\n` +
        `  />\n`
    ).toEqual([]);
  });
});
