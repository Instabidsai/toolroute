import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.226 — drift guard: ELEVENLABS_API_KEY env-var direct-read
// allow-list.
//
// `ELEVENLABS_API_KEY` is the master credential for ToolRoute's
// ElevenLabs voice/audio adapter. ToolRoute charges per-call against
// this master pool when end-users haven't supplied a BYOK key
// (gating-aware adapter wrapper, Lane 4.103 cost-attribution).
// Direct env-var reads from any new file silently bypass:
//
//   1. BYOK preference — `byokKey || process.env.ELEVENLABS_API_KEY`
//      is the canonical fallback chain. A new reader that omits the
//      BYOK check forces the master pool even for users who paid
//      to register their own key.
//
//   2. Cost attribution — the gating-aware wrapper records master-
//      pool usage to `gateway_usage_log.cost_to_us` (Lane 4.103).
//      A bypass reader's calls don't get attributed → revenue leak
//      and false BYOK-conversion analytics.
//
//   3. Rate-limit accounting — ElevenLabs API caps are per-key. A
//      second module dialing the same master key risks consuming
//      quota that the canonical adapter believes is available.
//
// Today's env-var read surface is exactly ONE file:
//
//   - src/lib/adapters/elevenlabs-adapter.ts — the canonical
//     elevenlabs adapter. Implements the BYOK fallback at line 10
//     (`byokKey || process.env.ELEVENLABS_API_KEY || null`).
//
// Out-of-scope (not a process.env read):
//
//   - src/lib/adapter-availability.ts:21 — `elevenlabs: ["ELEVENLABS_API_KEY"]`
//     is a string literal in the adapter→required-env config map,
//     used to compute the platform-availability boolean. Not a
//     credential read; the regex (process.env. prefix) excludes it.
//
//   - src/lib/gateway-types.ts:123 — JSDoc reference inside a
//     comment block. The stripComments() pass deletes block/line
//     comments before regex matching.
//
// EMPTY-style strictness: with only 1 known reader, this guard is
// just one notch above an empty allow-list — any second file that
// touches the env var trips the test. Same pattern as 4.221
// (ANTHROPIC_API_KEY), 4.223 (GITHUB_TOKEN), 4.224 (STRIPE_PLATFORM_KEY),
// 4.225 (SUPABASE_MGMT_TOKEN).
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

// Files allowed to read `ELEVENLABS_API_KEY` from process.env.
// Each entry has a real reason — see lane comment above.
const ENV_READ_ALLOWLIST = new Set<string>([
  "src/lib/adapters/elevenlabs-adapter.ts",
]);

describe("Lane 4.226 — ELEVENLABS_API_KEY env-var direct-read allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files read process.env.ELEVENLABS_API_KEY", () => {
    // Match `process.env.ELEVENLABS_API_KEY` (dot access) and
    // `process.env["ELEVENLABS_API_KEY"]` (bracket access).
    const re =
      /process\.env\s*(?:\.\s*ELEVENLABS_API_KEY\b|\[\s*["']ELEVENLABS_API_KEY["']\s*\])/;
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

  it("no destructured `const { ELEVENLABS_API_KEY } = process.env` outside allow-list", () => {
    // Destructuring assignment leaks the same value but evades dot/bracket
    // access regex. Match `{ ELEVENLABS_API_KEY` ... `} = process.env`.
    const re =
      /\{\s*[^}]*\bELEVENLABS_API_KEY\b[^}]*\}\s*=\s*process\.env/;
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
