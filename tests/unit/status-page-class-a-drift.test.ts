import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  BYOK_REQUIRED_SLUGS,
  BYOK_INSUFFICIENT_SLUGS,
} from "@/lib/byok-required-slugs";

// Lane 4.111-impl drift guard.
// Sibling to tests/unit/byok-set-adapter-slug-coverage.test.ts (Lane 4.112).
// That test guards Set ↔ adapter-export-slug drift; this one guards Set ↔
// /status page presentation drift.
//
// Pre-fix state (caught by audit): src/app/status/page.tsx labeled 11 Class-A
// providers (claude, elevenlabs, sendgrid, resend, supabase, stripe, deepl,
// replicate, postiz, context7, unsplash) as keyType:"pool"/"free" — claiming
// master-pool routing the providers' ToS forbid. Plus 2 slug aliases (deepl,
// image-gen) that didn't match adapter exports (translate, image).
//
// Source-file regex parser — same approach as Lane 4.112 (memory rule #59).

const STATUS_PAGE = resolve(process.cwd(), "src/app/status/page.tsx");
const ADAPTERS_DIR = resolve(process.cwd(), "src/lib/adapters");

interface StatusEntry {
  slug: string;
  keyType: "free" | "pool" | "byok";
}

function extractStatusEntries(): StatusEntry[] {
  const src = readFileSync(STATUS_PAGE, "utf-8");
  const re =
    /\{\s*slug:\s*"([a-z0-9-]+)",\s*name:\s*"[^"]+",\s*category:\s*"[^"]+",\s*keyType:\s*"(free|pool|byok)"/g;
  const out: StatusEntry[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    out.push({ slug: m[1], keyType: m[2] as StatusEntry["keyType"] });
  }
  if (out.length === 0) {
    throw new Error("No ADAPTERS entries parsed from src/app/status/page.tsx");
  }
  return out;
}

function extractAdapterSlugs(): Set<string> {
  const files = readdirSync(ADAPTERS_DIR).filter((f) => f.endsWith("-adapter.ts"));
  const slugs = new Set<string>();
  const re = /^[ ]{2}slug:\s*"([a-z0-9-]+)",/m;
  for (const file of files) {
    const src = readFileSync(resolve(ADAPTERS_DIR, file), "utf-8");
    const m = src.match(re);
    if (!m) throw new Error(`Adapter ${file} has no canonical slug export`);
    slugs.add(m[1]);
  }
  return slugs;
}

describe("Lane 4.111-impl — /status page Class-A drift guard", () => {
  const entries = extractStatusEntries();
  const adapterSlugs = extractAdapterSlugs();

  it("no Class-A slug is shown as keyType=pool or keyType=free", () => {
    const violations = entries.filter(
      (e) =>
        (e.keyType === "pool" || e.keyType === "free") &&
        (BYOK_REQUIRED_SLUGS.has(e.slug) || BYOK_INSUFFICIENT_SLUGS.has(e.slug))
    );
    expect(violations).toEqual([]);
  });

  it("every status page slug matches an adapter export", () => {
    const orphans = entries.filter((e) => !adapterSlugs.has(e.slug));
    expect(orphans.map((o) => o.slug)).toEqual([]);
  });

  it("status page has no duplicate slug entries", () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const e of entries) {
      if (seen.has(e.slug)) dupes.push(e.slug);
      seen.add(e.slug);
    }
    expect(dupes).toEqual([]);
  });
});
