# Lane 4.90 — `/api/v1/checkout` Creates a 2nd Subscription on Plan Change (HIGH revenue/trust)

**Class**: subscription-lifecycle bug — "upgrade" path does not modify the existing subscription
**Severity**: HIGH (customer is double-charged forever; refund + chargeback risk; brand damage)
**Date**: 2026-04-28
**Sibling lanes**: 4.86 (cancel→revoke `tr_live_`), 4.87 (double-credit on first invoice), 4.91 candidate (`customer.subscription.updated` handler missing)

---

## Symptom

User flow that triggers it:

1. New user signs up → `gateway_users.plan_slug = "free"`
2. User clicks "Subscribe to Pro" on `/dashboard/billing`
3. Stripe checkout completes → webhook sets `plan_slug = "pro"`, creates Pro subscription `sub_A`
4. User clicks "Upgrade to Enterprise" on the same page
5. **Bug**: front-end calls `POST /api/v1/checkout` with `{ type: "subscription", plan: "enterprise" }`
6. `/api/v1/checkout` blindly creates a SECOND `mode: "subscription"` Stripe checkout session
7. User completes checkout → `checkout.session.completed` fires for Enterprise
8. Webhook overwrites `plan_slug = "enterprise"`, creates Enterprise subscription `sub_B`
9. **Stripe is now billing the customer BOTH `sub_A` ($5/mo) AND `sub_B` ($50/mo)** every cycle. Pro one is invisible to ToolRoute (we only track `plan_slug`).

The customer expected "upgrade" to mean "switch from Pro to Enterprise". Stripe's subscription model requires an explicit `subscriptions.update()` API call for that — checkout cannot replace an existing subscription.

---

## Code locations

### 1. Front-end button does not differentiate "first subscription" vs "switch"

`src/app/dashboard/billing/page.tsx:170-196`:

```ts
const handleUpgradePlan = async (plan: string) => {
  setCheckoutLoading(true);
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch("/api/v1/checkout", {
      method: "POST",
      headers: { ... },
      body: JSON.stringify({ type: "subscription", plan }),
    });
    // ...
  }
};
```

Same handler is used whether the user is on free, pro, or enterprise plan.

### 2. Server endpoint never checks for existing subscription

`src/app/api/v1/checkout/route.ts:81-101`:

```ts
if (type === "subscription") {
  const priceId = PLAN_PRICES[plan ?? ""];
  if (!priceId) {
    return NextResponse.json({ error: ... }, { status: 400, ... });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: email,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { user_id: userId, type: "subscription", plan: plan! },
    success_url: ...,
    cancel_url: ...,
  });

  return NextResponse.json({ checkout_url: session.url }, ...);
}
```

No lookup of `gateway_users.stripe_customer_id`, no Stripe `subscriptions.list({ customer })` query, no branching on "existing subscriber → modify, new subscriber → checkout".

### 3. Webhook overwrites `plan_slug` blindly on the new sub

`src/app/api/webhooks/stripe/route.ts:152-197` (`checkout.session.completed → type === "subscription"`):

```ts
if (planRow) {
  await sb.from("gateway_users").update({
    plan_id: planRow.id,
    plan_slug: plan,            // <-- overwrites silently, no awareness of prior sub
    stripe_customer_id: session.customer as string,
    updated_at: new Date().toISOString(),
  }).eq("id", userId);
  // ... and grants enterprise PLAN_CREDITS on top
}
```

The Pro subscription `sub_A` is now orphaned in Stripe — billing the customer monthly with no UI surface to cancel it (ToolRoute has no Customer Portal wired; Lane 4.86 audit confirmed `billing_portal` not used anywhere).

---

## Why this slipped past Lane 4.20 (idempotency) and Lane 4.87 (double-credit)

- **Lane 4.20** focused on duplicate webhook *events* keying on `stripe_payment_id`. This bug is about duplicate *subscriptions* — both are valid first-time events with distinct payment IDs, so idempotency keys see them as legitimate.
- **Lane 4.87** caught the `subscription_create` invoice double-counting credits (mismatched key bug). It does NOT cover the case where the customer's *intent* is "switch", but the system creates two subs.

---

## Concrete impact scenarios

| Scenario | Result | Severity |
|---|---|---|
| Pro user clicks "Upgrade to Enterprise" | Charged $5 + $50/mo forever; ToolRoute thinks they're enterprise | HIGH revenue-misalignment + chargeback risk |
| Enterprise user clicks "Downgrade to Pro" | Same — both subs active, billed $50 + $5/mo, app thinks they're pro | HIGH |
| Pro user resubscribes after `subscription.deleted` | Old sub already cancelled (no overlap) — this case is FINE | OK |
| Free user clicks "Subscribe to Pro" | First subscription, no prior sub — works correctly | OK |

The bug is bounded to **the first plan change after the initial subscription**. After that point the customer has `n` overlapping subs. Once chargebacks land, Stripe's risk team flags the account.

---

## Recommended fix — `[lane-4.90-impl]` Codex ticket

Two-part fix. Both parts are required; either alone leaves the system half-broken.

### Part A — `/api/v1/checkout` route: detect existing subscription and refuse new-checkout path

In `src/app/api/v1/checkout/route.ts`, before `stripe.checkout.sessions.create({ mode: "subscription", ... })`:

```ts
if (type === "subscription") {
  const priceId = PLAN_PRICES[plan ?? ""];
  if (!priceId) {
    return NextResponse.json({ error: ... }, { status: 400, ... });
  }

  // Check for existing active subscription
  const sb = supabaseAdmin();
  const { data: userRow } = await sb
    .from("gateway_users")
    .select("stripe_customer_id, plan_slug")
    .eq("id", userId)
    .single();

  if (userRow?.stripe_customer_id) {
    const existing = await stripe.subscriptions.list({
      customer: userRow.stripe_customer_id,
      status: "active",
      limit: 1,
    });

    if (existing.data.length > 0) {
      // Plan change — use update flow, not new checkout
      const sub = existing.data[0];
      const itemId = sub.items.data[0].id;

      await stripe.subscriptions.update(sub.id, {
        items: [{ id: itemId, price: priceId }],
        proration_behavior: "create_prorations",
        metadata: { user_id: userId, plan: plan! },
      });

      // Webhook will fire customer.subscription.updated — handle there
      return NextResponse.json(
        { plan_changed: true, message: "Plan updated. New rate effective next billing cycle." },
        { headers: AUTHED_RESPONSE_HEADERS }
      );
    }
  }

  // No existing sub → normal first-checkout flow (existing code unchanged)
  const session = await stripe.checkout.sessions.create({ ... });
  return NextResponse.json({ checkout_url: session.url }, ...);
}
```

### Part B — webhook: handle `customer.subscription.updated`

Add to `src/app/api/webhooks/stripe/route.ts`:

```ts
case "customer.subscription.updated": {
  const sub = event.data.object as Stripe.Subscription;
  const customerId = sub.customer as string;

  // Determine new plan from active price ID
  const priceId = sub.items.data[0]?.price?.id;
  if (!priceId) break;

  // Reverse-lookup price → plan slug
  const planSlug = priceId === process.env.STRIPE_PRICE_PRO ? "pro"
                 : priceId === process.env.STRIPE_PRICE_ENTERPRISE ? "enterprise"
                 : null;
  if (!planSlug) break;

  const { data: planRow } = await sb
    .from("plans")
    .select("id")
    .eq("slug", planSlug)
    .single();

  if (planRow) {
    await sb.from("gateway_users").update({
      plan_id: planRow.id,
      plan_slug: planSlug,
      updated_at: new Date().toISOString(),
    }).eq("stripe_customer_id", customerId);

    console.log(`Plan-change synced for customer ${customerId} → ${planSlug}`);
  }
  break;
}
```

**Note**: do NOT grant PLAN_CREDITS on `subscription.updated`. The next `invoice.paid` for `subscription_cycle` (post-Lane-4.87 fix) will grant the new tier's monthly allotment correctly. Granting on the update event would cause a third double-credit class.

### Front-end: minor copy update (optional)

Show "Switch to Enterprise" instead of "Upgrade" when user already has a paid plan. Server returns `plan_changed: true` instead of `checkout_url` → front-end shows confirmation toast instead of redirecting to Stripe.

---

## Drift guard

`tests/unit/checkout-prevents-double-subscription.test.ts` — parse `src/app/api/v1/checkout/route.ts` source and assert:

1. The `type === "subscription"` branch contains a `stripe.subscriptions.list` call before `checkout.sessions.create`
2. The branch contains a `stripe.subscriptions.update` call (the plan-change path)

Webhook drift guard: `tests/unit/stripe-webhook-handles-subscription-updated.test.ts` — assert `route.ts` source contains `case "customer.subscription.updated":` block with a `gateway_users.update` call.

---

## Acceptance

- [ ] `/api/v1/checkout` with `type=subscription` for an existing subscriber calls `stripe.subscriptions.update`, not `checkout.sessions.create`
- [ ] Webhook handles `customer.subscription.updated` and syncs `plan_slug`
- [ ] No `PLAN_CREDITS` grant fires on `subscription.updated` (next `invoice.paid` covers it)
- [ ] Two drift-guard tests in place
- [ ] Smoke test: subscribe to Pro → click Upgrade Enterprise → verify only ONE active sub in Stripe + plan_slug=enterprise

## Out of scope

- Refunding existing customers who got double-charged before the fix lands — separate ops task once the fix is in production. Justin can pull `stripe.subscriptions.list({ customer, status: "active" })` per affected user from logs and cancel/refund the older sub.
- Customer Portal integration (Stripe-hosted subscription management UI) — separate Lane 4.92 candidate; not load-bearing for this fix because we own the upgrade button entirely.
- Subscription pause/resume (`customer.subscription.paused`, `customer.subscription.resumed`) — not currently exposed, separate lane if/when wired.

## Related observations

- **Lane 4.86** revokes `tr_live_` keys on `subscription.deleted` — once 4.86+4.90 ship, the plan-lifecycle invariant is: "`gateway_users.plan_slug` always matches the active Stripe subscription's price tier". Front door (4.3 paid-plan gate) + back door (4.86 cancel revoke) + side door (4.90 plan change) = closed.
- The `customer.subscription.updated` event is also what fires when a subscription's payment method changes, when prorations are applied, etc. Our handler should be a NO-OP for those — only act when `priceId` differs from the user's current `plan_slug`'s priceId. The proposed code naturally handles this (planSlug derived from priceId; if it matches existing plan_slug, the update is a harmless re-write).
