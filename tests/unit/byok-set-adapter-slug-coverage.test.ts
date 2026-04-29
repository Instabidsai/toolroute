import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  BYOK_REQUIRED_SLUGS,
  BYOK_INSUFFICIENT_SLUGS,
  AMBIGUOUS_DEFAULT_BYOK_SLUGS,
  TOOLROUTE_INTERNAL_SLUGS,
} from "@/lib/byok-required-slugs";

// Lane 4.112 — drift guard.
// The Lane 6.7 parity test (byok-slug-list-parity.test.ts) guards Set ↔ markdown
// drift. This test guards Set ↔ adapter-export-slug drift — exactly the gap
// surfaced by .agent/lane-4.112-byok-set-slug-mismatch.md.
//
// Two adapters historically had drift: image-gen-adapter.ts exports slug:"image"
// while the Set had "image-gen", and deepl-adapter.ts exports slug:"translate"
// while the Set had "deepl". After Codex #23 wires
// `BYOK_REQUIRED_SLUGS.has(toolSlug)`, any unmatched slug silently bypasses the
// BYOK gate. This test fails CI before that can ship.
//
// Source-file regex parser (NOT runtime import) — registry imports often pull
// in createClient() and crash without prod env (memory feedback rule #59).

const ADAPTERS_DIR = resolve(process.cwd(), "src/lib/adapters");

function extractAdapterSlugs(): Set<string> {
  const files = readdirSync(ADAPTERS_DIR).filter((f) => f.endsWith("-adapter.ts"));
  const slugs = new Set<string>();
  // Match the canonical `slug: "xyz",` line at exactly 2-space indent inside an
  // exported adapter block. Excludes nested `slug: a.slug` and `slug: t.tool_slug`
  // forms used internally by auto-adapter.ts + toolroute-adapter.ts dispatch.
  const re = /^[ ]{2}slug:\s*"([a-z0-9-]+)",/m;
  for (const file of files) {
    const src = readFileSync(resolve(ADAPTERS_DIR, file), "utf-8");
    const m = src.match(re);
    if (!m) {
      throw new Error(`Adapter ${file} has no canonical slug export`);
    }
    slugs.add(m[1]);
  }
  return slugs;
}

describe("Lane 4.112 — BYOK Set entries match adapter exported slugs", () => {
  const adapterSlugs = extractAdapterSlugs();

  it("BYOK_REQUIRED_SLUGS ⊆ adapter exports (no runtime-gate bypass)", () => {
    const missing = [...BYOK_REQUIRED_SLUGS].filter((s) => !adapterSlugs.has(s));
    expect(missing).toEqual([]);
  });

  it("BYOK_INSUFFICIENT_SLUGS ⊆ adapter exports", () => {
    const missing = [...BYOK_INSUFFICIENT_SLUGS].filter(
      (s) => !adapterSlugs.has(s)
    );
    expect(missing).toEqual([]);
  });

  it("AMBIGUOUS_DEFAULT_BYOK_SLUGS ⊆ adapter exports", () => {
    const missing = [...AMBIGUOUS_DEFAULT_BYOK_SLUGS].filter(
      (s) => !adapterSlugs.has(s)
    );
    expect(missing).toEqual([]);
  });

  it("TOOLROUTE_INTERNAL_SLUGS ⊆ adapter exports", () => {
    const missing = [...TOOLROUTE_INTERNAL_SLUGS].filter(
      (s) => !adapterSlugs.has(s)
    );
    expect(missing).toEqual([]);
  });

  it("every adapter slug is classified into exactly one tier (no gaps, no dupes)", () => {
    const classified = new Set<string>([
      ...BYOK_REQUIRED_SLUGS,
      ...BYOK_INSUFFICIENT_SLUGS,
      ...AMBIGUOUS_DEFAULT_BYOK_SLUGS,
      ...TOOLROUTE_INTERNAL_SLUGS,
    ]);
    const unclassified = [...adapterSlugs].filter((s) => !classified.has(s));
    expect(unclassified).toEqual([]);
    // Mirror: ensure no Set entry references a slug that no adapter exports.
    const orphaned = [...classified].filter((s) => !adapterSlugs.has(s));
    expect(orphaned).toEqual([]);
  });
});
