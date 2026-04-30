# Lane 4.126 — credit_transactions ledger immutability drift guard

## What this guards

`credit_transactions` is the gateway's financial ledger. Three classes of write
violation would erase its authority:

1. **UPDATE** — rewriting `amount` or `balance_after` on an existing row.
   Direct fraud surface: "I paid $5" silently becomes "I paid $50" while
   reconciliation still sees the original Stripe charge.
2. **DELETE** — a row disappears. Auditor sees $0 spent; Stripe shows the
   real charge. Refund-without-clawback class.
3. **UPSERT** — UPDATE-or-INSERT verb hides #1 in a different shape.

Today the application layer touches this table in only two ways:

- **Direct `.insert(...)`** — exactly one site:
  `src/app/api/webhooks/stripe/route.ts` (`recordPaymentFailure` writes
  `payment_failed` audit rows).
- **`add_credits` PG RPC** — credit grants and per-call deductions go through
  this RPC, which atomically inserts a row + bumps `gateway_users.credit_balance`.
  Lane 4.121 already covers the credit_balance side; the RPC body is below
  the application layer and isn't reached by these regexes.

All other usage in src/ is SELECT-only:
- `src/lib/gateway.ts:176` — recent-row dedup
- `src/app/dashboard/billing/page.tsx:281` — user-visible history

## Test asserts (5)

1. Zero `.from("credit_transactions").update(...)` calls anywhere in src/.
2. Zero `.from("credit_transactions").delete(...)` calls anywhere in src/.
3. Zero `.from("credit_transactions").upsert(...)` calls anywhere in src/.
4. Zero raw SQL `UPDATE | DELETE FROM | INSERT INTO credit_transactions` anywhere in src/.
5. Direct `.insert()` allow-list: exactly `src/app/api/webhooks/stripe/route.ts`.

## Why source-file regex (not runtime import)

Memory feedback rule #59 — registry imports often pull in `createClient()` and
crash without prod env. The test reads files with `fs.readFileSync` and runs
regexes; nothing imports the app code.

## Defense-in-depth chain (this column)

1. **DB-layer**: Lane 4.97 REVOKE on `authenticated` writes (P0 self-mint surface
   closed) + RLS service-role-only.
2. **App-layer test**: this PR — fail CI if anyone re-introduces UPDATE/DELETE/UPSERT
   or expands the INSERT allow-list.
3. **App-layer in-source**: the lone insert site uses an idempotency check
   (`stripe_payment_id` + `type=payment_failed` lookup) before inserting.

## Sibling guards in the financial-column drift-guard family

- Lane 4.121 — credit_balance writes RPC-only (PR #168)
- Lane 4.122 — plan_slug writes allow-listed (PR #169)
- Lane 4.123 — api_keys.user_id INSERT-only (PR #170)
- Lane 4.124 — stripe_customer_id writes allow-listed (PR #171)
- Lane 4.125 — auto_topup_* writes allow-listed (PR #172, closes gateway_users family)
- Lane 4.124-followup — subscription path CAS guard (PR #173)
- **Lane 4.126** (this PR) — credit_transactions ledger immutability

This closes the gateway's two highest financial-blast-radius surfaces:
`gateway_users` row-level financial columns (4.121-4.125) and the
`credit_transactions` ledger (4.126).
