import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Lane 4.113 + Codex #23 — failing-snapshot drift test for the auto/route
// Class-A BYOK gate. Source: .agent/lane-4.113-auto-route-byok-gate-bypass.md.
//
// Codex #23 (BYOK runtime gate) will land two complementary gate points:
//
//   1. gateway.ts:238 — primary gate keyed on resolveAdapter(toolPath).slug.
//   2. auto-adapter.ts:~1145 — re-check inside auto.execute() against the
//      *resolved* slug (heuristic-picked, not the literal "auto") so that
//      `tool: "auto/route"` cannot bypass the primary gate by laundering
//      the destination slug through heuristic dispatch.
//
// Today (pre-Codex #23) NEITHER gate exists. Per Hard Rule #59, this test
// fails on master so the swap PR has a green-light signal — and is gated
// behind AUTO_ROUTE_GATE_BASELINE=skip so CI stays green while the rest of
// the queue ships. Flip the env unset → assertions fire.
//
// Source-file regex parser (NOT runtime import) — adapter modules pull in
// createClient/network deps at import time; runtime imports crash without
// prod env (Hard Rule #59 / memory feedback rule #59).
//
// Cross-refs:
//   .agent/lane-4.113-auto-route-byok-gate-bypass.md
//   .agent/lane-4.101-byok-gap-all-gateway-entrypoints.md
//   .agent/lane-4.102-broken-by-design-master-pool-class.md
//   src/lib/byok-required-slugs.ts (the Set the gate keys on)

const SKIP =
  process.env.AUTO_ROUTE_GATE_BASELINE === "skip" ||
  process.env.CODEX_23_BASELINE === "skip";

const GATEWAY_TS = resolve(process.cwd(), "src/lib/gateway.ts");
const AUTO_ADAPTER_TS = resolve(
  process.cwd(),
  "src/lib/adapters/auto-adapter.ts"
);

function read(p: string): string {
  return readFileSync(p, "utf8");
}

describe("Lane 4.113 + Codex #23 — auto/route Class-A BYOK gate", () => {
  if (SKIP) {
    it.skip("skipped (AUTO_ROUTE_GATE_BASELINE=skip — Codex #23 PENDING)", () => {});
    return;
  }

  it("gateway.ts imports BYOK_REQUIRED_SLUGS from byok-required-slugs", () => {
    const src = read(GATEWAY_TS);
    expect(
      src,
      "gateway.ts must import BYOK_REQUIRED_SLUGS to gate adapter.execute() on the resolved slug (Lane 4.101 / Codex #23)"
    ).toMatch(
      /import\s+\{[^}]*\bBYOK_REQUIRED_SLUGS\b[^}]*\}\s+from\s+["'][^"']*byok-required-slugs["']/
    );
  });

  it("gateway.ts gates dispatch on BYOK_REQUIRED_SLUGS.has(...)", () => {
    const src = read(GATEWAY_TS);
    expect(
      src,
      "gateway.ts must call BYOK_REQUIRED_SLUGS.has(...) before adapter.execute() so direct Class-A slugs return 402 byok_required (Codex #23)"
    ).toMatch(/BYOK_REQUIRED_SLUGS\s*\.\s*has\s*\(/);
  });

  it("auto-adapter.ts imports BYOK_REQUIRED_SLUGS", () => {
    const src = read(AUTO_ADAPTER_TS);
    expect(
      src,
      "auto-adapter.ts must import BYOK_REQUIRED_SLUGS to gate dispatch on the *resolved* (heuristic-picked) slug — Lane 4.113 forced-auto-route bypass"
    ).toMatch(
      /import\s+\{[^}]*\bBYOK_REQUIRED_SLUGS\b[^}]*\}\s+from\s+["'][^"']*byok-required-slugs["']/
    );
  });

  it("auto-adapter.ts gates inner dispatch on BYOK_REQUIRED_SLUGS.has(...)", () => {
    const src = read(AUTO_ADAPTER_TS);
    expect(
      src,
      "auto-adapter.ts must call BYOK_REQUIRED_SLUGS.has(...) before adapter.execute() inside heuristic dispatch — closes /api/a2a forced-auto-route bypass (Lane 4.113)"
    ).toMatch(/BYOK_REQUIRED_SLUGS\s*\.\s*has\s*\(/);
  });

  it("auto-adapter.ts BYOK lookup must NOT key on literal 'auto'", () => {
    const src = read(AUTO_ADAPTER_TS);
    // The bypass shape: .eq("tool_slug", "auto") in the BYOK lookup means the
    // user's BYOK rows for the resolved Class-A slug (claude/openai/stripe/...)
    // are never matched. Lane 4.113 fix: lookup on bestMatch.adapterSlug.
    const offenders = src.match(
      /\.eq\s*\(\s*["']tool_slug["']\s*,\s*["']auto["']\s*\)/g
    );
    expect(
      offenders,
      "auto-adapter.ts must NOT look up user_provider_keys with tool_slug='auto' — must use the resolved adapter slug so registered BYOK rows for the Class-A target are honored (Lane 4.113)"
    ).toBeNull();
  });

  it("auto-adapter.ts retains a clear no-BYOK error path keyed on resolved slug", () => {
    const src = read(AUTO_ADAPTER_TS);
    // Lane 4.113 sketch returns metadata.code === "byok_required" with the
    // resolved adapter exposed for client error UX. Allow either string
    // ("byok_required") OR the conventional 402 status surfaced in code.
    expect(
      src,
      "auto-adapter.ts must surface a recognizable byok_required error when heuristic resolves to a Class-A adapter without BYOK (Lane 4.113 sketch)"
    ).toMatch(/byok_required|402/);
  });
});
