import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.154 — drift guard: STRIPE_WEBHOOK_SECRET env-var
// direct-read allow-list.
//
// `STRIPE_WEBHOOK_SECRET` is the HMAC signing key that the Stripe
// webhook handler uses to verify incoming `Stripe-Signature` headers.
// It is the only thing that distinguishes a real Stripe event from
// a forged one. If a non-webhook file reads this value — e.g. a
// future "we need to verify a webhook payload here too" temptation,
// or a logging helper that wants to compute event signatures — that
// file becomes a new way for the secret to leak (logged, returned in
// an error message, written to a metrics tag, etc.). Once the secret
// leaks, an attacker can forge `invoice.payment_succeeded` events
// to mint credits, `charge.refunded` events to trigger the gateway's
// refund-clawback path against innocent users, or `customer.deleted`
// events to break account state.
//
// Today's env-var read surface is exactly ONE file:
//
//   - src/app/api/webhooks/stripe/route.ts — the only webhook handler.
//     Calls `stripe.webhooks.constructEvent(body, sig, SECRET)` to
//     verify Stripe-Signature on every incoming POST.
//
// Any new file reading `STRIPE_WEBHOOK_SECRET` directly is a new
// signing-key exposure surface. The diff reviewer must justify and
// either add to the allow-list or factor the verification call into
// a single-purpose helper that lives in the existing allow-listed
// file.
//
// Source-file regex parser only — registry imports often pull in
// createClient() / Stripe() at module load and crash without prod env
// (memory rule #59).
//
// Sibling guards:
//   - Lane 4.152 (SUPABASE_SERVICE_ROLE_KEY env-var allow-list)
//   - Lane 4.153 (STRIPE_SECRET_KEY env-var allow-list)
//   - Lane 4.20 (Stripe webhook idempotency — same route)
//   - Lane 4.29 (Stripe webhook replay-window — same route)
//   - Lane 4.62 (Stripe webhook body-size guard — same route)

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

// Files allowed to read `STRIPE_WEBHOOK_SECRET` from process.env.
// Each entry has a real reason — see lane comment above.
const ENV_READ_ALLOWLIST = new Set<string>([
  "src/app/api/webhooks/stripe/route.ts",
]);

describe("Lane 4.154 — STRIPE_WEBHOOK_SECRET env-var direct-read allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files read process.env.STRIPE_WEBHOOK_SECRET", () => {
    // Match `process.env.STRIPE_WEBHOOK_SECRET` (dot access) and
    // `process.env["STRIPE_WEBHOOK_SECRET"]` (bracket access).
    const re =
      /process\.env\s*(?:\.\s*STRIPE_WEBHOOK_SECRET\b|\[\s*["']STRIPE_WEBHOOK_SECRET["']\s*\])/;
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

  it("no destructured `const { STRIPE_WEBHOOK_SECRET } = process.env` outside allow-list", () => {
    // Destructuring assignment leaks the same value but evades dot/bracket
    // access regex. Match `{ STRIPE_WEBHOOK_SECRET` ... `} = process.env`.
    const re =
      /\{\s*[^}]*\bSTRIPE_WEBHOOK_SECRET\b[^}]*\}\s*=\s*process\.env/;
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
