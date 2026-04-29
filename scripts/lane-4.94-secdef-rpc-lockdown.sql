-- Lane 4.94 — Lock down anon-callable SECURITY DEFINER RPCs (Apr 28 2026).
-- ============================================================================
-- P0 finding: Lane 4.78 audit memo only enumerated the 5 gateway-internal
-- RPCs (add_credits/deduct_credits/validate_api_key/check_rate_limit/
-- log_gateway_request). Re-audit via pg_proc found two more with
-- SECURITY DEFINER + EXECUTE TO PUBLIC,anon,authenticated:
--
--   1. get_user_dashboard(p_user_id uuid)  — IDOR (CRITICAL)
--      Anon caller with any valid user UUID gets:
--        - email (PII)
--        - credit_balance, lifetime_credits, lifetime_usage (financial)
--        - api_keys[] (id, name, key_prefix, request_count, spending_used) (operational)
--        - usage_7d[] from gateway_usage_log (tool, cost, latency, errors)
--        - recent_transactions[] (full credit_transactions audit trail)
--      Live probe at 17:25Z confirmed HTTP 200 with full payload.
--      Bypasses Lane 4.1 RLS lockdown on usage_events / gateway_usage_log
--      because SECURITY DEFINER reads with function-owner privilege.
--
--   2. cleanup_rate_limits()  — abuse class (LOW)
--      Maintenance function deleting from rate_limit_windows. Filter is
--      `window_start < now() - interval '2 days'` so anon spam can't
--      bypass rate limits (live windows are 1m/1d, much shorter than 2d).
--      But anon-callable maintenance functions are wrong on principle —
--      future modifications might widen the blast radius. Lock it.
--
-- Both RPCs have ZERO callers in the Next.js app (verified via grep
-- across .ts/.tsx/.js/.sql/.py/.sh/.json/.yml). Orphaned from a previous
-- registry/admin design that was never wired up. Lockdown is risk-free.
--
-- Applied to production isbratmfnnzipzyoefbo via Supabase Mgmt API at
-- 2026-04-28T<UTC>. Idempotent — REVOKE on already-revoked grants is no-op.
-- Sibling to Lane 4.92 (gateway RPCs lockdown), Lane 4.78 (audit memo
-- this lane corrects), Lane 4.14 (original P0).
-- ============================================================================

BEGIN;

-- 1. get_user_dashboard — IDOR. Reads gateway_users + api_keys +
--    gateway_usage_log + credit_transactions for any user UUID passed.
REVOKE EXECUTE ON FUNCTION public.get_user_dashboard(uuid)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_dashboard(uuid)
    TO service_role;

-- 2. cleanup_rate_limits — maintenance function, service_role only.
REVOKE EXECUTE ON FUNCTION public.cleanup_rate_limits()
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_rate_limits()
    TO service_role;

COMMIT;

-- ============================================================================
-- Verification (anon JWT, both must return 401 with "permission denied"):
-- ============================================================================
--   curl -X POST .../rpc/get_user_dashboard \
--     -d '{"p_user_id":"150c42fd-1599-43fc-a8eb-791beb94dda5"}'
--     Pre-fix: HTTP 200 + full PII payload
--     Post-fix: HTTP 401 "permission denied for function get_user_dashboard"
--
--   curl -X POST .../rpc/cleanup_rate_limits -d '{}'
--     Pre-fix: HTTP 204 (success)
--     Post-fix: HTTP 401 "permission denied for function cleanup_rate_limits"
-- ============================================================================
