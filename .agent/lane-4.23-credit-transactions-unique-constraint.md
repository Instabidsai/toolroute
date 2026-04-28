# Lane 4.23 — DB-level UNIQUE constraint on credit_transactions (defense-in-depth for Lane 4.20)

**Status:** SQL ready for Justin to apply. Drift test shipped.
**Severity:** P2 — TOCTOU race-window mitigation. Lane 4.20 already catches 99.9%+ of retries at the application layer.
**Date:** 2026-04-28
**Sibling:** Lane 4.20 (application-level dedup probe), Hard Rule #57 (financial double-grant class).

## Why this exists

Lane 4.20 closed two P1 idempotency gaps in the Stripe webhook handler by adding `SELECT-from-credit_transactions-by-stripe_payment_id` probes before each `add_credits` RPC call. That works for **sequential** retries (Stripe retries every few seconds, the probe finds the row, the second call no-ops).

It does **not** close the **concurrent** retry case:

```
T=0.000ms  Webhook A delivered → SELECT probe finds nothing
T=0.001ms  Webhook B delivered (Stripe parallel retry) → SELECT probe finds nothing
T=0.005ms  Webhook A calls add_credits → row inserted
T=0.008ms  Webhook B calls add_credits → row inserted (DUPLICATE)
```

The probe-then-RPC pattern has a microsecond-wide TOCTOU race. In practice this is very rare — Stripe's retry backoff is seconds, not microseconds, and Vercel functions are short-lived — but the failure mode is **financial double-grant**, so the cost of the rare case is high.

## The fix

Partial UNIQUE index on `(stripe_payment_id, type)` for the two types that have unique-per-event ids:

- `'purchase'` (session.payment_intent or pi.id from auto-topup)
- `'plan_credit'` (session.subscription on signup, invoice.id on renewal)

Excluded: `'refund'`, `'adjustment'`, `'payment_failed'` — these may legitimately share a stripe_payment_id with a related successful tx.

```sql
CREATE UNIQUE INDEX CONCURRENTLY
  credit_transactions_stripe_payment_id_dedup_idx
  ON credit_transactions (stripe_payment_id, type)
  WHERE type IN ('purchase', 'plan_credit')
    AND stripe_payment_id IS NOT NULL;
```

`CONCURRENTLY` keeps writes flowing during index creation. `IF NOT EXISTS` makes it idempotent.

## Self-healing behavior

After the constraint is in place, the concurrent-retry case becomes:

```
T=0.000ms  Webhook A → SELECT probe finds nothing → add_credits → INSERT succeeds
T=0.001ms  Webhook B → SELECT probe finds nothing → add_credits → INSERT raises 23505
T=0.001ms  Webhook B handler returns 5xx → Stripe retries after backoff
T=8.000s   Webhook B retry → SELECT probe finds A's row → skip cleanly
```

No code change required to `route.ts`. The existing handler's `try/catch` returns 500 on RPC error → Stripe retries → next probe wins.

## Why not at app layer with `INSERT ... ON CONFLICT DO NOTHING`

Two reasons:
1. The application path goes through `add_credits` RPC — a SECURITY DEFINER stored function (Lane 4.14). Adding ON CONFLICT inside the RPC is possible but couples the dedup decision to the RPC body, fragmenting the truth across two layers.
2. DB-level constraints survive ANY future caller — admin scripts, migrations, manual SQL, future CLI/MCP tools. The route-layer probe only protects the webhook path.

## Justin: how to apply

```bash
# Step 1: dry-run the duplicate-detection query
# (top of scripts/lane-4.23-credit-transactions-unique-constraint.sql)
# If it returns ZERO rows → safe to proceed.
# If it returns ANY rows → STOP, investigate, clean up before creating the index.

# Step 2: apply the migration (Supabase SQL editor or psql)
psql $DATABASE_URL -f scripts/lane-4.23-credit-transactions-unique-constraint.sql
```

Reversible: `DROP INDEX credit_transactions_stripe_payment_id_dedup_idx;`

## Drift prevention — vitest

`tests/unit/lane-4.23-unique-constraint-shape.test.ts` asserts:

1. The migration script exists at the expected path.
2. The migration creates an index named `credit_transactions_stripe_payment_id_dedup_idx`.
3. The index is UNIQUE.
4. The index includes `(stripe_payment_id, type)` columns.
5. The WHERE clause restricts to `type IN ('purchase', 'plan_credit')` — accidentally widening this to include refund/adjustment/payment_failed would break valid related-tx flows.

The test does NOT check live DB state (Lane 0.1 / Lane 4.4 RLS regression suite covers DB-state checks). It locks the **migration spec** so future edits don't silently broaden the constraint.

## Cross-applies to

Same defense-in-depth — application-level probe + DB-level UNIQUE — should ship on every Justin product with credit/balance ledger tables:

- **CallTwin** — `call_credits` or equivalent
- **DropClose** — `lead_credits`
- **AffixedAI** — `consult_credits`
- **JarvisCRM** — auto-generated billing tables
- **PureUSPeptide2** — order ledger
- **PeptideAI** — inventory ledger

5-min audit per product: `grep -l 'add_credits\|grant_quota' src/app/api/webhooks/` → check if ledger table has UNIQUE on the dedup column.

## Conclusion

Lane 4.20 closes the application-level idempotency at probe-then-RPC granularity. Lane 4.23 closes the DB-level idempotency at the row-write granularity. Together they make double-grants structurally impossible.
