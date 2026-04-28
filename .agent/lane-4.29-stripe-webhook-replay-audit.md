# Lane 4.29 — Stripe webhook timestamp tolerance / replay-window audit

**Status:** CLEAN
**Severity if exploited:** P0 (replay grants free credits / forged subscription state)
**Audited file:** `src/app/api/webhooks/stripe/route.ts` (332 lines)
**Sibling lanes:** 4.17 (sig audit, CLEAN), 4.20 (idempotency, P1 closed), 4.23 (DB UNIQUE, race closed)

## Why this audit

A Stripe webhook handler with a relaxed timestamp tolerance lets an attacker who captured ONE valid request body+signature replay it indefinitely — minting credits, faking subscription upgrades, etc. The Stripe SDK enforces a 300s default tolerance against the timestamp embedded in the signature header (`t=...`); explicit override via the 4th arg to `constructEvent` is the audit surface.

## Findings

| ID  | Finding | Severity | Status |
|-----|---------|----------|--------|
| F-1 | `constructEvent(body, sig, webhookSecret)` — 3-arg call, default 300s tolerance | — | ✅ Secure default |
| F-2 | Raw body read via `await request.text()` (not `.json()`) — required for HMAC | — | ✅ Correct |
| F-3 | Placeholder env-var check rejects unconfigured webhooks with 503 | — | ✅ Correct |
| F-4 | `switch (event.type)` has explicit cases only, no `default:` dispatch to user-controlled handler | — | ✅ Safe |
| F-5 | Lane 4.20 idempotency makes replay non-fatal even if 300s window were stretched | — | ✅ Defense-in-depth |

## Evidence

**F-1 — single constructEvent call site, 3 args:**
```ts
// src/app/api/webhooks/stripe/route.ts:91
event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
```
Stripe Node SDK `constructEvent` signature: `(payload, header, secret, tolerance?)`. Omitting the 4th arg invokes the SDK default `DEFAULT_TOLERANCE = 300` seconds. Verified zero other invocations across `src/` (single match in grep).

**F-2 — raw body, not parsed:**
```ts
// src/app/api/webhooks/stripe/route.ts:72
const body = await request.text();
```
Parsing the body via `.json()` first would alter whitespace and break the HMAC. Confirmed `.text()` is the only body-read.

**F-3 — placeholder rejection:**
```ts
// src/app/api/webhooks/stripe/route.ts:82-85
if (!secretKey || secretKey.startsWith("placeholder") || !webhookSecret || webhookSecret.startsWith("placeholder")) {
  console.error("Stripe not configured");
  return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
}
```
Prevents a misconfigured prod (e.g., env var blanked) from accepting any signature.

**F-4 — explicit-cases-only switch:**
Switch over `event.type` covers 7 cases (checkout.session.completed, customer.subscription.created/updated/deleted, invoice.payment_succeeded/payment_failed, etc.). No `default:` — unhandled events fall through to L331 `return NextResponse.json({ received: true })`, which is Stripe-recommended behavior (200 stops retries, no untrusted dispatch).

**F-5 — sibling defense:**
Lane 4.20 (PR #41, merged into branch) adds application-level idempotency keyed on `event.id`. Lane 4.23 (PR #44) adds a DB UNIQUE constraint on `credit_transactions.stripe_event_id`. Even a same-window replay (within 300s) would be rejected at the second-grant attempt.

## Threat model — replay attack chain

1. Attacker captures `{body, stripe-signature header}` from a legitimate webhook (e.g., MITM if TLS broken, hostile proxy, leaked log).
2. Within 300s, replays the request to `/api/webhooks/stripe`.
3. SDK passes signature verification (timestamp still in tolerance window).
4. **Lane 4.20 idempotency check:** `event.id` already processed → skip.
5. **Lane 4.23 DB UNIQUE:** if 4.20 race-loses, DB rejects duplicate row.

Replay payoff = 0. Three independent layers (Stripe SDK 300s tolerance + app idempotency + DB UNIQUE).

## What would have failed this audit

- `constructEvent(body, sig, webhookSecret, 86400)` — 24hr tolerance, replay window expanded 288x
- `constructEvent(body, sig, webhookSecret, Infinity)` — disabled tolerance (SDK rejects, but a hand-rolled HMAC could)
- A second `new Stripe(...)` instance with `apiVersion` overrides changing constructEvent semantics — none found, single SDK construction at L87

## Drift-prevention test

`tests/unit/stripe-webhook-replay-shape.test.ts` asserts shape that prevents future regressions:
1. Webhook handler reads raw body via `.text()` (not `.json()`)
2. `constructEvent` called with exactly 3 args (no tolerance override) — and if 4th arg is added later, must be a literal ≤ 300
3. Single Stripe SDK construction (no second instance)
4. webhookSecret env var required (placeholder check exists)
5. Switch has no `default:` branch dispatching event.type into user-controlled handler

## Cross-applies

- **CallTwin** Stripe webhook (`src/app/api/webhooks/stripe/route.ts` if exists) — same audit
- **AffixedAI** Stripe webhook — same audit
- **DropClose** if billing added — same audit
- Any future Vapi/Twilio/etc. webhook with HMAC + timestamp tolerance — apply the same shape test class

## Recommendations (none blocking)

- **R-1 (P3, optional):** Tighten tolerance to 60s via explicit 4th arg (`constructEvent(body, sig, webhookSecret, 60)`). Reduces capture-replay window 5x. Trade-off: rare network jitter could legit-reject; Stripe's 300s default exists for a reason.
- **R-2 (P3, optional):** Log `event.created` vs `Date.now()` when verification succeeds — gives observability into actual delivery latency in production, would surface if attackers were probing the tolerance window.

Neither blocks Lane 4 closure.
