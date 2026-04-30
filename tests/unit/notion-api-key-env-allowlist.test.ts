import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.242 — drift guard: NOTION_API_KEY env-var direct-read
// allow-list.
//
// NOTION_API_KEY is the master credential for ToolRoute's Notion
// adapter (slug `notion`). Notion is a productivity / wiki / knowledge-
// base tool in the Productivity tier on the catalog. Notion uses a
// Bearer-style integration token: a single token authenticates against
// ONE Notion workspace at the integration's install scope. The adapter
// reads it via simple BYOK fallback in `getApiKey()`:
//
//   return byokKey || process.env.NOTION_API_KEY || null;
//
// Direct env-var reads from any new file silently bypass:
//
//   1. BYOK preference — a new reader that omits `byokKey ||` forces
//      the master pool even for users who registered their own Notion
//      integration token. The user's BYOK workspace stops receiving
//      writes; the platform's master workspace gets them instead.
//
//   2. Cost attribution — the gating-aware wrapper records master-pool
//      usage to `gateway_usage_log.cost_to_us` (Lane 4.103). Bypass
//      readers don't get attributed → revenue leak. Notion isn't billed
//      per call, but the bypass still desyncs the cost meter and the
//      rate-limit accounting (Notion enforces ~3 req/sec per integration;
//      uncounted reads from a second module risk silent 429s).
//
//   3. Rate-limit accounting — Notion's per-integration cap is shared
//      across every caller using the master token. A second module
//      dialing the same token consumes quota the canonical adapter
//      believes is available.
//
//   4. CROSS-WORKSPACE DATA EXPOSURE — this is the unique blast for
//      Notion, sibling to HubSpot's CROSS-TENANT (Lane 4.240) and Mux's
//      STORAGE-LIABILITY (Lane 4.237). The master integration token
//      authenticates against a SINGLE Notion workspace — the platform's
//      own. Bypass reader could:
//        - Create pages in the platform's workspace that should have
//          gone to the user's BYOK workspace (state-accrual: pages
//          persist until manually deleted, mixing tenant content into
//          the platform's wiki tree)
//        - `search` or `query-database` and leak OTHER tenants' wiki
//          content / structured database rows (PII, business logic,
//          partner contracts, internal docs — Notion is where teams
//          dump the unstructured truth of their company)
//        - Mutate platform-internal pages mistaken for tenant pages
//      Notion is uniquely high-blast here because the search/query ops
//      return cross-page content by default — a misrouted query against
//      the master workspace doesn't just leak the queried row, it leaks
//      ANY page the master integration has access to.
//
// Today's env-var read surface is exactly ONE file:
//
//   - src/lib/adapters/notion-adapter.ts — the canonical Notion adapter
//     (slug `notion`). Reads NOTION_API_KEY at line 9 inside the BYOK-
//     fallback `getApiKey()` helper. The error-message string-literal
//     reference on line 37 is not an env read.
//
// Out-of-scope (not a process.env read):
//
//   - src/lib/adapter-availability.ts:32 —
//     `notion: ["NOTION_API_KEY"]` is a string literal in the adapter→
//     required-env config map, used to compute the platform-availability
//     boolean. Not a credential read; the regex (process.env. prefix)
//     excludes it.
//
// EMPTY-style strictness: with only 1 known reader, this guard is just
// one notch above an empty allow-list — any second file that touches
// NOTION_API_KEY trips the test. Same pattern as Lanes 4.221 (ANTHROPIC),
// 4.223 (GITHUB), 4.224 (STRIPE_PLATFORM), 4.225 (SUPABASE_MGMT), 4.226
// (ELEVENLABS), 4.227 (DEEPGRAM), 4.228 (FAL_KEY), 4.229
// (REPLICATE_API_TOKEN), 4.230 (BRAVE_SEARCH), 4.231 (TAVILY), 4.232
// (EXA), 4.233 (FIRECRAWL), 4.234 (HEYGEN), 4.235 (VAPI), 4.238 (DEEPL),
// 4.239 (APOLLO), 4.240 (HUBSPOT), 4.241 (SENDGRID).
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
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
//   - Lane 4.233 (FIRECRAWL_API_KEY env-var allow-list)
//   - Lane 4.234 (HEYGEN_API_KEY env-var allow-list)
//   - Lane 4.235 (VAPI_API_KEY env-var allow-list)
//   - Lane 4.236 (TWILIO paired-cred)
//   - Lane 4.237 (MUX paired-cred + storage-liability)
//   - Lane 4.238 (DEEPL_API_KEY env-var allow-list)
//   - Lane 4.239 (APOLLO_API_KEY env-var allow-list)
//   - Lane 4.240 (HUBSPOT_ACCESS_TOKEN env-var allow-list + cross-tenant)
//   - Lane 4.241 (SENDGRID_API_KEY env-var allow-list + sender-rep)

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

// Files allowed to read NOTION_API_KEY from process.env.
const ENV_READ_ALLOWLIST = new Set<string>([
  "src/lib/adapters/notion-adapter.ts",
]);

describe("Lane 4.242 — NOTION_API_KEY env-var direct-read allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files read process.env.NOTION_API_KEY", () => {
    // Match `process.env.NOTION_API_KEY` (dot access) and
    // `process.env["NOTION_API_KEY"]` (bracket access).
    const re =
      /process\.env\s*(?:\.\s*NOTION_API_KEY\b|\[\s*["']NOTION_API_KEY["']\s*\])/;
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

  it("no destructured `const { NOTION_API_KEY } = process.env` outside allow-list", () => {
    // Destructuring assignment leaks the same value but evades dot/bracket
    // access regex. Match `{ NOTION_API_KEY` ... `} = process.env`.
    const re =
      /\{\s*[^}]*\bNOTION_API_KEY\b[^}]*\}\s*=\s*process\.env/;
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
