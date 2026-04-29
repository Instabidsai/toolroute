import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Lane 6.10 — drift guard for /dashboard/providers customer-facing copy.
//
// /dashboard/providers shows each provider with `type: "pool" | "byok" | "free"`.
// "pool" tells the customer ToolRoute covers that provider's calls.
// Lane 6.7 verified 30 providers as BYOK_REQUIRED (master-pool routing = direct
// ToS breach) + 1 BYOK_INSUFFICIENT (apollo). Showing those as `type: "pool"`
// makes a customer-facing claim the runtime gate (Codex Lane 6.5-impl) will
// reject — Hard Rule #57 violation in the making.
//
// This test source-walks .agent/lane-6.7-verified-byok-slug-list.md (BYOK truth)
// and src/app/dashboard/providers/page.tsx (PROVIDERS array). No runtime imports.
// Failures are the explicit fix list for the next dashboard PR.
//
// Gated behind an env var so CI stays green while sibling lanes ship — flip
// off when actively reducing the offender list:
//   DASHBOARD_TIER_DRIFT_BASELINE=skip   (default state in CI today)

const SHOULD_RUN = process.env.DASHBOARD_TIER_DRIFT_BASELINE !== "skip";

const DASHBOARD_PATH = resolve(
  process.cwd(),
  "src/app/dashboard/providers/page.tsx"
);
const LANE_6_7_PATH = resolve(
  process.cwd(),
  ".agent/lane-6.7-verified-byok-slug-list.md"
);

interface ProviderEntry {
  slug: string;
  type: "pool" | "byok" | "free";
}

function parseDashboardProviders(): ProviderEntry[] {
  const src = readFileSync(DASHBOARD_PATH, "utf-8");
  const arrMatch = src.match(
    /const\s+PROVIDERS\s*:\s*Provider\[\]\s*=\s*\[([\s\S]*?)\];/m
  );
  if (!arrMatch) {
    throw new Error("PROVIDERS array not found in dashboard/providers/page.tsx");
  }
  const body = arrMatch[1];
  const out: ProviderEntry[] = [];
  const re = /slug:\s*"([a-z0-9-]+)"[^}]*?type:\s*"(pool|byok|free)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    out.push({ slug: m[1], type: m[2] as ProviderEntry["type"] });
  }
  return out;
}

function extractSlugsFromBlock(markdown: string, setName: string): Set<string> {
  const re = new RegExp(
    `const\\s+${setName}\\s*=\\s*new\\s+Set\\(\\[([\\s\\S]*?)\\]\\);`,
    "m"
  );
  const match = markdown.match(re);
  if (!match) {
    throw new Error(`Lane 6.7 markdown missing Set: ${setName}`);
  }
  const body = match[1];
  const slugs = new Set<string>();
  const slugTok = /"([a-z0-9-]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = slugTok.exec(body)) !== null) {
    slugs.add(m[1]);
  }
  return slugs;
}

describe.skipIf(!SHOULD_RUN)("Lane 6.10 — /dashboard/providers tier copy matches Lane 6.7 BYOK verdict", () => {
  const providers = parseDashboardProviders();
  const lane67 = readFileSync(LANE_6_7_PATH, "utf-8");
  const BYOK_REQUIRED = extractSlugsFromBlock(lane67, "BYOK_REQUIRED_SLUGS");
  const BYOK_INSUFFICIENT = extractSlugsFromBlock(
    lane67,
    "BYOK_INSUFFICIENT_SLUGS"
  );

  it("dashboard PROVIDERS array parses with at least 20 entries", () => {
    expect(providers.length).toBeGreaterThanOrEqual(20);
  });

  it("Lane 6.7 BYOK_REQUIRED Set non-empty", () => {
    expect(BYOK_REQUIRED.size).toBeGreaterThan(0);
  });

  it("no BYOK_REQUIRED slug is shown as type:pool to customers", () => {
    const offenders = providers
      .filter((p) => p.type === "pool" && BYOK_REQUIRED.has(p.slug))
      .map((p) => p.slug);
    // Hard Rule #59 — failing snapshot test as drift TODO list.
    // Each slug listed is a customer-facing claim the BYOK runtime gate
    // (Codex Lane 6.5-impl) will reject as 402. Either:
    //   (a) flip type to "byok" in dashboard/providers/page.tsx, or
    //   (b) reclassify the slug in .agent/lane-6.7-verified-byok-slug-list.md
    //       after getting written authorization from the provider.
    expect(offenders).toEqual([]);
  });

  it("no BYOK_INSUFFICIENT slug is shown as type:pool to customers", () => {
    // BYOK_INSUFFICIENT = adapter should not be a customer-facing offering at
    // all (apollo §3(g)(1) bans even BYOK passthrough). type:pool is the
    // worst possible classification.
    const offenders = providers
      .filter((p) => p.type === "pool" && BYOK_INSUFFICIENT.has(p.slug))
      .map((p) => p.slug);
    expect(offenders).toEqual([]);
  });
});
