# Lane 4.20 — Stripe Webhook Idempotency Audit

**Date:** 2026-04-28
**Auditor:** Claude (APEX builder pattern)
**Scope:** `src/app/api/webhooks/stripe/route.ts` — every `add_credits` / mutating call
**Severity:** P1 (financial, double-grant of plan_credits on Stripe retry)
**Status:** 2 gaps found, defensive patch shipped this PR

---

## Why this matters

Stripe retries webhook deliveries on any non-2xx response for **up to 3 days** (exponential backoff, ~13 attempts). A single transient failure — DB hiccup, network blip, RPC timeout — between `add_credits` and the 200 response causes the same event to be redelivered. Without an idempotency check on the dedup column, every retry re-grants credits.

The existing `checkout.session.completed` (type=credits) and `payment_intent.succeeded` (auto_topup) branches already check `credit_transactions.stripe_payment_id` before calling `add_credits`. Two branches do not. Both grant `plan_credit`-type credits and are the renewal/upgrade money path.

---

## Findings

### Gap 1 — `checkout.session.completed` subscription branch (P1)
**Lines 152-187.** Initial subscription signup grants `PLAN_CREDITS[plan]` with `p_stripe_payment_id: session.subscription`.

```ts
// Add included plan credits
const planCredits = PLAN_CREDITS[plan] ?? 0;
if (planCredits > 0) {
  await sb.rpc("add_credits", {
    p_user_id: userId,
    p_amount: planCredits,
    p_type: "plan_credit",
    p_stripe_payment_id: session.subscription as string,
    p_description: `${plan} plan monthly credits`,
  });
}
```

**Problem:** No SELECT against `credit_transactions` to check if this `subscription` ID was already processed. If Stripe redelivers `checkout.session.completed` (e.g., the `gateway_users` plan_id update succeeded but the response timed out before sending 200), the user gets **2x plan_credits** on signup.

**Trigger conditions:** any 5xx from this handler, any timeout >30s (Stripe's wait), any DB connection drop mid-handler. Realistic probability over a year of subscription signups: not zero.

### Gap 2 — `invoice.paid` renewal handler (P1, more severe)
**Lines 191-215.** Monthly subscription renewal grants `PLAN_CREDITS[plan_slug]` with **no stripe_payment_id at all**.

```ts
case "invoice.paid": {
  // Monthly subscription renewal — add plan credits
  const invoice = event.data.object as Stripe.Invoice;
  // ...
  if (planCredits > 0) {
    await sb.rpc("add_credits", {
      p_user_id: user.id,
      p_amount: planCredits,
      p_type: "plan_credit",
      p_description: `${user.plan_slug} plan monthly credits (renewal)`,
    });
  }
  break;
}
```

**Problem:** Even worse than gap 1 — there's no idempotency key written at all. `add_credits` writes `credit_transactions` without `stripe_payment_id`. **Every retry adds credits.** And renewals fire monthly per subscriber, so every minor blip across a customer base of N becomes a financial loss.

**Trigger conditions:** same as gap 1 (5xx, timeout, DB blip). For the renewal path the blast radius scales with active subscriber count.

---

## Patch

Both gaps fixed in this PR (`src/app/api/webhooks/stripe/route.ts`):

1. **Gap 1:** Insert idempotency check before `add_credits` — SELECT from `credit_transactions` WHERE `stripe_payment_id = session.subscription`. Skip add_credits if exists. (The `gateway_users` plan_id update is naturally idempotent — UPDATE WHERE id=userId is safe to repeat.)

2. **Gap 2:** Pass `p_stripe_payment_id: invoice.id` to `add_credits` so the dedup column is populated. Insert idempotency check — SELECT from `credit_transactions` WHERE `stripe_payment_id = invoice.id`. Each Stripe invoice ID is unique per renewal cycle, so this naturally allows monthly grants while blocking same-invoice retries.

Both checks mirror the existing pattern at lines 116-125 (credits branch) — single SELECT with `.single()`, skip if data present.

---

## Test (paired vitest)

`tests/unit/webhook-idempotency-shape.test.ts` — regex-based snapshot drift test (no module imports, no DB). Asserts:
- Every `add_credits` call in the file is preceded by a `credit_transactions.select("id").eq("stripe_payment_id", ...)` check within a 30-line window
- Both `subscription` and `invoice.paid` branches pass `p_stripe_payment_id`
- Test fails on master if a future PR adds a new `add_credits` site without the dedup probe

Same pattern as Lane 4.15 (RPC EXECUTE grant guard) and Lane 4.19 (CORS drift). Per Hard Rule #59 — failing-snapshot test as drift TODO list.

---

## What is NOT covered

- **`add_credits` RPC body itself.** If the RPC is also marked `SECURITY DEFINER` and bypasses dedup logic at the DB level, the code-level check is the only defense. Lane 4.14 already locked anon callability — the worker path goes through service-role, so DB-level dedup is a future hardening.
- **Stripe-Event-ID header dedup.** A more robust pattern is to log every `event.id` to a `stripe_events` table and bail at the top of `POST` if seen. Out of scope this PR (touches more surface) — defensive in-handler dedup ships now.

---

## Cross-applies

This same audit pattern (dedup-on-stripe-id check before every credit-granting RPC call) applies to:
- **CallTwin** webhook handler — has Stripe webhook + credit-style billing
- **DropClose** webhook handler — Vapi/Stripe combination
- **AffixedAI** webhook handler — Stripe subscriptions for consulting retainers

Any product that takes recurring Stripe payments and grants in-app credits/quota needs this two-step audit:
1. Every `add_credits`/`grant_quota`/equivalent call is preceded by a dedup probe.
2. The dedup column is actually passed (gap 2 — easy to miss when the metadata path "doesn't have a payment id").
