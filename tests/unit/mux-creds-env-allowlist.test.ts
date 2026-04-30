import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.237 — drift guard: MUX_TOKEN_ID + MUX_TOKEN_SECRET
// env-var direct-read allow-list (paired credential).
//
// Mux is the master credential pair for ToolRoute's Mux
// adapter (slug `mux`). Mux is a paid video infrastructure
// API (asset ingest, playback, streaming, encoding) in the
// Video tier on the catalog. Like Twilio (Lane 4.236), Mux
// uses a PAIRED CREDENTIAL: Token ID + Token Secret, sent as
// HTTP Basic Auth (`base64(id:secret)`). BYOK arrives as
// colon-delimited `id:secret`. Both halves must be guarded
// the same way: a new reader of EITHER env var bypasses the
// same controls.
//
// Direct env-var reads from any new file silently bypass:
//
//   1. BYOK preference — `getAuth()` returns the BYOK string
//      verbatim when present, only falling back to env-pair
//      assembly when BYOK is absent. A new reader that omits
//      the BYOK check forces the master pool even for users
//      who registered their own Token pair.
//
//   2. Cost attribution — the gating-aware wrapper records
//      master-pool usage to `gateway_usage_log.cost_to_us`
//      (Lane 4.103). Bypass readers don't get attributed →
//      revenue leak. Mux pricing composes ingest minutes +
//      stored minutes + delivered minutes — multi-axis cost
//      where under-attribution at the Mux layer hides three
//      meters at once.
//
//   3. Rate-limit accounting — Mux caps are per-Token-ID. A
//      second module dialing the same master pair risks
//      consuming quota that the canonical adapter believes
//      is available.
//
//   4. STORAGE-LIABILITY VECTOR — Mux is unique in the master-
//      pool roster: it ACCRUES STATE on the platform side. An
//      asset created via the master-pool token is BILLED
//      MONTHLY for storage until explicitly deleted. Bypass
//      reader could:
//        - Create assets that bill the master pool indefinitely
//          (no per-call cap stops a recurring storage charge)
//        - Orphan ingest jobs without cleanup
//        - Mix tenant content into the platform's playback IDs
//      This is a structurally worse blast class than per-call
//      under-billing — it converts a one-time leak into a
//      recurring monthly bill that ToolRoute owns until manual
//      asset audit.
//
// Today's env-var read surface is exactly ONE file, with BOTH
// env vars read in the same `getAuth()` helper:
//
//   - src/lib/adapters/mux-adapter.ts — the canonical Mux
//     adapter (slug `mux`). Reads MUX_TOKEN_ID at line 9 and
//     MUX_TOKEN_SECRET at line 10, both inside the BYOK-fallback
//     `getAuth()` helper. The error-message string-literal
//     reference on line 35 is not an env read.
//
// Out-of-scope (not a process.env read):
//
//   - src/lib/adapter-availability.ts:31 —
//     `mux: ["MUX_TOKEN_ID", "MUX_TOKEN_SECRET"]` is a string
//     literal in the adapter→required-env config map, used to
//     compute the platform-availability boolean. Not a
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
// (FIRECRAWL), 4.234 (HEYGEN), 4.235 (VAPI). Second paired-cred
// guard after Lane 4.236 (Twilio).
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

// Files allowed to read the Mux credential pair from process.env.
// Both env vars share the same single canonical reader.
const ENV_READ_ALLOWLIST = new Set<string>([
  "src/lib/adapters/mux-adapter.ts",
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

describe("Lane 4.237 — MUX_TOKEN_ID + MUX_TOKEN_SECRET env-var direct-read allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files read process.env.MUX_TOKEN_ID", () => {
    expect(checkEnvReads("MUX_TOKEN_ID", files)).toEqual([]);
  });

  it("only allow-listed files read process.env.MUX_TOKEN_SECRET", () => {
    expect(checkEnvReads("MUX_TOKEN_SECRET", files)).toEqual([]);
  });

  it("no destructured `const { MUX_TOKEN_ID } = process.env` outside allow-list", () => {
    expect(checkDestructuredReads("MUX_TOKEN_ID", files)).toEqual([]);
  });

  it("no destructured `const { MUX_TOKEN_SECRET } = process.env` outside allow-list", () => {
    expect(checkDestructuredReads("MUX_TOKEN_SECRET", files)).toEqual([]);
  });
});
