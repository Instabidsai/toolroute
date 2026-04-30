import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.224 — drift guard: STRIPE_PLATFORM_KEY env-var direct-read
// allow-list.
//
// IMPORTANT — this is NOT the same env var as STRIPE_SECRET_KEY
// (Lane 4.153). The two are distinct credentials with different
// purposes:
//
//   - STRIPE_SECRET_KEY  → ToolRoute's OWN billing-infra Stripe
//     key (locked by Lane 4.153). Charges customers for credit
//     top-ups, manages ToolRoute's subscriptions, signs webhooks.
//     Read by: stripe-billing.ts, gateway.ts, webhooks/stripe,
//     v1/checkout. (4 readers.)
//
//   - STRIPE_PLATFORM_KEY → master-pool key for the `stripe`
//     adapter (this lane). End-users call the Stripe API
//     THROUGH ToolRoute (e.g., to create their own Stripe
//     customers / charges as a tool capability), with the
//     platform paying the per-call cost when no BYOK is provided.
//
// Why STRIPE_PLATFORM_KEY warrants a strict guard:
//
//   1. PRIVILEGED-OPERATION FANOUT — unlike a read-mostly LLM
//      master pool, Stripe operations are mutative: create
//      customers, charge cards, issue refunds, transfer funds.
//      A new file reading the env var directly to "just call
//      Stripe for this server-side flow" can move money from
//      the platform's Stripe account.
//
//   2. CLASS-A BOUNDARY DRIFT — Lanes 4.100 / 4.102 / 4.103
//      established Class-A master-pool semantics (resale risk,
//      cost attribution, BYOK preference). New direct readers
//      bypass the gating-aware adapter wrapper.
//
//   3. CROSS-ACCOUNT BILL CONTAMINATION — if a developer reaches
//      for the wrong env var (STRIPE_SECRET_KEY vs
//      STRIPE_PLATFORM_KEY) or destructures both, transactions
//      can charge against the wrong account. Locking one reader
//      per env var prevents that confusion class.
//
// Today's env-var read surface is exactly ONE file:
//
//   - src/lib/adapters/stripe-adapter.ts — the canonical adapter
//     used by the gateway's stripe tool. Implements the BYOK
//     fallback (line 8: `byokKey || process.env.STRIPE_PLATFORM_KEY`).
//
// Out-of-scope (not a process.env read):
//
//   - src/lib/adapter-availability.ts:50 — `stripe: ["STRIPE_PLATFORM_KEY"]`
//     is a string literal in the adapter→required-env config map,
//     used to compute the platform-availability boolean. Not a
//     credential read; the regex (process.env. prefix) excludes it.
//
// EMPTY-style strictness: with only 1 known reader, this guard is
// just one notch above an empty allow-list — any second file that
// touches the env var trips the test. Given the privileged-operation
// blast radius, this strictness is intentional.
//
// Source-file regex parser only — registry imports often pull in
// createClient() / Stripe() at module load and crash without
// prod env (memory rule #59).
//
// Sibling guards:
//   - Lane 4.152 (SUPABASE_SERVICE_ROLE_KEY env-var allow-list)
//   - Lane 4.153 (STRIPE_SECRET_KEY env-var allow-list)         ← DIFFERENT KEY
//   - Lane 4.154 (STRIPE_WEBHOOK_SECRET env-var allow-list)
//   - Lane 4.155 (TOOLROUTE_ADMIN_SECRET env-var allow-list)
//   - Lane 4.220 (RESEND_API_KEY env-var allow-list)
//   - Lane 4.221 (ANTHROPIC_API_KEY env-var allow-list)
//   - Lane 4.222 (OPENAI_API_KEY env-var allow-list)
//   - Lane 4.223 (GITHUB_TOKEN env-var allow-list)

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

// Files allowed to read `STRIPE_PLATFORM_KEY` from process.env.
// Each entry has a real reason — see lane comment above.
const ENV_READ_ALLOWLIST = new Set<string>([
  "src/lib/adapters/stripe-adapter.ts",
]);

describe("Lane 4.224 — STRIPE_PLATFORM_KEY env-var direct-read allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files read process.env.STRIPE_PLATFORM_KEY", () => {
    // Match `process.env.STRIPE_PLATFORM_KEY` (dot access) and
    // `process.env["STRIPE_PLATFORM_KEY"]` (bracket access).
    const re =
      /process\.env\s*(?:\.\s*STRIPE_PLATFORM_KEY\b|\[\s*["']STRIPE_PLATFORM_KEY["']\s*\])/;
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

  it("no destructured `const { STRIPE_PLATFORM_KEY } = process.env` outside allow-list", () => {
    // Destructuring assignment leaks the same value but evades dot/bracket
    // access regex. Match `{ STRIPE_PLATFORM_KEY` ... `} = process.env`.
    const re =
      /\{\s*[^}]*\bSTRIPE_PLATFORM_KEY\b[^}]*\}\s*=\s*process\.env/;
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
