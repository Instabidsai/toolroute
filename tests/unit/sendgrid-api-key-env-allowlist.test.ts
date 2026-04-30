import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.241 — drift guard: SENDGRID_API_KEY env-var direct-read
// allow-list (single-key).
//
// SendGrid is the master credential for ToolRoute's SendGrid
// adapter (slug `sendgrid`). SendGrid is a paid transactional /
// marketing email provider — credential is a Bearer-style API
// key. Sibling email provider to Resend (Lane 4.220) and Twilio
// SMS (Lane 4.236) — same comms-fraud blast class as Twilio,
// same email-domain-reputation blast as Resend. BYOK arrives
// verbatim.
//
// Direct env-var reads from any new file silently bypass:
//
//   1. BYOK preference — `getApiKey()` returns the BYOK string
//      verbatim when present, only falling back to the env-var
//      when BYOK is absent. A new reader that omits the BYOK
//      check forces the master pool even for users who registered
//      their own SendGrid key.
//
//   2. Cost attribution — the gating-aware wrapper records
//      master-pool usage to `gateway_usage_log.cost_to_us`
//      (Lane 4.103). A bypass reader skips this → revenue leak.
//      SendGrid pricing is per-email above the free tier (40K
//      emails first month, then volume tiers). Bypass reader on
//      a fan-out workflow (newsletter, drip, alert) burns the
//      master quota fast.
//
//   3. Rate-limit accounting — SendGrid applies per-key sending
//      caps (free: 100/day, paid: per-plan). Beyond rate, the
//      account-level reputation score throttles deliveries when
//      bounce / complaint rate spikes — burst from a bypass
//      reader feeds into the SAME reputation pool.
//
//   4. SENDER-REPUTATION + TOLL-FRAUD ANALOG — this is the
//      unique blast class for transactional email at scale:
//        - Account-wide reputation score: a bypass reader sending
//          unverified-list email or low-quality content tanks the
//          deliverability of EVERY tenant routed through the
//          master pool. The damage class is "all your platform
//          users' emails go to spam," not "one tenant pays a bill"
//        - Domain authentication (SPF/DKIM/DMARC) is configured
//          ONCE per account — bypass reader inherits authority
//          to send AS the platform's verified senders, including
//          impersonation of platform support / billing emails
//        - SendGrid IP-warmup state is account-level: a sudden
//          bypass-driven volume spike resets warmup, gets the
//          shared IP greylisted by Gmail/Microsoft365
//        - Compliance liability (CAN-SPAM, GDPR): unauthorized
//          sends through the master account land enforcement on
//          the platform, not the bypass reader's tenant
//      Same shape as Twilio toll-fraud (Lane 4.236) but on the
//      reputation-asset rail instead of the financial-charge rail.
//
// Today's env-var read surface is exactly ONE file:
//
//   - src/lib/adapters/sendgrid-adapter.ts — the canonical
//     SendGrid adapter (slug `sendgrid`). Reads the env var at
//     line 8 inside the BYOK-fallback `getApiKey()` helper.
//
// Out-of-scope (not a process.env read):
//
//   - src/lib/adapter-availability.ts:44 —
//     `sendgrid: ["SENDGRID_API_KEY"]` is a string literal in
//     the adapter→required-env config map, used to compute the
//     platform-availability boolean. Not a credential read; the
//     regex (process.env. prefix) excludes it.
//
// EMPTY-style strictness: with only 1 known reader, this guard
// is just one notch above an empty allow-list — any second file
// that touches SENDGRID_API_KEY trips the test. Same pattern as
// 4.221 (ANTHROPIC), 4.223 (GITHUB), 4.224 (STRIPE_PLATFORM),
// 4.225 (SUPABASE_MGMT), 4.226 (ELEVENLABS), 4.227 (DEEPGRAM),
// 4.228 (FAL_KEY), 4.229 (REPLICATE_API_TOKEN), 4.230 (BRAVE),
// 4.231 (TAVILY), 4.232 (EXA), 4.233 (FIRECRAWL), 4.234 (HEYGEN),
// 4.235 (VAPI), 4.238 (DEEPL), 4.239 (APOLLO), 4.240 (HUBSPOT).
// Second email-tier guard after RESEND (4.220).
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
//   - Lane 4.240 (HUBSPOT_ACCESS_TOKEN env-var allow-list)

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

// Files allowed to read SENDGRID_API_KEY from process.env.
const ENV_READ_ALLOWLIST = new Set<string>([
  "src/lib/adapters/sendgrid-adapter.ts",
]);

describe("Lane 4.241 — SENDGRID_API_KEY env-var direct-read allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files read process.env.SENDGRID_API_KEY", () => {
    // Match `process.env.SENDGRID_API_KEY` (dot access) and
    // `process.env["SENDGRID_API_KEY"]` (bracket access).
    const re =
      /process\.env\s*(?:\.\s*SENDGRID_API_KEY\b|\[\s*["']SENDGRID_API_KEY["']\s*\])/;
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

  it("no destructured `const { SENDGRID_API_KEY } = process.env` outside allow-list", () => {
    // Destructuring assignment leaks the same value but evades dot/bracket
    // access regex. Match `{ SENDGRID_API_KEY` ... `} = process.env`.
    const re =
      /\{\s*[^}]*\bSENDGRID_API_KEY\b[^}]*\}\s*=\s*process\.env/;
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
