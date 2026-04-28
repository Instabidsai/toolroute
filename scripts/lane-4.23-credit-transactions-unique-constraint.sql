-- Lane 4.23 — DB-level UNIQUE constraint on credit_transactions dedup column
--
-- Closes the TOCTOU race window left open by Lane 4.20's application-level
-- SELECT-then-RPC dedup probe. Two concurrent webhook deliveries (Stripe
-- can deliver retries in parallel; AWS Lambda / Vercel functions don't
-- serialize) can both pass the SELECT probe, both call add_credits(),
-- and both insert credit_transactions rows with the same stripe_payment_id.
--
-- The application-level probe catches ~99.9% of retries (most are seconds
-- apart). The UNIQUE index catches the remaining microsecond-window races.
--
-- Scope: only types where stripe_payment_id is mandatory and unique-per-event.
--   - 'purchase'      → session.payment_intent (one-shot credit buy)
--   - 'plan_credit'   → session.subscription (signup) OR invoice.id (renewal)
--
-- Other types (refund, adjustment, payment_failed) may share an id with the
-- successful event they relate to, so they're EXCLUDED from this index.
--
-- After this migration, the second concurrent insert raises 23505
-- (unique_violation), the webhook handler returns 5xx, Stripe retries
-- after backoff, and on the retry the application-level probe (Lane 4.20)
-- finds the row and skips cleanly. Self-healing.

-- Step 1: Detect any pre-existing duplicates (would block index creation)
SELECT
  stripe_payment_id,
  type,
  COUNT(*) AS dup_count
FROM credit_transactions
WHERE stripe_payment_id IS NOT NULL
  AND type IN ('purchase', 'plan_credit')
GROUP BY stripe_payment_id, type
HAVING COUNT(*) > 1;

-- If the SELECT above returns rows, STOP. Investigate and clean up
-- duplicates first (some rows may need refund/adjustment to balance the
-- ledger). Do not blindly delete — these are already-granted credits.

-- Step 2: Create the partial unique index
-- (CONCURRENTLY so it doesn't block writes during creation)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS
  credit_transactions_stripe_payment_id_dedup_idx
  ON credit_transactions (stripe_payment_id, type)
  WHERE type IN ('purchase', 'plan_credit')
    AND stripe_payment_id IS NOT NULL;

-- Step 3: Verify
SELECT
  i.indexname,
  i.indexdef
FROM pg_indexes i
WHERE i.tablename = 'credit_transactions'
  AND i.indexname = 'credit_transactions_stripe_payment_id_dedup_idx';

-- Expected output: one row showing the index definition with the WHERE clause.
