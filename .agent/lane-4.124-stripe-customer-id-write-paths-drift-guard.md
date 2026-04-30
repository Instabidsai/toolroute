---
name: Lane 4.124 — stripe_customer_id write-path drift guard
description: Audited every stripe_customer_id touch site in src/. 3 write paths exist; all 2 files (stripe webhook + billing setup-payment) are signed/null-CAS-guarded. Shipped vitest drift guard locking the allow-list + Lane 4.22 ALLOWED_FIELDS exclusion.
type: project
---

# Lane 4.124 — stripe_customer_id write-path drift guard

**Owner:** Claude (auditor + impl)
**Started/Closed:** 2026-04-29
**Severity:** LOW (no finding — confirmation of allow-listed writers, drift guard locks it)
**Sibling:** Lane 4.121 (credit_balance RPC-only), Lane 4.122 (plan_slug allow-listed), Lane 4.123 (api_keys.user_id INSERT-only), Lane 4.22 (mass-assignment ALLOWED_FIELDS)

## TL;DR

Audited every `stripe_customer_id` touch site in src/. Result: **2 files write it, both gated.** Stripe webhook (signed event) writes it on `checkout.session.completed`; `/api/v1/billing/setup-payment` writes it on first-time customer creation (null-checked read before write). Shipped `tests/unit/stripe-customer-id-write-paths.test.ts` (3/3 green). Sibling assertion confirms Lane 4.22 ALLOWED_FIELDS in settings PATCH still excludes stripe_customer_id.

## Why this matters

`stripe_customer_id` is the billing-binding column. Every Stripe charge, refund, payment-method query, and auto-top-up draws against the customer record this column points to.

If a future PR adds a write path that lets a user set someone else's stripe_customer_id (an admin "merge accounts" tool, settings PATCH that forgets to exclude it from ALLOWED_FIELDS, a "transfer billing" feature), the financial-fraud surface is two-way:

- **Direction A:** Attacker rebinds victim's gateway_user → attacker's Stripe customer. Victim's auto-top-up now charges *attacker's* saved card (so attacker funds free credits to the victim — but more importantly, it breaks the victim's billing model since the victim no longer pays for their usage).
- **Direction B:** Attacker rebinds attacker's gateway_user → victim's Stripe customer. Attacker's auto-top-up now charges *victim's* card. Direct fraud.

Service_role bypasses GRANT + RLS, so the Lane 4.97 authenticated WRITE REVOKE doesn't catch service_role direct writes. Application-layer discipline (which file is allowed to write this column) is the only invariant — this guard converts that into a CI gate.

## Audit method

Grep `stripe_customer_id` across src/ — 4 files:

| File | Operation | Notes |
|------|-----------|-------|
| `src/app/api/webhooks/stripe/route.ts` | 3 reads, 2 writes | **Allow-listed.** Write 1 (line 160, credit purchase): CAS-guarded with `.is(stripe_customer_id, null)` — only sets if currently null. Write 2 (line 187, plan/subscription): not CAS-guarded but webhook-signed only (Lane 4.17/4.18 verified). |
| `src/app/api/v1/billing/setup-payment/route.ts` | 1 read, 1 write | **Allow-listed.** `if (!customerId)` null-check on read before stripe.customers.create + write. TOCTOU window is tight (single async sequence). |
| `src/lib/gateway.ts` | 1 read (auto-top-up trigger) | Read-only — no write. |
| `src/app/api/v1/settings/route.ts` | 4 reads (response shaping) | All SELECT-only. ALLOWED_FIELDS gate already excludes stripe_customer_id (Lane 4.22). |

Confirmed regex sweeps:
- `\.update\(\s*\{[^}]*stripe_customer_id` → 3 hits, all in webhooks/stripe/route.ts + billing/setup-payment/route.ts
- `UPDATE\s+\w+\s+SET[^;]*stripe_customer_id\s*=` → 0 hits

## Drift guard — `tests/unit/stripe-customer-id-write-paths.test.ts`

3 assertions, all green:

1. Only allow-listed files contain stripe_customer_id inside an `.update({...})` payload (allow-list = `{webhooks/stripe/route.ts, billing/setup-payment/route.ts}`)
2. No raw `UPDATE ... SET stripe_customer_id =` SQL in src/
3. Lane 4.22 settings PATCH ALLOWED_FIELDS does NOT contain stripe_customer_id

Walks every `.ts`/`.tsx` file under src/ (excluding tests, node_modules, .next). Source-file regex parser, no runtime imports.

## Defense-in-depth gap noted (NOT shipping fix this lane)

`webhooks/stripe/route.ts:184-190` (subscription/plan checkout completion) writes `stripe_customer_id` without the `.is(stripe_customer_id, null)` CAS guard that the credit-purchase path (line 157-164) uses. Today the path is webhook-signed only, so an attacker can't forge it. But if Stripe webhook signature verification ever has a bug (or a future PR adds an unsigned re-entry), the lack of CAS means a user's stripe_customer_id can flip mid-lifecycle.

**Recommended hardening (not blocking):** add `.is("stripe_customer_id", null)` filter to the subscription update too, and on conflict either (a) log + reject, or (b) accept only if the new customer ID matches the existing one. Filed as Lane 4.124-followup. Defense-in-depth, not a P0.

## Pattern carry-over

This is the **fourth** drift guard in the column-write-allowlist family:
- Lane 4.121 — `credit_balance` (RPC-only)
- Lane 4.122 — `plan_slug` (allow-listed file)
- Lane 4.123 — `api_keys.user_id` (INSERT-only, allow-listed INSERTs)
- Lane 4.124 — `stripe_customer_id` (allow-listed files)

Coverage of financial-impact columns on `gateway_users` after this lane:
- `credit_balance` ✅ (4.121)
- `plan_slug` ✅ (4.122)
- `stripe_customer_id` ✅ (4.124)
- `auto_topup_*` — already gated by Lane 4.22 ALLOWED_FIELDS, sibling guard pending
- `email`, `display_name` — non-financial; lower priority

## Acceptance

- [x] Audit every stripe_customer_id touch site in src/
- [x] Confirm only 2 files write the column
- [x] Confirm Lane 4.22 ALLOWED_FIELDS excludes stripe_customer_id
- [x] Drift guard ships (3/3 green)
- [x] Memo + commit
- [ ] Lane 4.124-followup: CAS guard on subscription update path (defense-in-depth, not blocking)

## Out of scope

- BYOK encrypted_value lockdown — Codex #52 owns Vault encryption; write-path guard pending until that lands.
- Stripe webhook signature verification audit — Lane 4.17/4.18 already cleared.
- Auto-top-up TOCTOU race — Lane 4.88 already shipped.
