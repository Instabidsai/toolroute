import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.153 — drift guard: STRIPE_SECRET_KEY env-var direct-read
// allow-list.
//
// `STRIPE_SECRET_KEY` is the Stripe master credential — once read,
// the holder can charge any saved card, issue refunds, dump customer
// PII, mutate subscriptions, and pull the entire payment history of
// every gateway user. There is no Stripe-side RLS analogue: the key
// is the boundary. A new file that fetches `process.env.STRIPE_SECRET_KEY`
// directly to construct a parallel `new Stripe(...)` client (a one-off
// "I just need to charge this customer for a custom flow" temptation)
// silently expands the surface that can move money on the platform.
//
// Today's env-var read surface is exactly FOUR files:
//
//   - src/lib/stripe-billing.ts — canonical helper, exports the shared
//     Stripe client used by the rest of the app.
//   - src/lib/gateway.ts — the gateway constructs its own Stripe
//     client for credit-purchase + auto-top-up flows. Historical
//     duplication; consolidating is a separate refactor lane. Today's
//     drift guard freezes today's surface.
//   - src/app/api/webhooks/stripe/route.ts — webhook handler builds
//     its own Stripe client to verify event signatures.
//   - src/app/api/v1/checkout/route.ts — Stripe Checkout session
//     creation route.
//
// Any new file reading `STRIPE_SECRET_KEY` directly is a new
// payments-write surface. The diff reviewer must justify and either
// add to the allow-list or reroute through the canonical
// `stripe-billing.ts` helper.
//
// Source-file regex parser only — registry imports often pull in
// createClient() / Stripe() at module load and crash without prod env
// (memory rule #59).
//
// Sibling guards:
//   - Lane 4.152 (SUPABASE_SERVICE_ROLE_KEY env-var allow-list)
//   - Lane 4.132 / 4.135 (supabaseAdmin() callsite allow-list)
//   - Lane 4.42 (NEXT_PUBLIC_* envvar discipline drift guard)

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

// Files allowed to read `STRIPE_SECRET_KEY` from process.env.
// Each entry has a real reason — see lane comment above.
const ENV_READ_ALLOWLIST = new Set<string>([
  "src/lib/stripe-billing.ts",
  "src/app/api/webhooks/stripe/route.ts",
]);

describe("Lane 4.153 — STRIPE_SECRET_KEY env-var direct-read allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files read process.env.STRIPE_SECRET_KEY", () => {
    // Match `process.env.STRIPE_SECRET_KEY` (dot access) and
    // `process.env["STRIPE_SECRET_KEY"]` (bracket access).
    const re =
      /process\.env\s*(?:\.\s*STRIPE_SECRET_KEY\b|\[\s*["']STRIPE_SECRET_KEY["']\s*\])/;
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

  it("no destructured `const { STRIPE_SECRET_KEY } = process.env` outside allow-list", () => {
    // Destructuring assignment leaks the same value but evades dot/bracket
    // access regex. Match `{ STRIPE_SECRET_KEY` ... `} = process.env`.
    const re =
      /\{\s*[^}]*\bSTRIPE_SECRET_KEY\b[^}]*\}\s*=\s*process\.env/;
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
