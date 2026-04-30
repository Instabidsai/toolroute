import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.221 — drift guard: ANTHROPIC_API_KEY env-var direct-read
// allow-list.
//
// `ANTHROPIC_API_KEY` is the platform-level Claude master credential.
// A holder of this key can drive Claude Sonnet/Opus calls billed to
// the ToolRoute org account at full token cost. This is the canonical
// Class-A master-pool resale risk (see Lane 4.100 P0 audit memo and
// Lane 4.102 broken-by-design master-pool class audit) — every
// platform-key reader is a place where end-user-attributable cost
// flows into the platform's Anthropic bill rather than the user's
// BYOK Anthropic account.
//
// Two classes of drift are locked here:
//
//   1. BYOK-bypass — the claude-adapter exposes a per-user BYOK
//      fallback chain (`byokKey || process.env.ANTHROPIC_API_KEY`).
//      A new file that reads the env var directly to "just call
//      Claude for this one server-side flow" sidesteps the fallback
//      and silently bills the platform for what should be a
//      user-attributable charge.
//
//   2. Per-user-cost-attribution drift — Lane 4.103 / 4.104
//      established that catalog-listing and gating decisions must
//      respect the Class-A boundary. New direct env-var readers
//      bypass the gating-aware wrapper.
//
// Today's env-var read surface is exactly ONE file:
//
//   - src/lib/adapters/claude-adapter.ts — the canonical adapter
//     used by the gateway's claude tool. Implements the BYOK
//     fallback (line 11: `byokKey || process.env.ANTHROPIC_API_KEY`).
//     Single read; the two error-message string-literal references
//     in this same file are not env reads (no process.env. prefix).
//
// Out-of-scope (not a process.env read):
//
//   - src/lib/adapter-availability.ts:14 — `claude: ["ANTHROPIC_API_KEY"]`
//     is a string literal in the adapter→required-env config map,
//     used to compute the platform-availability boolean. Not a
//     credential read; the regex (process.env. prefix) excludes it.
//
// Any new file reading `ANTHROPIC_API_KEY` directly is a new
// platform-billed Claude call surface. The diff reviewer must
// justify and either add to the allow-list or reroute through
// the claude-adapter (which enforces the BYOK fallback).
//
// EMPTY-style strictness: with only 1 known reader, this guard is
// just one notch above an empty allow-list — any second file that
// touches the env var trips the test.
//
// Source-file regex parser only — registry imports often pull in
// createClient() / Anthropic() at module load and crash without
// prod env (memory rule #59).
//
// Sibling guards:
//   - Lane 4.152 (SUPABASE_SERVICE_ROLE_KEY env-var allow-list)
//   - Lane 4.153 (STRIPE_SECRET_KEY env-var allow-list)
//   - Lane 4.154 (STRIPE_WEBHOOK_SECRET env-var allow-list)
//   - Lane 4.155 (TOOLROUTE_ADMIN_SECRET env-var allow-list)
//   - Lane 4.220 (RESEND_API_KEY env-var allow-list)

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

// Files allowed to read `ANTHROPIC_API_KEY` from process.env.
// Each entry has a real reason — see lane comment above.
const ENV_READ_ALLOWLIST = new Set<string>([
  "src/lib/adapters/claude-adapter.ts",
]);

describe("Lane 4.221 — ANTHROPIC_API_KEY env-var direct-read allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files read process.env.ANTHROPIC_API_KEY", () => {
    // Match `process.env.ANTHROPIC_API_KEY` (dot access) and
    // `process.env["ANTHROPIC_API_KEY"]` (bracket access).
    const re =
      /process\.env\s*(?:\.\s*ANTHROPIC_API_KEY\b|\[\s*["']ANTHROPIC_API_KEY["']\s*\])/;
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

  it("no destructured `const { ANTHROPIC_API_KEY } = process.env` outside allow-list", () => {
    // Destructuring assignment leaks the same value but evades dot/bracket
    // access regex. Match `{ ANTHROPIC_API_KEY` ... `} = process.env`.
    const re =
      /\{\s*[^}]*\bANTHROPIC_API_KEY\b[^}]*\}\s*=\s*process\.env/;
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
