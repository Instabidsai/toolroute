# Lane 4.87 — Stripe Webhook Grants Double Plan Credits on First Subscription Invoice

**Class**: financial-accuracy bug — duplicate credit grant via two webhook handlers with mismatched idempotency keys
**Severity**: MEDIUM (revenue leak; every new pro signup gets $5 extra, every new enterprise signup gets $50 extra)
**Date**: 2026-04-28
**Sibling lanes**: 4.20 (Stripe webhook idempotency — covered the within-handler dedupe; missed the cross-handler interaction), 4.86 (subscription cancel revoke gap), 4.63 (refund clawback)

---

## Symptom

`src/app/api/webhooks/stripe/route.ts` has TWO handlers that grant `plan_credit` rows on a paid subscription, and they use **different idempotency keys** so they don't dedupe each other:

### Handler A: `checkout.session.completed` (lines 152-197)

```ts
case "checkout.session.completed": {
  ...
  if (type === "subscription") {
    const plan = session.metadata?.plan;
    if (plan) {
      ...
      const planCredits = PLAN_CREDITS[plan] ?? 0;
      if (planCredits > 0 && session.subscription) {
        const { data: existingPlanTx } = await sb
          .from("credit_transactions")
          .select("id")
          .eq("stripe_payment_id", session.subscription as string)  // ← keyed on sub_xxx
          .maybeSingle();

        if (!existingPlanTx) {
          await sb.rpc("add_credits", {
            p_user_id: userId,
            p_amount: planCredits,
            p_type: "plan_credit",
            p_stripe_payment_id: session.subscription as string,  // ← stores sub_xxx
            p_description: `${plan} plan monthly credits`,
          });
        }
      }
    }
  }
  break;
}
```

### Handler B: `invoice.paid` (lines 201-236)

```ts
case "invoice.paid": {
  // Monthly subscription renewal — add plan credits (idempotent on invoice.id)
  const invoice = event.data.object as Stripe.Invoice;
  ...
  if (user && user.plan_slug && invoice.id) {
    const planCredits = PLAN_CREDITS[user.plan_slug] ?? 0;
    if (planCredits > 0) {
      const { data: existingRenewalTx } = await sb
        .from("credit_transactions")
        .select("id")
        .eq("stripe_payment_id", invoice.id)  // ← keyed on in_yyy
        .maybeSingle();

      if (!existingRenewalTx) {
        await sb.rpc("add_credits", {
          p_user_id: user.id,
          p_amount: planCredits,
          p_type: "plan_credit",
          p_stripe_payment_id: invoice.id,  // ← stores in_yyy
          p_description: `${user.plan_slug} plan monthly credits (renewal)`,
        });
      }
    }
  }
  break;
}
```

---

## Why this is a leak

When a new customer subscribes via Checkout:

1. Stripe creates the subscription
2. Stripe issues + auto-pays the **first** invoice (`billing_reason = "subscription_create"`)
3. Webhooks fire (order varies by Stripe; both always fire):
   - `checkout.session.completed` — Handler A grants `$X` credits keyed on `sub_xxx`
   - `invoice.paid` — Handler B looks up `stripe_payment_id = in_yyy`, finds nothing, grants **another** `$X` credits keyed on `in_yyy`

The two idempotency lookups never see each other's row because they query on different `stripe_payment_id` values:

| Event | Dedupe key stored | Dedupe key queried | Result |
|---|---|---|---|
| `checkout.session.completed` | `sub_1ABC...` | `sub_1ABC...` | inserts row |
| `invoice.paid` (first invoice) | `in_1XYZ...` | `in_1XYZ...` | inserts SECOND row |
| `invoice.paid` (month 2 renewal) | `in_2DEF...` | `in_2DEF...` | inserts row (correct) |

Result: every new pro signup gets `$5 + $5 = $10` of plan credits the first month instead of `$5`. Enterprise gets `$50 + $50 = $100` instead of `$50`.

`PLAN_CREDITS = { pro: 5.0, enterprise: 50.0 }` (line 6-9 of route.ts) — these are the per-month values being doubled.

---

## Money math

Assume Stripe pricing: pro $20/mo, enterprise $200/mo. Plan credits are the included-usage allowance.

| Plan | Stripe revenue / mo | Credits intended / mo | Credits actually granted, month 1 | Excess |
|---|---|---|---|---|
| pro | $20 | $5 | $10 | $5 (25% of revenue) |
| enterprise | $200 | $50 | $100 | $50 (25% of revenue) |

The leak compounds for every churn-and-resubscribe cycle, since each new subscription period triggers a fresh `checkout.session.completed` + `invoice.paid` pair on the first invoice. Lane 4.86 also touches this — a cancel-resubscribe abuse pattern would reset the leak each cycle.

---

## Why Lane 4.20 missed this

Lane 4.20 (Stripe webhook idempotency) verified each handler is internally idempotent — re-firing the same event won't double-insert. That's correct. The bug here is that **two different events** describing the same money flow (first-month plan credits) use different stable IDs as their dedupe key.

Stripe's own docs note this hazard: when both `checkout.session.completed` AND `invoice.paid` fire on a new subscription, you must choose ONE as the source of truth for first-month credit grants, OR use a dedupe key that is consistent across both (e.g., `subscription_id` everywhere).

---

## Recommended fix — `[lane-4.87-impl]` Codex ticket

Two acceptable shapes; **prefer Option 1** (smallest diff, cleanest semantics):

### Option 1 — make `invoice.paid` skip the first invoice

The first invoice fires with `billing_reason = "subscription_create"` (not `"subscription_cycle"`). Restrict Handler B to renewal invoices only:

```ts
case "invoice.paid": {
  const invoice = event.data.object as Stripe.Invoice;

  // Lane 4.87: only credit on RENEWAL invoices. The first invoice
  // (billing_reason = "subscription_create") is already credited by
  // checkout.session.completed, keyed on subscription_id.
  if (invoice.billing_reason !== "subscription_cycle") {
    break;
  }

  const customerId = invoice.customer as string;
  ...
  // (rest unchanged)
}
```

Pros: 4-line change, preserves both handlers' separate dedupe keys, matches Stripe's intent for `billing_reason`.
Cons: relies on Stripe `billing_reason` being correctly set (it always is, but it's still a string-match).

### Option 2 — unify the dedupe key

Make both handlers grant credits keyed on `subscription_id` (or `invoice_id` consistently). E.g. drop the plan-credit grant from `checkout.session.completed` and let `invoice.paid` handle BOTH the first and subsequent invoices.

Pros: single source of truth.
Cons: larger diff; reorders user-perceived credit-availability (credit lands a few seconds later, after `invoice.paid` rather than after checkout).

### Migration / data backfill

For users who already double-credited (any pro/enterprise subscriber whose first month was after the webhook went live), audit:

```sql
-- Find first-month double-credit pairs:
SELECT
  user_id,
  COUNT(*) AS plan_credit_rows,
  SUM(amount) AS total,
  MIN(created_at) AS first_grant,
  MAX(created_at) AS second_grant,
  array_agg(stripe_payment_id) AS payment_ids
FROM credit_transactions
WHERE type = 'plan_credit'
GROUP BY user_id, date_trunc('day', created_at)
HAVING COUNT(*) > 1
ORDER BY first_grant DESC;
```

Then either:
- Leave the bonus credits in place (cheap goodwill — likely the right call given the small per-user amount and the optics of clawback)
- Or insert a compensating `type = 'adjustment'` row of `-$X` for each affected user

Decision is Justin's; this lane's job is to stop the bleed forward. Backfill is out-of-scope for the Codex ticket.

### Drift guard

`tests/unit/stripe-webhook-no-double-credit.test.ts` — parse the route file source as text, assert that the `invoice.paid` case branch contains either:
- A `billing_reason !== "subscription_cycle"` guard (Option 1 fingerprint), OR
- No `add_credits` call with `type: "plan_credit"` (Option 2 fingerprint, i.e., plan-credit logic moved out)

Pattern: regex the `invoice.paid` case body, fail if BOTH the plan-credit grant AND no billing-reason guard are present. Sibling to Lane 4.81 / 4.83 / 4.84 / 4.85 / 4.86 drift-guard tests.

---

## Acceptance

- [ ] First invoice on a new subscription does NOT double-grant plan credits
- [ ] Month-2+ renewals still grant the correct monthly plan credits
- [ ] Drift guard test fails if the dedupe gap is reintroduced
- [ ] Smoke test: Stripe test-mode subscribe → check `credit_transactions` rows for that user → exactly one `plan_credit` row, amount = `PLAN_CREDITS[plan]`
- [ ] Cancel-and-resubscribe (Lane 4.86 sibling): re-subscribed customer gets exactly one new `plan_credit` row, not two

## Out of scope

- Backfill of already-double-credited users — Justin call (likely leave as goodwill)
- Refund / clawback policy — Lane 4.63
- Subscription downgrade plan-credit handling (e.g., enterprise → pro) — separate lane if needed
- BYOK or auto-top-up flows — different code paths, not affected

## Related observations

- Lane 4.20 closed the within-handler idempotency gap (re-fires of the SAME event don't double-insert). This lane closes the cross-handler gap (DIFFERENT events for the same money flow with mismatched dedupe keys).
- Lane 4.86 is the symmetric leak on the cancellation side; together with this lane the invariant becomes: "exactly one `plan_credit` row per (user, billing period), regardless of how many webhook events Stripe fires."
- The root cause is *two stable IDs naming the same financial event*. A general design rule: when the same business event has multiple Stripe IDs (subscription, invoice, payment_intent), pick ONE as the canonical dedupe key in `credit_transactions` and use it everywhere that touches that event.
