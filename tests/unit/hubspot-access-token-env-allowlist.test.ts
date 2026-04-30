import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.240 — drift guard: HUBSPOT_ACCESS_TOKEN env-var direct-read
// allow-list (single-key).
//
// HubSpot is the master credential for ToolRoute's HubSpot CRM
// adapter (slug `hubspot`). HubSpot is a paid CRM platform — the
// adapter exposes contact/deal/pipeline/notes operations against
// the HubSpot API. The credential is a Private App access token
// (Bearer-style; OAuth-equivalent permission scope was granted at
// app creation time). BYOK arrives verbatim.
//
// Direct env-var reads from any new file silently bypass:
//
//   1. BYOK preference — `getApiKey()` returns the BYOK string
//      verbatim when present, only falling back to the env-var
//      when BYOK is absent. A new reader that omits the BYOK
//      check forces the master pool even for users who registered
//      their own HubSpot Private App token.
//
//   2. Cost attribution — the gating-aware wrapper records
//      master-pool usage to `gateway_usage_log.cost_to_us`
//      (Lane 4.103). A bypass reader skips this → revenue leak.
//      HubSpot Free/Starter tiers have no per-call $$ but the
//      seat / contacts cap and rate-limit budget are the meter.
//
//   3. Rate-limit accounting — HubSpot enforces per-token
//      daily/burst rate limits (e.g. 250K daily for paid tiers,
//      lower for free). A second module dialing the same master
//      token consumes quota the canonical adapter believes is
//      available; exhaustion is a hard daily reset, not surge.
//
//   4. CROSS-TENANT DATA EXPOSURE — this is the unique blast
//      class for HubSpot. Unlike per-call APIs (search / generate),
//      the master HubSpot token authenticates against ONE specific
//      HubSpot portal (the platform's CRM instance). Every contact
//      / deal / note created through the master token lives in
//      THAT portal. A bypass reader could:
//        - Create contacts in the platform's CRM that should
//          have gone to the user's BYOK portal
//        - List/search contacts and leak platform-CRM PII
//          (other tenants' lead data, sales-pipeline values)
//        - Cross-pollinate notes between tenants
//      This is structurally worse than per-call under-billing —
//      it converts a credential bypass into a multi-tenant data
//      contamination class. Same shape as Lane 4.237 (Mux
//      asset-storage liability) — state accrues on the platform
//      side until manual cleanup.
//
// Today's env-var read surface is exactly ONE file:
//
//   - src/lib/adapters/hubspot-adapter.ts — the canonical HubSpot
//     CRM adapter (slug `hubspot`). Reads the env var at line 8
//     inside the BYOK-fallback `getApiKey()` helper. The error-
//     message string-literal reference on line 41 is not an env
//     read.
//
// Out-of-scope (not a process.env read):
//
//   - src/lib/adapter-availability.ts:27 —
//     `hubspot: ["HUBSPOT_ACCESS_TOKEN"]` is a string literal in
//     the adapter→required-env config map, used to compute the
//     platform-availability boolean. Not a credential read; the
//     regex (process.env. prefix) excludes it.
//
// EMPTY-style strictness: with only 1 known reader, this guard
// is just one notch above an empty allow-list — any second file
// that touches HUBSPOT_ACCESS_TOKEN trips the test. Same pattern
// as 4.221 (ANTHROPIC), 4.223 (GITHUB), 4.224 (STRIPE_PLATFORM),
// 4.225 (SUPABASE_MGMT), 4.226 (ELEVENLABS), 4.227 (DEEPGRAM),
// 4.228 (FAL_KEY), 4.229 (REPLICATE_API_TOKEN), 4.230 (BRAVE),
// 4.231 (TAVILY), 4.232 (EXA), 4.233 (FIRECRAWL), 4.234 (HEYGEN),
// 4.235 (VAPI), 4.238 (DEEPL), 4.239 (APOLLO). Brings CRM tier
// into the locked set after B2B sales-intelligence (4.239).
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
//   - Lane 4.233 (FIRECRAWL_API_KEY env-var allow-list)
//   - Lane 4.234 (HEYGEN_API_KEY env-var allow-list)
//   - Lane 4.235 (VAPI_API_KEY env-var allow-list)
//   - Lane 4.236 (TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN paired)
//   - Lane 4.237 (MUX_TOKEN_ID + MUX_TOKEN_SECRET paired)
//   - Lane 4.238 (DEEPL_API_KEY env-var allow-list)
//   - Lane 4.239 (APOLLO_API_KEY env-var allow-list)

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

// Files allowed to read HUBSPOT_ACCESS_TOKEN from process.env.
const ENV_READ_ALLOWLIST = new Set<string>([
  "src/lib/adapters/hubspot-adapter.ts",
]);

describe("Lane 4.240 — HUBSPOT_ACCESS_TOKEN env-var direct-read allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files read process.env.HUBSPOT_ACCESS_TOKEN", () => {
    // Match `process.env.HUBSPOT_ACCESS_TOKEN` (dot access) and
    // `process.env["HUBSPOT_ACCESS_TOKEN"]` (bracket access).
    const re =
      /process\.env\s*(?:\.\s*HUBSPOT_ACCESS_TOKEN\b|\[\s*["']HUBSPOT_ACCESS_TOKEN["']\s*\])/;
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

  it("no destructured `const { HUBSPOT_ACCESS_TOKEN } = process.env` outside allow-list", () => {
    // Destructuring assignment leaks the same value but evades dot/bracket
    // access regex. Match `{ HUBSPOT_ACCESS_TOKEN` ... `} = process.env`.
    const re =
      /\{\s*[^}]*\bHUBSPOT_ACCESS_TOKEN\b[^}]*\}\s*=\s*process\.env/;
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
