import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.138 — drift guard: fetchWithTimeout() coverage across adapters.
//
// Lane 4.72 shipped src/lib/fetch-with-timeout.ts (AbortController-bounded
// fetch with FetchTimeoutError surfacing). Lane 4.72-4.75 wired it through
// 14 adapters (openai, claude, deepgram, elevenlabs, exa, firecrawl,
// hubspot, resend, sendgrid, shippo, stripe, twilio, vapi, whisper).
//
// 35 adapters still call raw `await fetch(...)` with no AbortController +
// no signal: parameter, meaning a hung upstream (provider TLS handshake
// stuck, DNS resolution stalled, slow body) holds a Vercel worker for
// the platform default (~120s) — which:
//   - amplifies upstream-incident blast radius onto our worker pool
//   - leaks COGS via `start_event` rows that never get a `complete_event`
//     (Lane 4.84 audit class)
//   - triggers MaxDuration-exceeded errors that surface to the user as
//     opaque 504s instead of a clean "tool upstream timeout"
//
// This guard is the failing-snapshot drift list (memory rule #59):
// fails on master TODAY with 35 violators; each swap PR (one adapter or a
// batch) shrinks the count; failure list hits zero → remove the SKIP
// constant and the test enforces forever.
//
// Sibling guards: Lane 4.136 (redactCreds coverage), Lane 4.81 (URL-cred
// leak), Lane 4.56 (body-size coverage).
//
// Source-file regex parser (NOT runtime import) — registry imports often
// pull in createClient and crash without prod env (memory rule #59).

const ADAPTERS_DIR = resolve(process.cwd(), "src", "lib", "adapters");

// Excluded from coverage:
//   auto-adapter.ts — meta dispatcher; delegates fetch to inner adapter
//   index.ts        — barrel export; no fetch()
const EXCLUDED = new Set<string>(["auto-adapter.ts", "index.ts"]);

// Env-gate: while the swap PRs ship one batch at a time, CI keeps
// ADAPTER_FETCH_TIMEOUT_BASELINE=skip so the 35 outstanding violators
// don't red-CI sibling-lane PRs. Local: unset to see the live failure
// list. CI: keep skip until the violator count hits zero, then remove
// this constant.
const SKIP = process.env.ADAPTER_FETCH_TIMEOUT_BASELINE === "skip";

function listAdapters(): string[] {
  return readdirSync(ADAPTERS_DIR)
    .filter((f) => {
      if (!f.endsWith(".ts")) return false;
      if (f.endsWith(".test.ts")) return false;
      if (EXCLUDED.has(f)) return false;
      const full = join(ADAPTERS_DIR, f);
      return statSync(full).isFile();
    })
    .sort();
}

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

describe("Lane 4.138 — adapter fetchWithTimeout coverage drift guard", () => {
  if (SKIP) {
    it.skip("skipped (ADAPTER_FETCH_TIMEOUT_BASELINE=skip — set unset to surface 35 outstanding violators)", () => {});
    return;
  }

  const adapters = listAdapters();

  it("at least one adapter exists (sanity)", () => {
    expect(adapters.length).toBeGreaterThan(0);
  });

  it("every adapter using await fetch() imports fetchWithTimeout", () => {
    // Drift class: a new adapter (or a refactor) introduces a raw
    // `await fetch(...)` without going through the timeout-bounded
    // helper. Hung upstream → worker held for platform-default 120s,
    // start_event without complete_event (COGS leak), opaque 504 to
    // user instead of clean tool-upstream-timeout error.
    const violators: string[] = [];
    for (const file of adapters) {
      const full = join(ADAPTERS_DIR, file);
      const cleaned = stripComments(readFileSync(full, "utf-8"));
      const usesRawFetch = /\bawait\s+fetch\s*\(/.test(cleaned);
      if (!usesRawFetch) continue;
      const importsHelper = /\bfetchWithTimeout\b/.test(cleaned);
      if (!importsHelper) violators.push(file);
    }
    expect(violators).toEqual([]);
  });

  it("every adapter calling fetch wraps it via fetchWithTimeout (no raw fetch leftover)", () => {
    // Stronger assertion: importing the helper isn't enough — the
    // helper must actually be called. Catches the partial-swap drift
    // where someone adds the import line but leaves a raw `await
    // fetch(...)` site behind in the same file.
    const violators: string[] = [];
    for (const file of adapters) {
      const full = join(ADAPTERS_DIR, file);
      const cleaned = stripComments(readFileSync(full, "utf-8"));
      // Only enforce on adapters that already import the helper —
      // pure raw-fetch adapters are caught by the previous assertion.
      const importsHelper = /\bfetchWithTimeout\b/.test(cleaned);
      if (!importsHelper) continue;
      const hasRawFetch = /\bawait\s+fetch\s*\(/.test(cleaned);
      if (hasRawFetch) violators.push(file);
    }
    expect(violators).toEqual([]);
  });
});
