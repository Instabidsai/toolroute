---
name: Lane 4.121 — credit_balance write-path RPC-only drift guard
description: Audited every credit_balance touch site in src/. Zero `.update({credit_balance: ...})` paths exist — all mutations route through add_credits/deduct_credits RPCs (Lane 4.93 input-validated). Shipped vitest drift guard so regression breaks CI.
type: project
---

# Lane 4.121 — credit_balance write-path RPC-only drift guard

**Owner:** Claude (auditor + impl)
**Started/Closed:** 2026-04-29
**Severity:** LOW (no finding — confirmation that the financial-integrity invariant holds, drift guard locks it)
**Sibling:** Lane 4.14 (RPCs SECDEF), 4.92 (RPC EXECUTE lockdown), 4.93 (RPC input validation), 4.97 (authenticated WRITE REVOKE on gateway_users)

## TL;DR

Audited the entire src/ tree for direct write paths to `gateway_users.credit_balance`. Result: **all mutations route through `add_credits` / `deduct_credits` RPCs.** No regressions found. Shipped `tests/unit/credit-balance-rpc-only.test.ts` (2/2 green) so any future PR that introduces `supabaseAdmin().from("gateway_users").update({ credit_balance: ... })` fails CI.

## Why this matters

Service_role (used by every server-side write) bypasses both GRANT and RLS. The Lane 4.97 REVOKE on `authenticated` doesn't catch service_role direct writes. So the only thing keeping `credit_balance` integrity intact is **discipline** — every credit grant/deduction must go through a Lane 4.93-validated RPC. A drift guard converts that discipline into a CI gate.

If a future PR added (e.g., for a refund or manual adjustment):

```ts
await supabaseAdmin()
  .from("gateway_users")
  .update({ credit_balance: 1000 })  // ← bypasses ALL Lane 4.93 invariants
  .eq("id", userId);
```

…the Lane 4.93 input-validation (no negative amounts, no string injection in `p_type`, etc.) silently doesn't apply. Same for the credit_transactions ledger row that `add_credits` writes — direct UPDATE doesn't produce one, so the audit trail is broken.

## Audit method

1. Grep all `credit_balance` references — 19 hits across 9 files.
2. Classify each:
   - 13 are **reads** (`.select("credit_balance")` or DTO fields)
   - 3 are **initial INSERT** seeds (signup paths set credit_balance = 0 or 1.00):
     - `src/lib/gateway.ts:582` — gateway-internal user creation, $1.00 starter
     - `src/app/auth/callback/route.ts:99` — OAuth signup, $0
     - `src/app/api/v1/signup/route.ts:173` — password signup, $0
   - 3 are **writes via add_credits RPC** in `src/app/api/webhooks/stripe/route.ts` (purchase, plan_credit/checkout, plan_credit/renewal, auto_topup — all 4 grant paths properly RPC-gated)
3. Confirm zero `.update({...credit_balance...})` patterns:
   - `grep -P "\.update\(\{[^}]*credit_balance"` → 0 hits
   - `grep -P "UPDATE\s+\w+\s+SET[^;]*credit_balance\s*="` → 0 hits

## Drift guard — `tests/unit/credit-balance-rpc-only.test.ts`

2 assertions, both green:

1. No `.update({...credit_balance...})` anywhere in src/ (multiline regex, catches cross-line update payloads)
2. No raw `UPDATE ... SET credit_balance =` SQL strings in src/

Walks every `.ts`/`.tsx` file under `src/` (excluding tests, node_modules, .next). Source-file regex parser (no runtime imports — adapter modules pull in createClient at top-level which crashes without prod env, per memory rule #59).

## Why this drift guard, not the existing ones

- `gateway-rpc-grants-drift.test.ts` (Lane 4.15) — locks RPC EXECUTE permissions. Doesn't see direct table writes.
- `anon-write-grants-drift.test.ts` (Lane 4.96) — locks anon write GRANTs. Doesn't apply to service_role paths.
- `authenticated-write-grants-drift.test.ts` (Lane 4.97) — locks authenticated write GRANTs. Same — doesn't catch service_role.

This drift guard fills the only remaining gap: **client-side discipline**. Service_role is omnipotent at the DB layer; the only place to enforce "credit_balance flows through RPCs" is in the application code.

## Acceptance

- [x] Audit every `credit_balance` reference in src/
- [x] Confirm zero direct `.update({credit_balance})` patterns
- [x] Confirm zero raw `UPDATE ... SET credit_balance` SQL
- [x] Drift guard ships (2/2 green)
- [x] Memo + commit

## Out of scope

- `credit_transactions` ledger insert paths — already audited (Lane 4.23 added UNIQUE on (stripe_payment_id, type); Lane 4.87 closed double-credit; Lane 4.20 closed idempotency). The single direct ledger insert at `webhooks/stripe/route.ts:50` is `payment_failed` with `amount: 0` — informational only, doesn't move the balance.
- Stored procedure / DB-trigger paths — none exist that write credit_balance other than the two RPCs.
