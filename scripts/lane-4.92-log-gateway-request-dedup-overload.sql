-- Lane 4.92 — drop dead 12-arg log_gateway_request overload (Apr 28 2026).
-- ============================================================================
-- Context: scripts/lockdown-gateway-rpcs.sql (Lane 4.14) shipped with two
-- signature drifts vs live pg_proc:
--
--   (a) deduct_credits arg-type order was wrong — REVOKE failed on
--       (numeric, text, uuid, text, uuid). Live signature is
--       (uuid, numeric, text, uuid, text). The wrong order matched no overload
--       so the lockdown rolled back at BEGIN/COMMIT.
--
--   (b) log_gateway_request had two overloads:
--         - 12 args (no p_key_source) — older shape, dead
--         - 13 args (with p_key_source) — current callers (gateway.ts:301,345)
--       PostgREST returned PGRST203 "Could not choose the best candidate
--       function" when callers passed args common to both shapes — even though
--       every caller passed p_key_source, PostgREST disambiguates by argument
--       set, not by which call site.
--
-- Fix (a) was applied directly via Mgmt API at 16:44Z and committed back into
-- scripts/lockdown-gateway-rpcs.sql in this PR.
-- Fix (b) requires dropping the dead overload — this script is the artifact.
-- Already applied to production at 16:46Z. Idempotent re-run is safe.
-- ============================================================================

-- Drop the 12-arg dead overload. IF EXISTS so re-running on a fresh DB after
-- replay is safe — fresh DBs would not have the dead overload at all.
DROP FUNCTION IF EXISTS public.log_gateway_request(
    uuid, uuid, text, text, integer, numeric, numeric, integer, boolean, text, jsonb, integer
);

-- ============================================================================
-- Verification (anon JWT, both should now return 401 not 300/PGRST203):
--   curl -X POST .../rpc/log_gateway_request \
--     -d '{"p_user_id":"00000000-...","p_key_id":"00000000-...",
--          "p_tool_slug":"openai","p_provider":"openai","p_status":200,
--          "p_cost_to_us":0,"p_cost_to_user":0,"p_latency_ms":1,
--          "p_used_byok":false}'
--
-- Pre-fix: HTTP 300 PGRST203 (overload ambiguity).
-- Post-fix: HTTP 401 with "permission denied for function log_gateway_request"
--          (Lane 4.14 lockdown applies; only one overload to choose from).
-- ============================================================================
