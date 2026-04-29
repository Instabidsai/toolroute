# Lane 4.88 — Auto-Top-Up TOCTOU Race Fires Multiple Stripe Charges Under Concurrency

**Class**: TOCTOU race condition — financial-side amplification
**Severity**: MEDIUM (customer-facing dispute/chargeback risk; HIGH if API key compromised)
**Date**: 2026-04-28
**Sibling lanes**: 4.52 (credit deduction TOCTOU — symmetric on the *spend* side), 4.20 (Stripe webhook idempotency), 4.23 (DB UNIQUE on credit_transactions(stripe_payment_id, type))

---

## Symptom

`src/lib/gateway.ts:165-211` `triggerAutoTopup`:

```ts
async function triggerAutoTopup(
  userId: string,
  stripeCustomerId: string,
  amountCents: number
): Promise<void> {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey || stripeKey.startsWith("placeholder")) return;

  // Check if there's already a pending top-up in the last 5 minutes (prevent spam)
  const sb = supabaseAdmin();
  const { data: recent } = await sb
    .from("credit_transactions")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "purchase")
    .gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
    .limit(1);

  if (recent && recent.length > 0) return; // Already topped up recently

  // Create a Stripe PaymentIntent for the auto-top-up amount
  const stripe = new Stripe(stripeKey);
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: "usd",
    customer: stripeCustomerId,
    off_session: true,
    confirm: true,
    metadata: { user_id: userId, type: "auto_topup", credit_amount: String(amountCents / 100) },
  });

  if (paymentIntent.status === "succeeded") {
    await sb.rpc("add_credits", { ... p_stripe_payment_id: paymentIntent.id ... });
  }
}
```

Caller (`gateway.ts:373-385`):

```ts
if (userRow && userRow.auto_topup_enabled && userRow.stripe_customer_id) {
  if (userRow.credit_balance <= (userRow.auto_topup_threshold ?? 1.00)) {
    triggerAutoTopup(ctx.userId, userRow.stripe_customer_id, userRow.auto_topup_amount_cents ?? 1000)
      .catch(err => console.error("Auto-top-up failed:", err));
  }
}
```

The "5-minute spam check" is a **read-then-write race**: two concurrent requests both query `credit_transactions`, both see no recent purchase, both proceed to create Stripe PaymentIntents.

---

## Race timeline

```
t+0ms    Request A:  SELECT recent purchases → []
t+5ms    Request B:  SELECT recent purchases → []      ← B passes the gate before A writes
t+50ms   Request A:  stripe.paymentIntents.create()    ← Stripe charge #1 fires
t+55ms   Request B:  stripe.paymentIntents.create()    ← Stripe charge #2 fires
t+200ms  Request A:  add_credits(p_stripe_payment_id="pi_AAA")
t+210ms  Request B:  add_credits(p_stripe_payment_id="pi_BBB")
```

Both PaymentIntents have unique IDs, so Lane 4.23's `UNIQUE(stripe_payment_id, type)` does **not** dedupe — both rows insert correctly because they reflect two real charges that actually happened.

The financial books are internally consistent (2 charges, 2 credit grants, balance increases by 2x amount) but the customer was **unexpectedly charged twice**.

---

## Concrete impact

| Scenario | Customer-perceived outcome |
|---|---|
| Single low-balance request | 1 auto-top-up (correct) |
| 2 concurrent low-balance requests | 2 charges, 2x credits added (unexpected) |
| 10 concurrent depleting requests (e.g., agent loop) | Up to 10 charges in <5min window before spam-check sees any of them |
| Compromised API key drains balance + amplifies | Attacker can amplify victim's card debit 5-10x via burst calls |

Auto-top-up amount is customer-configured; default is `1000` cents = $10. A 5x amplification on a $50 auto-top-up = $250 unexpected card debit, well within chargeback territory.

---

## Why Lane 4.52's TOCTOU fix doesn't cover this

Lane 4.52 fixed the **deduct_credits** TOCTOU (concurrent execute calls double-spending). The fix was DB-level: `deduct_credits` uses an atomic `UPDATE ... SET credit_balance = credit_balance - $X WHERE credit_balance >= $X RETURNING ...` pattern.

The auto-top-up race is on a **different code path** — it doesn't go through `deduct_credits`. It's a separate read-then-Stripe-create race with no atomic primitive guarding it.

---

## Why this isn't caught by Lane 4.20 or 4.23

- **Lane 4.20** (Stripe webhook idempotency): only protects against Stripe re-firing the SAME webhook event. Doesn't help if our code creates TWO PaymentIntents.
- **Lane 4.23** (DB UNIQUE on credit_transactions): only dedupes by `stripe_payment_id`. Two real PaymentIntents have different IDs → both pass.

---

## Attack / abuse vectors

1. **Compromised API key amplification**: attacker steals a victim's `tr_live_` key, fires N concurrent calls right at low-balance threshold. Victim's card gets debited N × auto_topup_amount in <500ms. Sibling to Lane 4.85 (master-pool quota DoS) — both rely on burst-fire amplification.
2. **Honest agent rapid-fire**: customer's agent enters a tight loop at 1ms intervals while balance is near threshold → 50 charges fire before any of them log to credit_transactions (Stripe + add_credits both take ~100-500ms). Customer support burden + dispute risk.
3. **Race-condition griefing**: malicious user with valid free-tier key but no auto-top-up enabled cannot trigger this. Affects only customers who opted into auto-top-up. Mitigation: disable auto-top-up by default (already is — `auto_topup_enabled` defaults to false).

---

## Recommended fix — `[lane-4.88-impl]` Codex ticket

Three layers of defense (cheapest first):

### Layer 1 — Stripe idempotency key (4-line change, MUST-HAVE)

Pass a deterministic idempotency key tied to the user + 5-minute window. Stripe will return the SAME PaymentIntent for duplicate creates within 24 hours.

```ts
const idempotencyKey = `auto_topup_${userId}_${Math.floor(Date.now() / (5 * 60 * 1000))}`;
const paymentIntent = await stripe.paymentIntents.create(
  { amount: amountCents, currency: "usd", customer: stripeCustomerId,
    off_session: true, confirm: true,
    metadata: { user_id: userId, type: "auto_topup", credit_amount: String(amountCents / 100) } },
  { idempotencyKey }
);
```

This alone closes the financial leak: even under 1000 concurrent fires, only ONE charge happens. Subsequent calls to `add_credits` with the same `paymentIntent.id` get deduped by Lane 4.23's UNIQUE constraint.

**This is the minimum viable fix.**

### Layer 2 — DB-level advisory lock (defense-in-depth)

Wrap the entire `triggerAutoTopup` body in a Postgres advisory lock keyed on `userId`. Concurrent calls block (or skip) instead of racing.

```sql
-- in a SECURITY DEFINER RPC: try_acquire_topup_lock(p_user_id uuid) RETURNS bool
SELECT pg_try_advisory_xact_lock(hashtext('auto_topup_' || p_user_id));
```

```ts
const { data: lockAcquired } = await sb.rpc("try_acquire_topup_lock", { p_user_id: userId });
if (!lockAcquired) return; // Another request is mid-topup — skip
// ... rest of the flow
```

Pros: stops the race at the application boundary, before any Stripe call.
Cons: requires new RPC + is xact-scoped (released at end of transaction); supabase-js doesn't expose explicit transactions, so use `pg_try_advisory_lock` (session-scoped) + an explicit `pg_advisory_unlock` in `finally`. OR use a row-level boolean flag with conditional UPDATE.

### Layer 3 — Row-level "topup_in_progress" flag (alternative to Layer 2)

```sql
ALTER TABLE gateway_users
  ADD COLUMN IF NOT EXISTS auto_topup_in_progress_until timestamptz;
```

```ts
const { data: claim } = await sb
  .from("gateway_users")
  .update({ auto_topup_in_progress_until: new Date(Date.now() + 30 * 1000).toISOString() })
  .eq("id", userId)
  .or("auto_topup_in_progress_until.is.null,auto_topup_in_progress_until.lt." + new Date().toISOString())
  .select("id");

if (!claim || claim.length === 0) return; // Another request claimed the slot
```

Pros: no new SQL function needed, atomic via PostgREST conditional update.
Cons: requires schema migration; needs cleanup logic for stuck "in progress" rows.

### Recommendation

Ship Layer 1 first (4 lines, closes the bleed). Layers 2/3 are optional defense-in-depth — Layer 1 alone is sufficient for the financial leak; Layer 2/3 only matter if Stripe's idempotency layer ever has a hiccup (extremely rare).

### Drift guard

`tests/unit/auto-topup-idempotent.test.ts` — parse `gateway.ts` source, assert `triggerAutoTopup`'s call to `paymentIntents.create` includes a second-argument options object with an `idempotencyKey` property derived from `userId`.

Pattern: regex `paymentIntents\.create\([^)]+\),\s*\{\s*idempotencyKey:` inside the `triggerAutoTopup` function body. Sibling to Lane 4.81/4.83/4.84/4.85/4.86/4.87 drift-guard tests.

---

## Acceptance

- [ ] `triggerAutoTopup` passes a deterministic `idempotencyKey` to `stripe.paymentIntents.create`
- [ ] Concurrent low-balance requests result in exactly 1 Stripe charge (verified via Stripe Dashboard test mode)
- [ ] Drift guard test fails if the idempotency key is removed
- [ ] Smoke test: fire 10 concurrent low-balance gateway calls → 1 PaymentIntent in Stripe, 1 row in credit_transactions
- [ ] Existing single-call auto-top-up flow unchanged (no behavioral regression)

## Out of scope

- Auto-top-up amount limits (e.g., max $X/day) — separate hardening lane
- Notification on auto-top-up fire (email confirmation) — UX enhancement, not security
- Card-validation policy (which payment methods qualify) — Stripe-side decision

## Related observations

- Lane 4.52 closed the symmetric TOCTOU on the *spend* side (concurrent deduct_credits). This closes the *fund* side. Together: "a customer's balance can change by exactly the financial events that actually happened, regardless of concurrency."
- Lane 4.85 (master-pool quota DoS) and this lane share an attack pattern: burst-fire amplification on financial side-effects. Different mitigations (per-key failure-rate gate vs. Stripe idempotency key) — both needed.
- Stripe documents the idempotency key pattern explicitly for off-session payments; we're not using a Stripe-novel feature, just one we missed wiring up.
