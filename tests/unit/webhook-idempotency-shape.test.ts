import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Lane 4.20 drift-prevention: every `sb.rpc("add_credits", ...)` call in the
 * Stripe webhook must be preceded by a `credit_transactions` dedup probe within
 * the same handler block. Catches two failure modes:
 *
 *   1. New event handler grants credits without checking for existing tx
 *      → Stripe retries on 5xx for 3 days = double-grant
 *   2. add_credits called without `p_stripe_payment_id` set
 *      → no idempotency key written = every retry adds credits
 *
 * Per Hard Rule #59 — failing-snapshot test as drift TODO list. Source-file
 * regex parse only, no module imports (route file pulls in stripe + supabase
 * which require runtime env).
 */

const ROUTE_PATH = resolve(__dirname, "../../src/app/api/webhooks/stripe/route.ts");

function loadRoute(): string {
  return readFileSync(ROUTE_PATH, "utf8");
}

describe("Stripe webhook idempotency shape", () => {
  it("every add_credits call has a stripe_payment_id parameter", () => {
    const src = loadRoute();
    // Find every add_credits invocation and capture the object literal that follows.
    const callRe = /sb\.rpc\(\s*["']add_credits["']\s*,\s*\{([\s\S]*?)\}\s*\)/g;
    const calls = [...src.matchAll(callRe)];
    expect(calls.length).toBeGreaterThan(0);
    for (const m of calls) {
      const body = m[1];
      expect(body, `add_credits call missing p_stripe_payment_id at offset ${m.index}: ${body.slice(0, 80)}`).toMatch(
        /p_stripe_payment_id\s*:/,
      );
    }
  });

  it("every add_credits call is preceded by a credit_transactions dedup probe", () => {
    const src = loadRoute();
    const callRe = /sb\.rpc\(\s*["']add_credits["']\s*,\s*\{[\s\S]*?\}\s*\)/g;
    const calls = [...src.matchAll(callRe)];
    expect(calls.length).toBeGreaterThan(0);
    for (const m of calls) {
      const start = m.index ?? 0;
      // Look back 1500 chars within the same handler block for a probe pattern.
      const window = src.slice(Math.max(0, start - 1500), start);
      const hasProbe =
        /\.from\(\s*["']credit_transactions["']\s*\)[\s\S]*?\.select\(\s*["']id["']\s*\)[\s\S]*?\.eq\(\s*["']stripe_payment_id["']/.test(
          window,
        );
      expect(
        hasProbe,
        `add_credits at offset ${start} not preceded by credit_transactions dedup probe within window`,
      ).toBe(true);
    }
  });

  it("checkout.session.completed subscription branch grants credits idempotently", () => {
    const src = loadRoute();
    // Find the subscription if and walk forward until we hit the next case statement.
    const startMatch = src.match(/if\s*\(\s*type\s*===\s*["']subscription["']\s*\)\s*\{/);
    expect(startMatch, "subscription branch in checkout.session.completed not found").toBeTruthy();
    const start = (startMatch!.index ?? 0) + startMatch![0].length;
    const tail = src.slice(start);
    const endIdx = tail.search(/\n\s*case\s+["']/);
    const branch = endIdx >= 0 ? tail.slice(0, endIdx) : tail;
    expect(branch, "subscription branch missing dedup probe").toMatch(/credit_transactions/);
    expect(branch, "subscription branch missing stripe_payment_id reference").toMatch(/stripe_payment_id/);
    expect(branch, "subscription branch must dedup on session.subscription").toMatch(/session\.subscription/);
  });

  it("invoice.paid renewal handler grants credits idempotently on invoice.id", () => {
    const src = loadRoute();
    const startMatch = src.match(/case\s+["']invoice\.paid["']\s*:\s*\{/);
    expect(startMatch, "invoice.paid case not found").toBeTruthy();
    const start = (startMatch!.index ?? 0) + startMatch![0].length;
    const tail = src.slice(start);
    const endIdx = tail.search(/\n\s*case\s+["']/);
    const branch = endIdx >= 0 ? tail.slice(0, endIdx) : tail;
    expect(branch, "invoice.paid handler missing dedup probe").toMatch(/credit_transactions/);
    expect(branch, "invoice.paid handler missing stripe_payment_id eq filter").toMatch(
      /\.eq\(\s*["']stripe_payment_id["']\s*,\s*invoice\.id\s*\)/,
    );
    expect(branch, "invoice.paid add_credits must pass invoice.id as stripe_payment_id").toMatch(
      /p_stripe_payment_id\s*:\s*invoice\.id/,
    );
  });
});
