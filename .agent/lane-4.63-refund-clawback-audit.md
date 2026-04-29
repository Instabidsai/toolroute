# Lane 4.63 — Stripe refund / dispute clawback gap audit

**Date:** 2026-04-28
**Author:** Claude (lane-4.63)
**Severity:** HIGH — direct revenue leak class, similar to Lane 4.20 (idempotency) / 4.51 (zero-estimate) / 4.52 (TOCTOU)

## Finding

`src/app/api/webhooks/stripe/route.ts` handles five Stripe event types:
- `checkout.session.completed` — adds credits or upgrades plan
- `invoice.paid` — adds plan renewal credits
- `invoice.payment_failed` — records dunning event
- `payment_intent.payment_failed` — records dunning event
- `customer.subscription.deleted` — downgrades to free

It does **NOT** handle:
- `charge.refunded` — Stripe issued a refund (full or partial) on a captured charge
- `charge.dispute.created` — customer filed a chargeback
- `charge.dispute.funds_withdrawn` — Stripe removed funds from our balance

## Attack / abuse path

1. User signs up, buys $50 of credits via Stripe Checkout
2. `checkout.session.completed` fires → `add_credits($50)` → balance += 50
3. User opens Stripe support ticket and gets a refund (or files a card dispute)
4. Stripe issues refund → fires `charge.refunded` webhook → **we ignore it**
5. User's `credit_balance` is still $50, fully spendable on real provider API calls
6. Net loss = the refunded $50 + the variable provider cost on whatever the user spends those credits on (e.g., Anthropic claude-opus tokens at gateway markup)

The credit_transactions schema already anticipates this: `type` enum includes
`"refund"` (`src/lib/gateway-types.ts:80`) — but no code path ever inserts a
refund row.

## Why this is independent of the refund POLICY

`/refunds` page says credits are "generally non-refundable." This is the
**voluntary-refund** policy. It does not bind:
- Card disputes (cardholder right under Reg E / chargeback rules)
- Stripe-initiated refunds when fraud is detected on the funding card
- Stripe-mandated refunds for sanctioned-region transactions
- Stripe support resolutions that override merchant policy

In all four cases Stripe will move funds without our consent — the only
question is whether the gateway clamps the spendable balance simultaneously.

## Proposed fix (not in this PR — split to Codex impl ticket)

Add three new cases to the webhook switch:

```ts
case "charge.refunded": {
  const charge = event.data.object as Stripe.Charge;
  const paymentIntentId = typeof charge.payment_intent === "string"
    ? charge.payment_intent
    : null;
  if (!paymentIntentId) break;

  // Find the original purchase
  const { data: original } = await sb
    .from("credit_transactions")
    .select("id, user_id, amount, type")
    .eq("stripe_payment_id", paymentIntentId)
    .in("type", ["purchase", "plan_credit"])
    .single();
  if (!original) break;

  // Idempotency: skip if we already recorded a refund for this charge
  const refundKey = `${paymentIntentId}:refund:${charge.id}`;
  const { data: existingRefund } = await sb
    .from("credit_transactions")
    .select("id")
    .eq("stripe_payment_id", refundKey)
    .single();
  if (existingRefund) break;

  // Refund the credits via SECURITY DEFINER RPC
  await sb.rpc("clawback_credits", {
    p_user_id: original.user_id,
    p_amount: original.amount,           // clamp to refunded amount if partial
    p_stripe_payment_id: refundKey,
    p_reason: "stripe_refund",
    p_original_tx_id: original.id,
  });
  break;
}

case "charge.dispute.funds_withdrawn": {
  // Treat same as refund — Stripe pulled the money
  // Same logic, p_reason: "stripe_dispute"
  break;
}
```

Required new RPC: `clawback_credits(p_user_id, p_amount, p_stripe_payment_id, p_reason, p_original_tx_id)`:
- Inserts credit_transactions row with `type = 'refund'`, negative amount
- Decrements `gateway_users.credit_balance` (down to a floor of 0 — never go negative)
- Idempotent on `stripe_payment_id` UNIQUE
- SECURITY DEFINER, EXECUTE granted to `service_role` only (anon REVOKED)

## Out-of-scope tail considerations

- **Negative balance after clawback** — if user already spent the credits on real provider calls, clamp to 0 and emit a `negative_balance_after_refund` audit event (no DB constraint can recover spent credits)
- **Partial refunds** — `charge.refunded` includes `amount_refunded` and the charge's total `amount`; clamp to `original.amount * (amount_refunded / charge.amount)` when partial
- **Plan-credit refunds** — invoice refunds for the monthly subscription credit grant; lower priority since plan credits are smaller
- **Auto-top-up loop** — make sure clawback does NOT re-fire `triggerAutoTopup`; clawback path should bypass auto-top-up

## Drift-prevention test (ship in same PR as impl)

`tests/unit/stripe-refund-handler-coverage.test.ts`:
- Parses `src/app/api/webhooks/stripe/route.ts` source
- Asserts the switch contains `case "charge.refunded":` and `case "charge.dispute.funds_withdrawn":`
- Asserts `clawback_credits` RPC is called inside both cases
- Asserts idempotency check on `stripe_payment_id` exists for each case
- Failing-snapshot pattern (Hard Rule #59) — gate behind `STRIPE_REFUND_BASELINE=skip` env if needed

## Codex implementation ticket

```
[CODEX TICKET — Lane 4.63-impl]
- Implement clawback_credits RPC (sql/rpcs/clawback_credits.sql) — SECURITY DEFINER, idempotent, floors balance at 0, emits audit event on negative-shortfall
- Add charge.refunded + charge.dispute.funds_withdrawn cases to webhook
- Add charge.dispute.created case → freeze key auto-creation for that user (lower priority)
- Ship drift test in same PR
- Test fixtures: real Stripe webhook payloads from stripe fixtures docs
- ~3 hours work; financial-leak class
```

## Status

- [x] Audit complete (this doc)
- [ ] Codex impl ticket queued (write to codex-build-queue.md if Justin wants)
- [ ] Implementation
- [ ] Drift test
