import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.233 — drift guard: FIRECRAWL_API_KEY env-var direct-read
// allow-list.
//
// `FIRECRAWL_API_KEY` is the master credential for ToolRoute's
// Firecrawl adapter (slug `firecrawl`). Firecrawl is a paid-tier
// web-scraping / page-extraction API in the Scrape tier on the
// catalog. ToolRoute charges per-call against this master pool
// when end-users haven't supplied a BYOK key (gating-aware
// adapter wrapper, Lane 4.103). Direct env-var reads from any
// new file silently bypass:
//
//   1. BYOK preference — `byokKey || process.env.FIRECRAWL_API_KEY`
//      is the canonical fallback chain. A new reader that omits
//      the BYOK check forces the master pool even for users who
//      registered their own key.
//
//   2. Cost attribution — the gating-aware wrapper records master-
//      pool usage to `gateway_usage_log.cost_to_us` (Lane 4.103).
//      Bypass readers don't get attributed → revenue leak.
//      Firecrawl pricing is per-page-fetch; pages can be heavy
//      (full DOM render, JS execution) so per-call cost is
//      structurally higher than a flat search API.
//
//   3. Rate-limit accounting — Firecrawl caps are per-key. A
//      second module dialing the same master key risks consuming
//      quota that the canonical adapter believes is available.
//
//   4. SCRAPE-TIER FAN-OUT — `firecrawl` is the typical 2nd hop
//      of agent-driven scraping pipelines (search → SCRAPE →
//      summarize). A bypass reader on the scrape step amplifies
//      blast: each search hit fans out to one scrape call, and
//      under-attribution multiplies by the fan-out factor. Same
//      class as Lane 4.230 (Brave) on the search side; this lane
//      locks the complementary scrape side.
//
// Today's env-var read surface is exactly ONE file:
//
//   - src/lib/adapters/firecrawl-adapter.ts — the canonical
//     Firecrawl adapter (slug `firecrawl`). Implements the BYOK
//     fallback at line 8
//     (`byokKey || process.env.FIRECRAWL_API_KEY || null`).
//
// Out-of-scope (not a process.env read):
//
//   - src/lib/adapter-availability.ts:23 —
//     `firecrawl: ["FIRECRAWL_API_KEY"]` is a string literal in
//     the adapter→required-env config map, used to compute the
//     platform-availability boolean. Not a credential read; the
//     regex (process.env. prefix) excludes it.
//
// EMPTY-style strictness: with only 1 known reader, this guard
// is just one notch above an empty allow-list — any second file
// that touches the env var trips the test. Same pattern as 4.221
// (ANTHROPIC), 4.223 (GITHUB), 4.224 (STRIPE_PLATFORM), 4.225
// (SUPABASE_MGMT), 4.226 (ELEVENLABS), 4.227 (DEEPGRAM), 4.228
// (FAL_KEY), 4.229 (REPLICATE_API_TOKEN), 4.230 (BRAVE_SEARCH),
// 4.231 (TAVILY), 4.232 (EXA).
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env
// (memory rule #59).
//
// Sibling guards:
//   - Lane 4.220 (RESEND_API_KEY env-var allow-list)
//   - Lane 4.221 (ANTHROPIC_API_KEY env-var allow-list)
//   - Lane 4.222 (OPENAI_API_KEY env-var allow-list)
//   - Lane 4.223 (GITHUB_TOKEN env-var allow-list)
//   - Lane 4.224 (STRIPE_PLATFORM_KEY env-var allow-list)
//   - Lane 4.225 (SUPABASE_MGMT_TOKEN env-var allow-list)
//   - Lane 4.226 (ELEVENLABS_API_KEY env-var allow-list)
//   - Lane 4.227 (DEEPGRAM_API_KEY env-var allow-list)
//   - Lane 4.228 (FAL_KEY env-var allow-list)
//   - Lane 4.229 (REPLICATE_API_TOKEN env-var allow-list)
//   - Lane 4.230 (BRAVE_SEARCH_API_KEY env-var allow-list)
//   - Lane 4.231 (TAVILY_API_KEY env-var allow-list)
//   - Lane 4.232 (EXA_API_KEY env-var allow-list)

const SRC_ROOT = resolve(process.cwd(), "src");

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      walk(full, files);
    } else if (
      st.isFile() &&
      (full.endsWith(".ts") || full.endsWith(".tsx")) &&
      !full.endsWith(".test.ts") &&
      !full.endsWith(".test.tsx")
    ) {
      files.push(full);
    }
  }
  return files;
}

// Strip /* … */ block comments and // line comments before regex
// matching so JSDoc references to the env var don't trigger false
// positives (memory rule from prior drift-guard work).
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function rel(file: string): string {
  return file.replace(SRC_ROOT, "src").replace(/\\/g, "/");
}

// Files allowed to read `FIRECRAWL_API_KEY` from process.env.
// Each entry has a real reason — see lane comment above.
const ENV_READ_ALLOWLIST = new Set<string>([
  "src/lib/adapters/firecrawl-adapter.ts",
]);

describe("Lane 4.233 — FIRECRAWL_API_KEY env-var direct-read allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files read process.env.FIRECRAWL_API_KEY", () => {
    // Match `process.env.FIRECRAWL_API_KEY` (dot access) and
    // `process.env["FIRECRAWL_API_KEY"]` (bracket access).
    const re =
      /process\.env\s*(?:\.\s*FIRECRAWL_API_KEY\b|\[\s*["']FIRECRAWL_API_KEY["']\s*\])/;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) {
        const r = rel(file);
        if (!ENV_READ_ALLOWLIST.has(r)) violators.push(r);
      }
    }
    expect(violators).toEqual([]);
  });

  it("no destructured `const { FIRECRAWL_API_KEY } = process.env` outside allow-list", () => {
    // Destructuring assignment leaks the same value but evades dot/bracket
    // access regex. Match `{ FIRECRAWL_API_KEY` ... `} = process.env`.
    const re =
      /\{\s*[^}]*\bFIRECRAWL_API_KEY\b[^}]*\}\s*=\s*process\.env/;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) {
        const r = rel(file);
        if (!ENV_READ_ALLOWLIST.has(r)) violators.push(r);
      }
    }
    expect(violators).toEqual([]);
  });
});
