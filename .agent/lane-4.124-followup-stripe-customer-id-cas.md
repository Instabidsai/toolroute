# Lane 4.124-followup — stripe_customer_id CAS guard on subscription path

## Context

Lane 4.124 (PR #171) added the test-time drift guard for `stripe_customer_id` writes. While
authoring it, I noted in the memo that the **subscription path** in
`src/app/api/webhooks/stripe/route.ts` (`checkout.session.completed` → `type === "subscription"`)
wrote `stripe_customer_id` unconditionally inside the same `.update({...})` that flipped
`plan_id`/`plan_slug`. That was inconsistent with the **credit-purchase path** at line ~157
which already used a CAS-style `.is("stripe_customer_id", null)` guard.

The test-time guard is sufficient against future code drift, but the runtime behavior was
asymmetric: a forged or replayed subscription event with a different `customer` field would
have silently rebound the user's billing identity. The webhook is signature-verified today,
so this is **defense-in-depth, not exploitable** — but the asymmetry was a latent footgun
if signature verification ever regressed (e.g., new dev path bypassing `constructEvent`).

## Change

Split the single `.update({plan_id, plan_slug, stripe_customer_id, updated_at})` into two operations:

1. **Always-flip** plan fields: `.update({plan_id, plan_slug, updated_at}).eq("id", userId)`
2. **Bind-once** customer id: `.update({stripe_customer_id, updated_at}).eq("id", userId).is("stripe_customer_id", null)`

This mirrors the credit-purchase path at line ~157 exactly. Plan flips remain intentional on
every subscription event (downgrade/upgrade is expected); customer rebinds become impossible
even if signature verification regresses.

## Why two separate UPDATEs

The plan flip MUST happen on every subscription event (that's the product behavior). The
customer bind MUST only happen when null. A single UPDATE with `.is("stripe_customer_id", null)`
would skip the plan flip whenever the customer was already bound — wrong. Two UPDATEs is
the only correct shape.

## Test impact

No test changes required. PR #171's test (`tests/unit/stripe-customer-id-write-paths.test.ts`)
asserts the file is in the allow-list — both `.update()` calls are in the same allow-listed
file (`src/app/api/webhooks/stripe/route.ts`), so the regex still matches.

## Defense-in-depth pattern (3 layers, this column)

1. Test-time drift guard (PR #171 — file allow-list, regex over source)
2. Application-layer CAS guard (this PR — `.is("col", null)` on UPDATE)
3. Stripe webhook signature verification (existing — `stripe.webhooks.constructEvent`)

Any single layer failing leaves the other two intact. Same shape as Lane 4.125 (auto_topup)
and Lane 4.121 (credit_balance) but applied at the runtime layer instead of the test layer.

## Branch / PR

- Branch: `lane-4.124-followup-stripe-customer-id-cas`
- File: `src/app/api/webhooks/stripe/route.ts` (lines ~181-204 changed)
- Sibling memo: `.agent/lane-4.124-stripe-customer-id-write-paths-drift-guard.md`
