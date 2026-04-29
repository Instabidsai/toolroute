import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  BYOK_REQUIRED_SLUGS,
  BYOK_INSUFFICIENT_SLUGS,
  AMBIGUOUS_DEFAULT_BYOK_SLUGS,
  TOOLROUTE_INTERNAL_SLUGS,
  classifyByokTier,
} from "@/lib/byok-required-slugs";

// Lane 6.8.1 — drift guard.
// Asserts src/lib/byok-required-slugs.ts matches the Lane 6.7 markdown
// source-of-truth. If Lane 6.6 v3 audit moves a provider between tiers,
// this test fails until the TS module is updated to match.

const LANE_6_7_PATH = resolve(
  process.cwd(),
  ".agent/lane-6.7-verified-byok-slug-list.md"
);

function extractSlugsFromBlock(
  markdown: string,
  setName: string
): string[] {
  // Match `const SET_NAME = new Set([ ... ]);` block in the first code fence
  // that declares the named Set. The Lane 6.7 doc declares each Set exactly
  // once inside the ```ts ... ``` block beginning at "Code-ready Set".
  const re = new RegExp(
    `const\\s+${setName}\\s*=\\s*new\\s+Set\\(\\[([\\s\\S]*?)\\]\\);`,
    "m"
  );
  const match = markdown.match(re);
  if (!match) {
    throw new Error(`Lane 6.7 markdown missing Set: ${setName}`);
  }
  const body = match[1];
  const slugs: string[] = [];
  // Match every quoted slug — handles both block-form (each on its own line
  // with trailing comma) and inline-form (e.g. `["auto", "toolroute"]`).
  const slugTok = /"([a-z0-9-]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = slugTok.exec(body)) !== null) {
    slugs.push(m[1]);
  }
  return slugs;
}

describe("Lane 6.8.1 — BYOK slug data module parity with Lane 6.7 source-of-truth", () => {
  const markdown = readFileSync(LANE_6_7_PATH, "utf-8");

  it("BYOK_REQUIRED_SLUGS matches Lane 6.7 markdown", () => {
    const docSlugs = extractSlugsFromBlock(markdown, "BYOK_REQUIRED_SLUGS");
    expect(docSlugs.length).toBeGreaterThan(0);
    const codeSlugs = [...BYOK_REQUIRED_SLUGS].sort();
    expect(codeSlugs).toEqual([...docSlugs].sort());
  });

  it("BYOK_INSUFFICIENT_SLUGS matches Lane 6.7 markdown", () => {
    const docSlugs = extractSlugsFromBlock(markdown, "BYOK_INSUFFICIENT_SLUGS");
    expect(docSlugs.length).toBeGreaterThan(0);
    const codeSlugs = [...BYOK_INSUFFICIENT_SLUGS].sort();
    expect(codeSlugs).toEqual([...docSlugs].sort());
  });

  it("AMBIGUOUS_DEFAULT_BYOK_SLUGS matches Lane 6.7 markdown", () => {
    const docSlugs = extractSlugsFromBlock(
      markdown,
      "AMBIGUOUS_DEFAULT_BYOK_SLUGS"
    );
    expect(docSlugs.length).toBeGreaterThan(0);
    const codeSlugs = [...AMBIGUOUS_DEFAULT_BYOK_SLUGS].sort();
    expect(codeSlugs).toEqual([...docSlugs].sort());
  });

  it("TOOLROUTE_INTERNAL_SLUGS matches Lane 6.7 markdown", () => {
    const docSlugs = extractSlugsFromBlock(markdown, "TOOLROUTE_INTERNAL_SLUGS");
    expect(docSlugs.length).toBeGreaterThan(0);
    const codeSlugs = [...TOOLROUTE_INTERNAL_SLUGS].sort();
    expect(codeSlugs).toEqual([...docSlugs].sort());
  });

  it("Lane 6.7 verified count = 49 gated slugs (30 required + 1 insufficient + 18 ambiguous)", () => {
    expect(BYOK_REQUIRED_SLUGS.size).toBe(30);
    expect(BYOK_INSUFFICIENT_SLUGS.size).toBe(1);
    expect(AMBIGUOUS_DEFAULT_BYOK_SLUGS.size).toBe(18);
    expect(
      BYOK_REQUIRED_SLUGS.size +
        BYOK_INSUFFICIENT_SLUGS.size +
        AMBIGUOUS_DEFAULT_BYOK_SLUGS.size
    ).toBe(49);
  });

  it("no slug appears in more than one tier", () => {
    const all = [
      ...BYOK_REQUIRED_SLUGS,
      ...BYOK_INSUFFICIENT_SLUGS,
      ...AMBIGUOUS_DEFAULT_BYOK_SLUGS,
      ...TOOLROUTE_INTERNAL_SLUGS,
    ];
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const s of all) {
      if (seen.has(s)) dupes.push(s);
      seen.add(s);
    }
    expect(dupes).toEqual([]);
  });

  it("classifyByokTier returns the right tier for known slugs", () => {
    expect(classifyByokTier("claude")).toBe("required");
    expect(classifyByokTier("apollo")).toBe("insufficient");
    expect(classifyByokTier("openai")).toBe("ambiguous");
    expect(classifyByokTier("auto")).toBe("internal");
    expect(classifyByokTier("toolroute")).toBe("internal");
    expect(classifyByokTier("nonexistent-slug")).toBeNull();
  });
});
