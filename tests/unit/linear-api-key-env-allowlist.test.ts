import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.243 — drift guard: LINEAR_API_KEY env-var direct-read
// allow-list.
//
// LINEAR_API_KEY is the master credential for ToolRoute's Linear
// adapter (slug `linear`). Linear is a project-management /
// issue-tracking tool in the Productivity tier on the catalog.
// Linear uses a raw API key in the Authorization header (no Bearer
// prefix) authenticated via GraphQL at api.linear.app/graphql. The
// adapter reads it via simple BYOK fallback in `getApiKey()`:
//
//   return byokKey || process.env.LINEAR_API_KEY || null;
//
// Direct env-var reads from any new file silently bypass:
//
//   1. BYOK preference — a new reader that omits `byokKey ||` forces
//      the master pool even for users who registered their own Linear
//      API key. The user's BYOK workspace stops receiving writes; the
//      platform's master workspace gets them instead.
//
//   2. Cost attribution — the gating-aware wrapper records master-pool
//      usage to `gateway_usage_log.cost_to_us` (Lane 4.103). Bypass
//      readers don't get attributed → cost-meter desync. Linear isn't
//      billed per call but enforces per-API-key complexity-cost rate
//      limits (each GraphQL query has a complexity score, capped per
//      hour); uncounted reads from a second module risk silent 429s
//      on the canonical adapter.
//
//   3. Rate-limit accounting — Linear's per-API-key complexity cap is
//      shared across every caller using the master token. A second
//      module dialing the same key consumes complexity quota the
//      canonical adapter believes is available. Linear's rate-limit
//      response includes a complexity score, not just a request count,
//      so amplified bypass calls (e.g. nested issue+comment fetches)
//      can drain the pool faster than request-count math suggests.
//
//   4. CROSS-WORKSPACE DATA EXPOSURE — same blast class as Notion
//      (Lane 4.242) and HubSpot (Lane 4.240). Linear API keys are
//      workspace-scoped: the master key authenticates against ONE
//      Linear workspace — the platform's own. Bypass reader could:
//        - Create issues/comments in the platform's workspace that
//          should have gone to the user's BYOK workspace (state-
//          accrual: issues persist until manually deleted, mixing
//          tenant content into the platform's engineering tracker)
//        - `list-issues` / `list-projects` and leak OTHER tenants'
//          issue titles, descriptions, comments, project structure
//          (engineering roadmap, sprint plans, partner work, security
//          tickets that often contain repro steps + credentials)
//        - Mutate platform-internal tickets mistaken for tenant
//          tickets (state change on issues other tenants own)
//      Linear is uniquely high-blast for engineering orgs because
//      issue bodies routinely contain stack traces, credentials,
//      customer email addresses, and pre-disclosure security findings.
//      A bypass reader's `list-issues` query against the master
//      workspace returns ANY issue the master integration has access
//      to, not just the queried scope.
//
// Today's env-var read surface is exactly ONE file:
//
//   - src/lib/adapters/linear-adapter.ts — the canonical Linear
//     adapter (slug `linear`). Reads LINEAR_API_KEY at line 7 inside
//     the BYOK-fallback `getApiKey()` helper. The error-message
//     string-literal reference on line 53 is not an env read.
//
// Out-of-scope (not a process.env read):
//
//   - src/lib/adapter-availability.ts:29 —
//     `linear: ["LINEAR_API_KEY"]` is a string literal in the adapter→
//     required-env config map, used to compute the platform-availability
//     boolean. Not a credential read; the regex (process.env. prefix)
//     excludes it.
//
// EMPTY-style strictness: with only 1 known reader, this guard is just
// one notch above an empty allow-list — any second file that touches
// LINEAR_API_KEY trips the test. Same pattern as Lanes 4.221-4.242.
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
//   - Lane 4.242 (NOTION_API_KEY env-var allow-list + cross-workspace)

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

// Files allowed to read LINEAR_API_KEY from process.env.
const ENV_READ_ALLOWLIST = new Set<string>([
  "src/lib/adapters/linear-adapter.ts",
]);

describe("Lane 4.243 — LINEAR_API_KEY env-var direct-read allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files read process.env.LINEAR_API_KEY", () => {
    // Match `process.env.LINEAR_API_KEY` (dot access) and
    // `process.env["LINEAR_API_KEY"]` (bracket access).
    const re =
      /process\.env\s*(?:\.\s*LINEAR_API_KEY\b|\[\s*["']LINEAR_API_KEY["']\s*\])/;
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

  it("no destructured `const { LINEAR_API_KEY } = process.env` outside allow-list", () => {
    // Destructuring assignment leaks the same value but evades dot/bracket
    // access regex. Match `{ LINEAR_API_KEY` ... `} = process.env`.
    const re =
      /\{\s*[^}]*\bLINEAR_API_KEY\b[^}]*\}\s*=\s*process\.env/;
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
