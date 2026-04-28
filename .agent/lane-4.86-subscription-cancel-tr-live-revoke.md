# Lane 4.86 — Subscription Cancellation Doesn't Revoke `tr_live_` Keys (premium-feature leak)

**Class**: privilege-leak after entitlement loss — paid features keep working after subscription cancellation
**Severity**: MEDIUM (revenue leak; cancelled customers retain premium API/MCP/A2A access)
**Date**: 2026-04-28
**Sibling lanes**: 4.3 (`tr_live_` paid-plan creation gate — does NOT cover post-creation revocation), 4.63 (refund clawback gap), 4.64 (starter-credit policy drift)

---

## Symptom

`src/app/api/webhooks/stripe/route.ts:322-345` (`customer.subscription.deleted`):

```ts
case "customer.subscription.deleted": {
  // Downgrade to free
  const sub = event.data.object as Stripe.Subscription;
  const customerId = sub.customer as string;

  const { data: freePlan } = await sb
    .from("plans")
    .select("id")
    .eq("slug", "free")
    .single();

  if (freePlan) {
    await sb
      .from("gateway_users")
      .update({
        plan_id: freePlan.id,
        plan_slug: "free",
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_customer_id", customerId);
    console.log(`Downgraded customer ${customerId} to free plan`);
  }
  break;
}
```

When a customer cancels their subscription:

✅ `gateway_users.plan_slug` is set to `"free"`
✅ `gateway_users.plan_id` is set to free plan ID
✅ Future rate-limit lookups will use free-tier rpm/rpd (since `getKeyContext` joins on plan)

❌ `api_keys` rows are **not touched** — all the customer's existing
   `tr_live_` keys (created during their paid period via Lane 4.3 gate)
   remain `is_active = true`

---

## Why this is a leak

`tr_live_` keys carry **runtime authority** that `tr_test_` keys don't:

- **`/mcp` route** (`src/app/mcp/route.ts:114`):
  ```ts
  if (!authHeader || !authHeader.startsWith("Bearer tr_live_")) {
    // reject 401
  }
  ```
  → Cancelled customer's old `tr_live_` key still passes this check.

- **`/api/a2a` route** (`src/app/api/a2a/route.ts:117`):
  ```ts
  if (!authHeader || !authHeader.startsWith("Bearer tr_live_")) {
    // reject 401
  }
  ```
  → Same.

Lane 4.3 (gate `tr_live_` creation behind paid plan) closes the front
door. This lane is the **back door**: existing `tr_live_` keys outlive
the paid subscription that authorized them.

---

## Concrete cancelled-customer entitlements that survive

After `customer.subscription.deleted`:

| Entitlement | Free tier | Cancelled paid | Should be |
|---|---|---|---|
| Rate limit (rpm/rpd) | Free | Free ✅ | Free |
| Master-pool execute (`/api/v1/execute`) | Allowed (Lane 4.85) | Allowed | Allowed (free has master access) |
| **MCP protocol (`/mcp`)** | **Denied** | **Allowed ❌** | **Denied** |
| **A2A protocol (`/api/a2a`)** | **Denied** | **Allowed ❌** | **Denied** |
| Credit balance | $0 (free) | Unchanged | Unchanged (paid for) |
| BYOK keys | Allowed | Allowed | Allowed (user property) |

The two ❌ rows are the leak. MCP + A2A are pitched as paid features
(see /agents page marketing) — cancelled customers retain access for
free as long as they kept any old `tr_live_` key.

---

## Attack / abuse scenarios

1. **Subscribe-cancel cycle**: customer subscribes for one billing
   cycle, creates dozens of `tr_live_` keys, cancels. Now has perpetual
   MCP+A2A access on a free plan.
2. **Account hibernation**: customer with `tr_live_` keys lets
   subscription lapse for months, comes back, finds keys still work.
   They're effectively "free pro" forever.
3. **Honest user confusion**: customer cancels, expects MCP to stop
   working, finds it still does → support burden + brand-trust hit if
   they later notice + complain about being billed for a service they
   thought ended.

---

## Recommended fix — `[lane-4.86-impl]` Codex ticket

Mechanical, single-file change to the webhook handler:

```ts
case "customer.subscription.deleted": {
  const sub = event.data.object as Stripe.Subscription;
  const customerId = sub.customer as string;

  // Find the user
  const { data: userRow } = await sb
    .from("gateway_users")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (!userRow) break;

  const { data: freePlan } = await sb
    .from("plans")
    .select("id")
    .eq("slug", "free")
    .single();

  if (freePlan) {
    await sb
      .from("gateway_users")
      .update({
        plan_id: freePlan.id,
        plan_slug: "free",
        updated_at: new Date().toISOString(),
      })
      .eq("id", userRow.id);
  }

  // Revoke all tr_live_ keys (premium-feature gates check the prefix)
  // Customer can re-subscribe + create fresh keys; old keys cannot be
  // re-activated to prevent a "cancel + cycle" abuse vector.
  await sb
    .from("api_keys")
    .update({
      is_active: false,
      revoked_at: new Date().toISOString(),
      revoked_reason: "subscription_cancelled",
    })
    .eq("user_id", userRow.id)
    .like("key_prefix", "tr_live_%");

  console.log(`Downgraded customer ${customerId} + revoked tr_live_ keys`);
  break;
}
```

Schema changes (run separately via Lane 0.x migration):

```sql
ALTER TABLE api_keys
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_reason text;
```

(If `revoked_at` / `revoked_reason` already exist from another lane,
skip the DDL.)

### Drift guard

`tests/unit/subscription-cancel-revokes-tr-live.test.ts` — assert that
the webhook handler's `customer.subscription.deleted` branch contains
both:
- A `gateway_users` plan_slug=free update
- An `api_keys` is_active=false update with `tr_live_` filter

Pattern: parse the route file source as text, regex for both update
shapes inside the `customer.subscription.deleted` case block. Sibling
to Lane 4.81 / 4.83 / 4.84 / 4.85 drift-guard tests.

---

## Acceptance

- [ ] `customer.subscription.deleted` revokes all `tr_live_` keys for
  the cancelled customer
- [ ] `revoked_at` + `revoked_reason` columns added to `api_keys`
- [ ] Drift guard test fails if revocation step is removed
- [ ] Smoke test: subscribe → create tr_live_ key → cancel → verify
  /mcp returns 401 with that key
- [ ] Customer who later re-subscribes can create a fresh `tr_live_`
  key (Lane 4.3 gate path)

## Out of scope

- BYOK key revocation — those are customer-owned credentials, not a
  ToolRoute entitlement; cancellation should not touch them
- Credit balance refund — Lane 4.63 covers refund/clawback policy
- Grace period for "paid-cancelled but not yet downgraded" state —
  Stripe handles this via the `cancel_at_period_end` flag; webhook
  fires `customer.subscription.deleted` only when the period actually
  ends. Current behavior (immediate revoke at end-of-period) is
  correct; if Justin wants a grace window, that's a separate lane

## Related observations

- **Lane 4.3 closes the front door**, **this lane closes the back
  door**. Together they enforce the invariant: "an active `tr_live_`
  key implies an active paid subscription right now."
- Lane 4.85 (master-pool quota DoS) cited the `tr_test_` → free-tier
  attack vector; this lane fills the symmetric gap on the paid side
- Lane 4.66 (auth/callback gateway_users error capture) lives in the
  same webhook handler — both files modify state after auth events
