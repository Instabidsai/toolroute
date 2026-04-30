import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.136 — drift guard: every adapter that surfaces an upstream error
// body MUST run it through redactCreds() before returning.
//
// Source: .agent/lane-4.83-redactcreds-coverage-audit.md.
//
// Lanes 4.18 (definer) + 4.76 (tavily) + 4.79 (apollo, textbelt) shipped
// `redactCreds()` and applied it to 3 adapters. The Lane 4.83 audit found
// 44 remaining adapters that still echo `errText = await res.text()`
// straight into `error: \`<provider> failed: ${res.status} ${errText}\``,
// which means a misconfigured 401/403 from the provider can leak the
// caller's bearer/api-key back through `result.error` (gateway returns
// adapter result verbatim — Lane 4.18 audit).
//
// Per Hard Rule #59 (failing-snapshot test as drift TODO list): this test
// fails on master so the swap PR(s) have a green-light signal — and is
// gated behind ADAPTER_REDACTCREDS_BASELINE=skip so CI stays green while
// the 44-adapter mechanical wrap lands. Flip env unset → assertions fire.
//
// Source-file regex parser (NOT runtime import) — adapter modules pull
// in network deps/registry imports that crash without prod env per
// memory rule #59.
//
// Coverage matrix sibling: Lane 4.18 (redactCreds definer + first 3
// callsites), Lane 4.83 (manual audit). Lane 4.136 is the CI-gate.

const SKIP = process.env.ADAPTER_REDACTCREDS_BASELINE === "skip";

const ADAPTERS_DIR = resolve(process.cwd(), "src/lib/adapters");

// Strip block + line comments before regex check (memory rule #59 hygiene)
// so JSDoc references like `// errText = await res.text()` in a code
// example don't false-positive.
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

// Extracts adapter source files (foo-adapter.ts pattern). Excludes
// auto-adapter.ts because it's a meta-dispatcher — its error paths
// surface the *inner* adapter's already-redacted result (Lane 4.18
// gateway invariant). Same for index.ts (re-export barrel).
function adapterFiles(): string[] {
  return readdirSync(ADAPTERS_DIR)
    .filter((f) => f.endsWith("-adapter.ts"))
    .filter((f) => f !== "auto-adapter.ts")
    .map((f) => join(ADAPTERS_DIR, f))
    .sort();
}

// Adapter has a "raw error-text passthrough" if it both:
//   1. extracts errText from a Response.text() call, AND
//   2. interpolates it into an `error:` field of the result object.
//
// Both must match — adapters that only do (1) and discard, or only
// build error strings without an errText extraction, aren't in the
// drift class.
function hasRawErrTextPassthrough(src: string): boolean {
  const cleaned = stripComments(src);
  const hasExtraction = /errText\s*=\s*await\s+res\.text\s*\(/.test(cleaned);
  // `error:` followed by a template literal that interpolates ${errText}.
  // Use [\s\S] so the template can span lines.
  const hasErrorInterp = /error\s*:\s*`[\s\S]*?\$\{[\s\S]*?errText[\s\S]*?\}[\s\S]*?`/.test(
    cleaned
  );
  return hasExtraction && hasErrorInterp;
}

function importsRedactCreds(src: string): boolean {
  const cleaned = stripComments(src);
  return /import\s*\{[^}]*\bredactCreds\b[^}]*\}\s*from\s*["'][^"']*redact-creds["']/.test(
    cleaned
  );
}

// An adapter is "compliant" if either:
//   - it doesn't have the raw passthrough pattern (nothing to wrap), OR
//   - it imports redactCreds AND wraps the error string with it
//     (`error: redactCreds(\`...${errText}...\`)`).
function wrapsWithRedactCreds(src: string): boolean {
  const cleaned = stripComments(src);
  // Look for redactCreds(`...${errText}...`) — the canonical wrap
  // shape per Lane 4.83 audit memo's prescribed fix.
  return /error\s*:\s*redactCreds\s*\(\s*`[\s\S]*?\$\{[\s\S]*?errText[\s\S]*?\}[\s\S]*?`\s*\)/.test(
    cleaned
  );
}

describe("Lane 4.136 — adapter redactCreds() coverage drift guard", () => {
  if (SKIP) {
    it.skip("skipped (ADAPTER_REDACTCREDS_BASELINE=skip — swap PRs PENDING)", () => {});
    return;
  }

  const files = adapterFiles();

  it("at least one adapter file exists (sanity)", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("every adapter that surfaces res.text() in error: imports redactCreds", () => {
    const violators: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      if (!hasRawErrTextPassthrough(src)) continue;
      if (!importsRedactCreds(src)) {
        violators.push(file.replace(ADAPTERS_DIR, "src/lib/adapters").replace(/\\/g, "/"));
      }
    }
    expect(violators).toEqual([]);
  });

  it("every adapter that surfaces res.text() in error: wraps with redactCreds(`...${errText}...`)", () => {
    const violators: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      if (!hasRawErrTextPassthrough(src)) continue;
      if (!wrapsWithRedactCreds(src)) {
        violators.push(file.replace(ADAPTERS_DIR, "src/lib/adapters").replace(/\\/g, "/"));
      }
    }
    expect(violators).toEqual([]);
  });
});
