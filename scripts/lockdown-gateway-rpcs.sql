-- ToolRoute — Gateway RPC EXECUTE lockdown (Lane 4.14, Apr 28 2026).
-- ============================================================================
-- P0 finding: 5 gateway-internal RPCs are anon-callable. Two of them are
-- SECURITY DEFINER and bypass RLS on credit_transactions. Only the
-- balance_after NOT NULL constraint prevented anon credit-mint exploitation
-- when probed with a non-existent user_id. With any real p_user_id, anon can
-- mint or drain credits at will.
--
-- This SQL was applied to production isbratmfnnzipzyoefbo at 2026-04-28T16:44Z
-- via Supabase Mgmt API (Lane 4.92 corrects original arg-type drift). Re-running
-- it is idempotent (REVOKE on already-revoked grants is a no-op).
-- Sibling to scripts/lockdown-anon-writers.sql (registry-side).
--
-- The Next.js routes (api/v1/execute, api/webhooks/stripe, etc.) all use
-- supabaseAdmin() which authenticates as service_role, so EXECUTE behavior
-- after the GRANT is unchanged for legitimate callers.
-- ============================================================================

BEGIN;

-- 1. validate_api_key — key validity oracle. Used by every gateway request.
--    Signature confirmed by gateway.ts:46 (single text arg p_key_hash).
REVOKE EXECUTE ON FUNCTION public.validate_api_key(text)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_api_key(text)
    TO service_role;

-- 2. check_rate_limit — rate-limit window manipulation surface.
--    Signature confirmed by gateway.ts:101 (uuid, integer, integer).
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(uuid, integer, integer)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(uuid, integer, integer)
    TO service_role;

-- 3. add_credits — credit mint. CRITICAL. SECURITY DEFINER bypasses RLS.
--    Signature confirmed by gateway.ts:202 (5 named args:
--    p_user_id uuid, p_amount numeric, p_type text,
--    p_stripe_payment_id text, p_description text).
REVOKE EXECUTE ON FUNCTION public.add_credits(uuid, numeric, text, text, text)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_credits(uuid, numeric, text, text, text)
    TO service_role;

-- 4. deduct_credits — credit drain. CRITICAL. SECURITY DEFINER bypasses RLS.
--    Signature from pg_proc: p_user_id uuid, p_amount numeric, p_tool_slug text,
--    p_key_id uuid, p_description text → (uuid, numeric, text, uuid, text).
REVOKE EXECUTE ON FUNCTION public.deduct_credits(uuid, numeric, text, uuid, text)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_credits(uuid, numeric, text, uuid, text)
    TO service_role;

-- 5. log_gateway_request — usage log poisoning surface.
--    Signature from pg_proc (13 args, all defaults from p_error onward):
--      p_user_id uuid, p_key_id uuid, p_tool_slug text, p_provider text,
--      p_status integer, p_cost_to_us numeric, p_cost_to_user numeric,
--      p_latency_ms integer, p_used_byok boolean, p_error text, p_request_params jsonb,
--      p_response_size integer, p_key_source text
--
--    NOTE: A dead 12-arg overload (without p_key_source) was dropped on Apr 28
--    2026 — it caused PostgREST PGRST203 ambiguity. The 13-arg version is the
--    only callable form and matches gateway.ts:301 + gateway.ts:345 callers.
REVOKE EXECUTE ON FUNCTION public.log_gateway_request(
    uuid, uuid, text, text, integer, numeric, numeric, integer, boolean, text, jsonb, integer, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_gateway_request(
    uuid, uuid, text, text, integer, numeric, numeric, integer, boolean, text, jsonb, integer, text
) TO service_role;

COMMIT;

-- ============================================================================
-- Verification probes (run from a terminal with only the public anon JWT;
-- each line MUST return 401/403 with permission-denied, NOT 200/400/409):
-- ============================================================================
--
-- curl -X POST "https://isbratmfnnzipzyoefbo.supabase.co/rest/v1/rpc/validate_api_key" \
--   -H "apikey: $ANON_JWT" -H "Authorization: Bearer $ANON_JWT" \
--   -H "Content-Type: application/json" \
--   -d '{"p_key_hash":"x"}'
--
-- curl -X POST ".../rpc/add_credits" \
--   -d '{"p_user_id":"00000000-0000-0000-0000-000000000000","p_amount":0.01,
--        "p_type":"purchase","p_stripe_payment_id":"x","p_description":"x"}'
--
-- curl -X POST ".../rpc/deduct_credits" \
--   -d '{"p_user_id":"00000000-0000-0000-0000-000000000000","p_amount":0.01,
--        "p_description":"x","p_key_id":"00000000-0000-0000-0000-000000000000",
--        "p_tool_slug":"openai"}'
--
-- Pre-fix: 200/400/409 (anon-callable, function ran).
-- Post-fix: 401/403 (REVOKE took effect).
-- ============================================================================
