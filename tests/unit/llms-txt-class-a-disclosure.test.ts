// Lane 4.109 — drift-prevention test for `public/llms-full.txt`.
//
// `public/llms-full.txt` is a public discovery file consumed by AI agents.
// The file lists each adapter under a `### N. <slug> -- <title>` header, with
// a one-line BYOK posture immediately below. AI agents reading this file are
// aggressively literal — they treat "BYOK: Yes" as "BYOK is one option" and
// proceed to call without registering their own provider key.
//
// For Class-A providers (BYOK_REQUIRED_SLUGS), pool routing violates provider
// ToS. The header line MUST contain a "BYOK required" qualifier so agents
// understand they have to register their own key.
//
// This test parses public/llms-full.txt, finds every adapter section header,
// and asserts the line immediately below contains the right BYOK qualifier
// for the slug's tier in src/lib/byok-required-slugs.ts.
//
// Cross-refs:
//   .agent/lane-4.109-llms-txt-class-a-and-encryption-drift.md
//   src/lib/byok-required-slugs.ts (single source of truth for tiering)
//   tests/unit/class-a-and-encryption-claim-drift.test.ts (sibling pattern,
//     covers `<slug>/<op>` references in code-block-style prose)
//   Hard Rule #59 — failing-snapshot test as drift TODO list

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BYOK_REQUIRED_SLUGS,
  BYOK_INSUFFICIENT_SLUGS,
} from "../../src/lib/byok-required-slugs";

const LLMS_FULL = resolve(process.cwd(), "public/llms-full.txt");

interface AdapterSection {
  slug: string;
  headerLine: number;
  qualifierLine: string;
}

function parseAdapterSections(source: string): AdapterSection[] {
  const lines = source.split("\n");
  const headerRe = /^### (\d+)\. ([a-z][a-z0-9_-]*)\b/;
  const sections: AdapterSection[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = headerRe.exec(lines[i]);
    if (!m) continue;
    const slug = m[2];
    const qualifier = lines[i + 1] ?? "";
    sections.push({ slug, headerLine: i + 1, qualifierLine: qualifier });
  }
  return sections;
}

describe("llms-full.txt Class-A disclosure (Lane 4.109)", () => {
  const source = readFileSync(LLMS_FULL, "utf8");
  const sections = parseAdapterSections(source);

  it("parses adapter section headers (sanity check)", () => {
    expect(sections.length).toBeGreaterThan(20);
  });

  it("every BYOK_REQUIRED slug header has a 'BYOK required' qualifier on the next line", () => {
    const drifts: string[] = [];
    for (const section of sections) {
      if (!BYOK_REQUIRED_SLUGS.has(section.slug)) continue;
      const ok = /BYOK required/i.test(section.qualifierLine);
      if (!ok) {
        drifts.push(
          `line ${section.headerLine}: "${section.slug}" — qualifier "${section.qualifierLine}" missing "BYOK required"`,
        );
      }
    }
    expect(
      drifts,
      `\n${drifts.length} Class-A slug(s) in llms-full.txt missing the "BYOK required" qualifier:\n${drifts.join("\n")}\n\nClass-A providers cannot be served via master pool per ToS (Lane 4.100, 4.102, 6.14). The line immediately below each '### N. <slug>' header must contain "BYOK required" so agents understand to register their own provider key.\n`,
    ).toEqual([]);
  });

  it("every BYOK_INSUFFICIENT slug header carries either 'BYOK required' or 'BYOK insufficient'", () => {
    const drifts: string[] = [];
    for (const section of sections) {
      if (!BYOK_INSUFFICIENT_SLUGS.has(section.slug)) continue;
      const ok = /BYOK (required|insufficient)/i.test(section.qualifierLine);
      if (!ok) {
        drifts.push(
          `line ${section.headerLine}: "${section.slug}" — qualifier "${section.qualifierLine}" missing "BYOK required" or "BYOK insufficient"`,
        );
      }
    }
    expect(drifts).toEqual([]);
  });

  it("AES-256 / encryption-at-rest claims still ride a roadmap qualifier (Codex ticket #52)", () => {
    // Sibling pattern to tests/unit/class-a-and-encryption-claim-drift.test.ts
    // — narrowed to llms-full.txt for fast targeted feedback. Until Codex #52
    // ships, any "AES-256" claim in this file must be co-located with a
    // roadmap qualifier within 200 chars.
    const QUALIFIERS = [
      "Codex ticket #52",
      "in active development",
      "on the security roadmap",
      "is planned",
      "currently stored with",
    ];
    const re = /AES-?256/gi;
    const hits: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(source)) !== null) {
      const start = Math.max(0, m.index - 200);
      const end = Math.min(source.length, m.index + m[0].length + 200);
      const ctx = source.slice(start, end);
      if (!QUALIFIERS.some((q) => ctx.includes(q))) {
        const line = source.slice(0, m.index).split("\n").length;
        hits.push(`line ${line}: "${m[0]}" without roadmap qualifier`);
      }
    }
    expect(hits).toEqual([]);
  });
});
