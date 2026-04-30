import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.236 — drift guard: TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN
// env-var direct-read allow-list (paired credential).
//
// Twilio is the master credential pair for ToolRoute's Twilio
// adapter (slug `twilio`). Twilio is a paid SMS/voice telephony
// API in the Communications tier on the catalog. Unlike single-
// key adapters, Twilio uses a PAIRED CREDENTIAL — Account SID
// (account identifier, not strictly secret) plus Auth Token
// (the actual secret). The adapter expects BYOK keys to arrive
// as a colon-delimited `SID:TOKEN` string so the gateway can
// pass two values through one BYOK slot. Both halves must be
// guarded the same way: a new reader of EITHER env var bypasses
// the same controls.
//
// Direct env-var reads from any new file silently bypass:
//
//   1. BYOK preference — `byokKey?.split(":", 2)` is the
//      canonical way to extract per-tenant SID/Token from the
//      BYOK slot. Falling back to `process.env.TWILIO_*` only
//      when BYOK is absent. A new reader that omits the BYOK
//      check forces the master pool even for users who
//      registered their own SID/Token pair.
//
//   2. Cost attribution — the gating-aware wrapper records
//      master-pool usage to `gateway_usage_log.cost_to_us`
//      (Lane 4.103). Bypass readers don't get attributed →
//      revenue leak. Twilio SMS is per-message (~\$0.008 in
//      US, more outside) and voice is per-minute — every
//      bypass call is real money.
//
//   3. Rate-limit accounting — Twilio caps are per-account.
//      A second module dialing the same master credential
//      risks consuming quota that the canonical adapter
//      believes is available.
//
//   4. SMS/VOICE FRAUD VECTOR — Twilio is one of the two
//      adapters where master-pool bypass enables direct
//      external real-world action (the other is voice via
//      Vapi, Lane 4.235). A bypass reader could send SMS to
//      arbitrary numbers from the platform's account, exposing
//      ToolRoute to:
//        - Toll fraud (premium-rate numbers)
//        - Carrier shutoff (Twilio yanks accounts that send
//          spam-pattern traffic)
//        - Reputational/trust&safety incidents
//      This is a strictly worse blast class than under-billing.
//
// Today's env-var read surface is exactly ONE file, with BOTH
// env vars read in the same `getCredentials()` helper:
//
//   - src/lib/adapters/twilio-adapter.ts — the canonical Twilio
//     adapter (slug `twilio`). Reads TWILIO_ACCOUNT_SID at line
//     14 and TWILIO_AUTH_TOKEN at line 15, both inside the
//     BYOK-fallback `getCredentials()` helper. The error-message
//     string-literal reference on line 44 is not an env read.
//
// Out-of-scope (not a process.env read):
//
//   - src/lib/adapter-availability.ts:56 —
//     `twilio: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"]` is a
//     string literal in the adapter→required-env config map,
//     used to compute the platform-availability boolean. Not a
//     credential read; the regex (process.env. prefix) excludes
//     it for both env vars.
//
// EMPTY-style strictness: with only 1 known reader for each env
// var, this guard is just one notch above an empty allow-list —
// any second file that touches EITHER env var trips the test.
// Same pattern as 4.221 (ANTHROPIC), 4.223 (GITHUB), 4.224
// (STRIPE_PLATFORM), 4.225 (SUPABASE_MGMT), 4.226 (ELEVENLABS),
// 4.227 (DEEPGRAM), 4.228 (FAL_KEY), 4.229 (REPLICATE_API_TOKEN),
// 4.230 (BRAVE_SEARCH), 4.231 (TAVILY), 4.232 (EXA), 4.233
// (FIRECRAWL), 4.234 (HEYGEN), 4.235 (VAPI). First paired-cred
// guard (vs. the single-key pattern of 4.221–4.235).
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

// Files allowed to read the Twilio credential pair from process.env.
// Both env vars share the same single canonical reader.
const ENV_READ_ALLOWLIST = new Set<string>([
  "src/lib/adapters/twilio-adapter.ts",
]);

function checkEnvReads(envName: string, files: string[]): string[] {
  // Match `process.env.<NAME>` (dot access) and
  // `process.env["<NAME>"]` (bracket access).
  const re = new RegExp(
    `process\\.env\\s*(?:\\.\\s*${envName}\\b|\\[\\s*["']${envName}["']\\s*\\])`
  );
  const violators: string[] = [];
  for (const file of files) {
    const src = stripComments(readFileSync(file, "utf-8"));
    if (re.test(src)) {
      const r = rel(file);
      if (!ENV_READ_ALLOWLIST.has(r)) violators.push(r);
    }
  }
  return violators;
}

function checkDestructuredReads(envName: string, files: string[]): string[] {
  // Destructuring assignment leaks the same value but evades dot/bracket
  // access regex. Match `{ <NAME>` ... `} = process.env`.
  const re = new RegExp(
    `\\{\\s*[^}]*\\b${envName}\\b[^}]*\\}\\s*=\\s*process\\.env`
  );
  const violators: string[] = [];
  for (const file of files) {
    const src = stripComments(readFileSync(file, "utf-8"));
    if (re.test(src)) {
      const r = rel(file);
      if (!ENV_READ_ALLOWLIST.has(r)) violators.push(r);
    }
  }
  return violators;
}

describe("Lane 4.236 — TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN env-var direct-read allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files read process.env.TWILIO_ACCOUNT_SID", () => {
    expect(checkEnvReads("TWILIO_ACCOUNT_SID", files)).toEqual([]);
  });

  it("only allow-listed files read process.env.TWILIO_AUTH_TOKEN", () => {
    expect(checkEnvReads("TWILIO_AUTH_TOKEN", files)).toEqual([]);
  });

  it("no destructured `const { TWILIO_ACCOUNT_SID } = process.env` outside allow-list", () => {
    expect(checkDestructuredReads("TWILIO_ACCOUNT_SID", files)).toEqual([]);
  });

  it("no destructured `const { TWILIO_AUTH_TOKEN } = process.env` outside allow-list", () => {
    expect(checkDestructuredReads("TWILIO_AUTH_TOKEN", files)).toEqual([]);
  });
});
