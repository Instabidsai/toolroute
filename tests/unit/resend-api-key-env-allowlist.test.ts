import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.220 — drift guard: RESEND_API_KEY env-var direct-read
// allow-list.
//
// `RESEND_API_KEY` is the platform-level send-as-anyone credential
// for transactional email. A holder of this key can send mail from
// any verified-domain identity ToolRoute owns (signup verification,
// billing dunning, future password-reset, etc.). The risk is two
// classes of drift:
//
//   1. Phishing-fanout — a new file that reads RESEND_API_KEY
//      directly to "just send a one-off email" can spoof
//      ToolRoute-branded mail to any user without going through
//      a reviewable helper.
//   2. BYOK-bypass — the resend-adapter exposes a per-user BYOK
//      fallback chain (memory rule: provider keys come from
//      user_provider_keys first, platform key second). A new
//      direct env-var read sidesteps the fallback and silently
//      bills the platform's Resend account for end-user sends.
//
// Today's env-var read surface is exactly THREE files:
//
//   - src/lib/adapters/resend-adapter.ts — the canonical adapter
//     used by the gateway's send-mail tool. Implements the BYOK
//     fallback (line 8: `byokKey || process.env.RESEND_API_KEY`).
//   - src/app/api/v1/signup/route.ts — sends the post-signup
//     verification email; runs at user-creation time before the
//     user has any BYOK rows so platform key is the only option
//     (line 66).
//   - src/lib/stripe-dunning.ts — sends past-due / payment-failed
//     dunning notifications; platform-owned billing flow, never
//     user-attributable (line 29).
//
// Out-of-scope (not a process.env read):
//
//   - src/lib/adapter-availability.ts:41 — `resend: ["RESEND_API_KEY"]`
//     is a string literal in the adapter→required-env config map,
//     used to compute the platform-availability boolean. Not a
//     credential read; the regex (process.env. prefix) excludes it.
//
// Any new file reading `RESEND_API_KEY` directly is a new
// platform-mail-send surface. The diff reviewer must justify and
// either add to the allow-list or reroute through the
// resend-adapter (which enforces the BYOK fallback).
//
// Source-file regex parser only — registry imports often pull in
// createClient() / Resend() at module load and crash without prod
// env (memory rule #59).
//
// Sibling guards:
//   - Lane 4.152 (SUPABASE_SERVICE_ROLE_KEY env-var allow-list)
//   - Lane 4.153 (STRIPE_SECRET_KEY env-var allow-list)
//   - Lane 4.154 (STRIPE_WEBHOOK_SECRET env-var allow-list)
//   - Lane 4.155 (TOOLROUTE_ADMIN_SECRET env-var allow-list)

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

// Files allowed to read `RESEND_API_KEY` from process.env.
// Each entry has a real reason — see lane comment above.
const ENV_READ_ALLOWLIST = new Set<string>([
  "src/lib/adapters/resend-adapter.ts",
  "src/app/api/v1/signup/route.ts",
  "src/lib/stripe-dunning.ts",
]);

describe("Lane 4.220 — RESEND_API_KEY env-var direct-read allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files read process.env.RESEND_API_KEY", () => {
    // Match `process.env.RESEND_API_KEY` (dot access) and
    // `process.env["RESEND_API_KEY"]` (bracket access).
    const re =
      /process\.env\s*(?:\.\s*RESEND_API_KEY\b|\[\s*["']RESEND_API_KEY["']\s*\])/;
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

  it("no destructured `const { RESEND_API_KEY } = process.env` outside allow-list", () => {
    // Destructuring assignment leaks the same value but evades dot/bracket
    // access regex. Match `{ RESEND_API_KEY` ... `} = process.env`.
    const re =
      /\{\s*[^}]*\bRESEND_API_KEY\b[^}]*\}\s*=\s*process\.env/;
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
