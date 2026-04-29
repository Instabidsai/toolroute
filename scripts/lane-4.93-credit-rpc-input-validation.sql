-- Lane 4.93 — credit RPC input validation (defense-in-depth, Apr 28 2026).
-- ============================================================================
-- Lane 4.92 closed the anon-callable surface on add_credits/deduct_credits.
-- Remaining threat model: service_role caller (gateway.ts, webhooks/stripe)
-- passes a malicious or buggy p_amount. Findings:
--
--   1. Neither RPC validates p_amount. NULL, NaN, 0, or negative values
--      all flow through to the UPDATE / INSERT.
--
--   2. deduct_credits with p_amount = -10 MINTS credits:
--        v_balance < p_amount  →  v_balance < -10  →  false  → guard skipped
--        v_new_balance := v_balance - p_amount  →  v_balance - (-10)  →  +10
--        credit_transactions row: amount = -p_amount = +10 (looks like a refund)
--      Result: anyone with service_role JWT can mint unlimited credits to any user.
--
--   3. add_credits with p_amount = -10 silently DRAINS the balance.
--
--   4. p_amount = NaN poisons the balance numeric forever (NaN+x = NaN).
--
-- Caller-side audit (Apr 28): all 5 call sites in gateway.ts:363,
-- webhooks/stripe/route.ts:128/183/222/254 already gate `> 0`. So this
-- migration is pure defense-in-depth — guards future callers / future
-- Stripe metadata bugs / future cost-calc bugs from corrupting balances.
--
-- Applied to production isbratmfnnzipzyoefbo via Supabase Mgmt API at
-- 2026-04-28T<UTC>. Idempotent — CREATE OR REPLACE.
-- Sibling to Lane 4.92 (anon-callable lockdown) and Lane 4.52 (TOCTOU audit).
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. add_credits — reject NULL / NaN / <= 0 amounts before any state change.
--    Signature: (p_user_id uuid, p_amount numeric, p_type text,
--                p_stripe_payment_id text, p_description text).
--    SECURITY DEFINER + EXECUTE GRANTed only to service_role (Lane 4.92).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.add_credits(
    p_user_id uuid,
    p_amount numeric,
    p_type text,
    p_stripe_payment_id text DEFAULT NULL,
    p_description text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_balance numeric;
BEGIN
  -- Lane 4.93 input validation (defense-in-depth post-Lane-4.92 lockdown).
  IF p_amount IS NULL OR p_amount = 'NaN'::numeric OR p_amount <= 0 THEN
    RAISE EXCEPTION 'add_credits: p_amount must be > 0 (got %)', p_amount
      USING ERRCODE = '22023';  -- invalid_parameter_value
  END IF;

  UPDATE gateway_users SET
    credit_balance = credit_balance + p_amount,
    lifetime_credits = lifetime_credits + p_amount,
    updated_at = now()
  WHERE id = p_user_id
  RETURNING credit_balance INTO v_new_balance;

  INSERT INTO credit_transactions (user_id, amount, balance_after, type, description, stripe_payment_id)
  VALUES (p_user_id, p_amount, v_new_balance, p_type, COALESCE(p_description, p_type || ' +$' || p_amount), p_stripe_payment_id);

  RETURN jsonb_build_object('success', true, 'balance', v_new_balance, 'added', p_amount);
END;
$$;

-- ============================================================================
-- 2. deduct_credits — reject NULL / NaN / <= 0 amounts before balance read.
--    Signature: (p_user_id uuid, p_amount numeric, p_tool_slug text,
--                p_key_id uuid, p_description text).
--    SECURITY DEFINER + EXECUTE GRANTed only to service_role (Lane 4.92).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.deduct_credits(
    p_user_id uuid,
    p_amount numeric,
    p_tool_slug text,
    p_key_id uuid,
    p_description text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance numeric;
  v_new_balance numeric;
BEGIN
  -- Lane 4.93 input validation. Guards against negative-amount mint:
  -- p_amount = -10 would have made v_balance < -10 false, then
  -- v_new_balance := v_balance - (-10) = v_balance + 10 (credit mint).
  IF p_amount IS NULL OR p_amount = 'NaN'::numeric OR p_amount <= 0 THEN
    RAISE EXCEPTION 'deduct_credits: p_amount must be > 0 (got %)', p_amount
      USING ERRCODE = '22023';  -- invalid_parameter_value
  END IF;

  -- Get current balance with lock (Lane 4.52 TOCTOU defense intact).
  SELECT credit_balance INTO v_balance FROM gateway_users WHERE id = p_user_id FOR UPDATE;

  IF v_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient credits',
      'balance', v_balance, 'required', p_amount);
  END IF;

  v_new_balance := v_balance - p_amount;

  UPDATE gateway_users SET
    credit_balance = v_new_balance,
    lifetime_usage = lifetime_usage + p_amount,
    updated_at = now()
  WHERE id = p_user_id;

  UPDATE api_keys SET spending_used = spending_used + p_amount WHERE id = p_key_id;

  INSERT INTO credit_transactions (user_id, amount, balance_after, type, description, tool_slug, api_key_id)
  VALUES (p_user_id, -p_amount, v_new_balance, 'usage', p_description, p_tool_slug, p_key_id);

  RETURN jsonb_build_object('success', true, 'balance', v_new_balance, 'charged', p_amount);
END;
$$;

-- Re-apply Lane 4.92 EXECUTE grants (CREATE OR REPLACE preserves existing
-- grants in PG 14+, but we restate them here so a fresh-DB replay is
-- self-contained and doesn't depend on lockdown-gateway-rpcs.sql ordering).
REVOKE EXECUTE ON FUNCTION public.add_credits(uuid, numeric, text, text, text)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_credits(uuid, numeric, text, text, text)
    TO service_role;

REVOKE EXECUTE ON FUNCTION public.deduct_credits(uuid, numeric, text, uuid, text)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_credits(uuid, numeric, text, uuid, text)
    TO service_role;

COMMIT;

-- ============================================================================
-- Verification (run as service_role; each must return SQLSTATE 22023):
-- ============================================================================
--   SELECT public.add_credits('00000000-0000-0000-0000-000000000000', -10,
--                             'purchase', NULL, 'attack');
--     → ERROR  22023  add_credits: p_amount must be > 0 (got -10)
--
--   SELECT public.add_credits('00000000-0000-0000-0000-000000000000', 0,
--                             'purchase', NULL, 'attack');
--     → ERROR  22023  add_credits: p_amount must be > 0 (got 0)
--
--   SELECT public.add_credits('00000000-0000-0000-0000-000000000000',
--                             'NaN'::numeric, 'purchase', NULL, 'attack');
--     → ERROR  22023  add_credits: p_amount must be > 0 (got NaN)
--
--   SELECT public.deduct_credits('00000000-0000-0000-0000-000000000000', -10,
--                                'openai', '00000000-0000-0000-0000-000000000000', 'mint');
--     → ERROR  22023  deduct_credits: p_amount must be > 0 (got -10)
-- ============================================================================
