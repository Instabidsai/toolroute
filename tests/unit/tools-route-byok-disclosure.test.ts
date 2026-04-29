// Lane 4.111-impl surface 10 — drift-prevention test for the default
// /api/v1/tools catalog format.
//
// Until Lane 4.111-impl-surface-10, the default Supabase catalog format
// (no ?format= query param) returned tools with a raw `description` field
// and NO `byok_required` boolean — even for Class-A providers like
// `claude`, `search`, `image`, `translate`, `elevenlabs` that cannot be
// served via master pool per provider ToS (Lane 4.100, 4.102, 6.14).
//
// The OpenAI/MCP/Anthropic formats (?format=openai|mcp|anthropic) were
// already disclosing via byokSuffix(). The default format was the outlier.
//
// This test is a static-source guard: it parses src/app/api/v1/tools/route.ts
// and asserts the default code path applies BYOK disclosure to each tool
// via withAvailability(). It does NOT spin up a server or call Supabase.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROUTE_PATH = resolve(
  process.cwd(),
  "src/app/api/v1/tools/route.ts",
);

describe("tools-route BYOK disclosure (Lane 4.111 surface 10)", () => {
  const source = readFileSync(ROUTE_PATH, "utf8");

  it("exports a byokRequired() helper backed by BYOK_REQUIRED_SLUGS", () => {
    expect(source).toMatch(/function byokRequired\b/);
    expect(source).toMatch(/BYOK_REQUIRED_SLUGS\.has\(/);
    expect(source).toMatch(/BYOK_INSUFFICIENT_SLUGS\.has\(/);
  });

  it("withAvailability() emits a byok_required field", () => {
    // The function must include a byok_required key in its return shape.
    // We assert against the source rather than runtime to avoid pulling in
    // createClient at test time (sibling pattern to drift tests).
    expect(source).toMatch(/byok_required:\s*isByokRequired/);
  });

  it("withAvailability() appends BYOK suffix to description for Class-A", () => {
    // Lock in that withAvailability calls byokSuffix() against the canonical
    // adapter slug (not tool.id, which may be a per-tool ID like
    // "brave-search" that maps to adapter "search").
    expect(source).toMatch(/byokSuffix\(adapterSlug/);
  });

  it("default catalog responses route through withAvailability()", () => {
    // Both the RPC path and the .from('tools') fallback must run each tool
    // through withAvailability() so the BYOK disclosure is consistent.
    // We count appearances of `withAvailability` regardless of call style
    // (it can appear as `.map(withAvailability)` or `.map((t) => withAvailability({...}))`).
    const occurrences = (source.match(/withAvailability\b/g) ?? []).length;
    // Definition (1) + fallback path .map() (1) + RPC path .map() (1) = 3
    expect(occurrences).toBeGreaterThanOrEqual(3);
  });
});
