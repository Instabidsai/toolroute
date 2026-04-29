# Lane 4.93 — Credit RPC input validation (defense-in-depth)

**Class**: Defense-in-depth post-Lane-4.92 lockdown
**Severity**: HIGH (latent mint-attack from buggy/malicious service_role caller)
**Date**: 2026-04-28
**Sibling**: Lane 4.92 (anon-callable lockdown), Lane 4.52 (TOCTOU audit), Lane 4.51 (estimateCost zero-return)

---

## TL;DR

Lane 4.92 closed the anon-callable surface on `add_credits`/`deduct_credits`. Remaining threat model: any future caller (gateway.ts cost-calc bug, Stripe webhook metadata bug, future feature) that passes `p_amount = -10` to `deduct_credits` MINTS credits to the user — the existing function body had no input validation:

```sql
-- BEFORE:
IF v_balance < p_amount THEN  -- v_balance < -10 is FALSE → guard skipped
v_new_balance := v_balance - p_amount;  -- v_balance - (-10) = balance + 10  (mint!)
```

Same class for `add_credits` (negative drains balance) and for both with `NaN` (poisons numeric balance forever — `NaN + x = NaN`).

This lane:
1. Audited all 5 caller sites — already gate `> 0` (no false-positive risk).
2. Added `IF p_amount IS NULL OR p_amount = 'NaN'::numeric OR p_amount <= 0 THEN RAISE EXCEPTION USING ERRCODE = '22023'` as the first executable statement in both RPC bodies.
3. Applied via Supabase Mgmt API at <UTC>.
4. Verified all 6 attack-class calls now return SQLSTATE 22023.
5. Shipped vitest drift guard `tests/unit/credit-rpc-amount-validation.test.ts` (parses the migration script, asserts validation block exists + runs before any state mutation + Lane 4.92 grants preserved).

## Caller-side audit (proves zero false-positive risk)

| File:line | Caller | Pre-call guard |
|---|---|---|
| `gateway.ts:361` | `deduct_credits` after adapter execute | `if (result.success && finalCost > 0)` |
| `gateway.ts:203` | `add_credits` for triggerAutoTopup paymentIntent | `if (paymentIntent.status === "succeeded")` (Stripe-positive only) |
| `webhooks/stripe/route.ts:128` | `add_credits` for credits checkout | `if (creditAmount > 0)` |
| `webhooks/stripe/route.ts:183` | `add_credits` for plan-credit grant | `if (planCredits > 0 && session.subscription)` |
| `webhooks/stripe/route.ts:222` | `add_credits` for monthly renewal | `if (planCredits > 0)` |
| `webhooks/stripe/route.ts:254` | `add_credits` for auto-top-up | `if (userId && creditAmount > 0)` |

All callers gate `> 0` already. Lane 4.93 is a tripwire — a future caller that forgets the guard now hits SQLSTATE 22023 instead of silently corrupting a balance.

## Live verification

```
=== add_credits negative ===     ERROR 22023: add_credits: p_amount must be > 0 (got -10)
=== add_credits zero ===         ERROR 22023: add_credits: p_amount must be > 0 (got 0)
=== add_credits NaN ===          ERROR 22023: add_credits: p_amount must be > 0 (got NaN)
=== add_credits NULL ===         ERROR 22023: add_credits: p_amount must be > 0 (got <NULL>)
=== deduct_credits negative ===  ERROR 22023: deduct_credits: p_amount must be > 0 (got -10)
=== deduct_credits zero ===      ERROR 22023: deduct_credits: p_amount must be > 0 (got 0)
```

All 6 attack vectors raise. Mint attack closed.

## Out-of-scope follow-ups

- **CHECK constraints on `gateway_users.credit_balance >= 0`**: deferred — would need to verify no existing rows are negative (Stripe refund clawback sometimes drops a balance below zero by design, see Lane 4.63 audit).
- **NaN guard on lifetime_credits / lifetime_usage / api_keys.spending_used**: same logic — RPC-level guard prevents NaN ever entering these columns. Column-level CHECK is belt-and-suspenders only.
- **Fuzz test**: a property-based test (`fast-check`) that calls deduct_credits with random `numeric` inputs and asserts no balance corruption — deferred unless a third class of input drift surfaces. Lane 4.93 vitest covers regression of the script itself.

## Acceptance

- [x] `add_credits` rejects NULL/NaN/<=0 with SQLSTATE 22023
- [x] `deduct_credits` rejects NULL/NaN/<=0 with SQLSTATE 22023
- [x] Mint attack (`deduct_credits(p_amount = -10)`) closed — verified live
- [x] Lane 4.92 EXECUTE grants preserved (CREATE OR REPLACE preserves grants in PG 14+)
- [x] All 5 production caller sites audited — all gate `> 0`
- [x] Drift guard vitest `credit-rpc-amount-validation.test.ts` ships (6/6 green)
- [x] Migration script `scripts/lane-4.93-credit-rpc-input-validation.sql` checked in for replay
- [x] Idempotent — re-running the migration is safe (CREATE OR REPLACE)
