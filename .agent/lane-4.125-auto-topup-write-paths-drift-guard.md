---
name: Lane 4.125 — auto_topup_* write-path drift guard
description: Audited every auto_topup_* touch site in src/. Single writer (settings PATCH) gated by Lane 4.22 ALLOWED_FIELDS + per-field validation + capability check. Shipped 4-assertion vitest drift guard. Closes the gateway_users financial-column family.
type: project
---

# Lane 4.125 — auto_topup_* write-path drift guard

**Owner:** Claude (auditor + impl)
**Started/Closed:** 2026-04-29
**Severity:** LOW (no finding — confirmation that the existing 3-layer gate holds, drift guard locks it)
**Sibling:** Lane 4.121 (credit_balance), 4.122 (plan_slug), 4.123 (api_keys.user_id), 4.124 (stripe_customer_id), 4.22 (mass-assignment ALLOWED_FIELDS), 4.88 (auto-top-up TOCTOU)

## TL;DR

Audited every `auto_topup_enabled` / `auto_topup_threshold` / `auto_topup_amount_cents` touch site in src/. Result: **single writer (`/api/v1/settings/route.ts`) with three layers of defense.** Shipped `tests/unit/auto-topup-write-paths.test.ts` (4/4 green). Closes the **gateway_users financial-column drift-guard family** — every column on `gateway_users` whose mutation has financial impact now has a CI gate.

## Why this matters

`triggerAutoTopup()` in `gateway.ts` reads these three columns from the authenticated user's row and uses them to decide (a) whether to fire a charge, (b) the credit_balance threshold below which to fire, and (c) the dollar amount to charge per fire. The integrity of those columns IS the financial boundary.

If a future PR adds a write path that bypasses validation:
- An attacker setting `auto_topup_enabled=true` without a payment method on file → the trigger would silently fail per-charge, but the user would see "auto-top-up enabled" UX without it actually working (UX drift, not financial fraud).
- An attacker setting `auto_topup_threshold` absurdly high → forces perpetual auto-charges every time credit_balance dips below the threshold. With amount_cents capped at $50, this is rate-limited, but still abusive.
- An attacker setting `auto_topup_amount_cents` to a value outside `VALID_AMOUNTS_CENTS` → could push large unintended charges through.

Service_role bypasses GRANT + RLS (Lane 4.97 doesn't catch it). Application-layer discipline is the only invariant.

## Audit method

Grep `auto_topup` across src/ — 7 files (3 marketing/UI, 4 backend):

| File | Operation | Notes |
|------|-----------|-------|
| `src/app/api/v1/settings/route.ts` | **The only writer.** | Lane 4.22 ALLOWED_FIELDS gate (line 62-67) + per-field type validation switch (line 96-130) + capability check (line 157-170: verify payment method exists before allowing `auto_topup_enabled=true`). |
| `src/lib/gateway.ts` | Read only | line 440-447 — `triggerAutoTopup` reader. |
| `src/app/api/webhooks/stripe/route.ts` | Reference only | uses Stripe metadata `type === "auto_topup"` for routing, not the DB column. |
| `src/app/api/v1/billing/setup-payment/route.ts` | Reference only | writes Stripe metadata `type: "auto_topup_payment_method"`, not the DB column. |
| `src/app/dashboard/billing/page.tsx` | Read only (UI) | renders current values. |
| `src/app/docs/page.tsx`, `src/app/blog/.../page.tsx` | Marketing copy | string literals only. |

Confirmed regex sweeps:
- `\.update\(\s*\{[^}]*auto_topup_` → 1 hit, allow-listed
- `UPDATE\s+\w+\s+SET[^;]*auto_topup_\w+\s*=` → 0 hits

## Three layers of existing defense

The settings PATCH writer has the strongest defense in the family — three nested gates:

1. **ALLOWED_FIELDS allowlist** — mass-assignment block. Any field not in the Set is silently dropped.
2. **Per-field validation switch** — `case "auto_topup_enabled":` (must be boolean), `case "auto_topup_threshold":` (must be in VALID_THRESHOLDS), `case "auto_topup_amount_cents":` (must be in VALID_AMOUNTS_CENTS).
3. **Capability check on enable** — `if (updates.auto_topup_enabled === true)` triggers a payment-method existence check; rejects with 400 if no PM saved.

This is the cleanest mass-assignment surface in the gateway. Worth holding up as the reference pattern.

## Drift guard — `tests/unit/auto-topup-write-paths.test.ts`

4 assertions, all green:

1. Only `/api/v1/settings/route.ts` contains `auto_topup_` inside an `.update({...})` payload
2. No raw `UPDATE ... SET auto_topup_` SQL in src/
3. Lane 4.22 ALLOWED_FIELDS contains all 3 required `auto_topup_*` fields (drift = field removal silently breaks PATCH; field addition not validated bypasses the switch)
4. Settings route has a `case "auto_topup_X":` validation branch for each of the 3 fields (per-field type-check enforcement)

Walks every `.ts`/`.tsx` file under src/ (excluding tests, node_modules, .next). Source-file regex parser, no runtime imports.

## Pattern carry-over

This is the **fifth and final** drift guard in the column-write-allowlist family for `gateway_users`:

| Lane | Column | Lock pattern |
|------|--------|--------------|
| 4.121 | `credit_balance` | RPC-only (add_credits / deduct_credits) |
| 4.122 | `plan_slug` | Allow-listed file (stripe webhook) |
| 4.123 | `api_keys.user_id` | INSERT-only, allow-listed INSERTs |
| 4.124 | `stripe_customer_id` | Allow-listed files (webhook + setup-payment) |
| **4.125** | **`auto_topup_*`** | **Allow-listed file + 3-layer defense (ALLOWED_FIELDS + per-field validation + capability check)** |

**Coverage on gateway_users financial columns: complete.**

Remaining sensitive columns elsewhere:
- `user_provider_keys.encrypted_value` — Codex #52 owns Vault encryption; write-path discipline guard pending until that lands.
- `credit_transactions.amount` / `credit_transactions.type` — already protected by Lane 4.23 UNIQUE constraint + Lane 4.93 RPC input validation.

## Acceptance

- [x] Audit every auto_topup_* touch site in src/
- [x] Confirm only 1 file writes the columns
- [x] Confirm Lane 4.22 ALLOWED_FIELDS includes all 3 fields
- [x] Confirm per-field validation switches exist
- [x] Drift guard ships (4/4 green)
- [x] Memo + commit
- [x] **Closes gateway_users financial-column drift-guard family**

## Out of scope

- BYOK encrypted_value lockdown — Codex #52
- credit_transactions writes — already RPC-gated (Lane 4.121)
- Non-financial columns (email, display_name) — lower priority
