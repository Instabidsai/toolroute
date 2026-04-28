-- ToolRoute — Lane 4.16 anon write-grants + admin-table read lockdown
-- ============================================================================
-- Date: 2026-04-28
-- Companion to:
--   * scripts/lockdown-anon-read-leaks.sql        (Lane 4.1)
--   * scripts/lockdown-anon-read-leaks-v2.sql     (Lane 4.5)
--   * scripts/lockdown-gateway-rpcs.sql           (Lane 4.14, P0)
--
-- This migration closes two gaps surfaced by Lane 4.16's audit:
--
-- (1) Two admin-only / gateway-internal tables still return 200+[] on anon
--     SELECT (Hard Rule #56 — AMBIGUOUS, not LOCKED). Lane 4.5 v2 missed both:
--       - tool_providers       — master pool keys (admin-only)
--       - rate_limit_windows   — gateway-internal telemetry
--
-- (2) Anon role currently has INSERT/UPDATE/DELETE GRANT on all 7
--     financial-gateway tables. RLS absorbs the attack today (INSERT throws
--     42501; UPDATE/DELETE silent-filter to */0 — Hard Rule #45). But a
--     future schema change that drops or weakens an RLS policy turns this
--     into a mass-mutation primitive with no GRANT-layer backstop.
--
-- All write paths in src/ go through supabaseAdmin() (service-role). Audit
-- of 9 route files + gateway.ts confirmed zero anon-client write paths
-- exist. REVOKE on anon is therefore safe.
--
-- Run in Supabase SQL editor for project isbratmfnnzipzyoefbo. Idempotent.
-- ============================================================================

BEGIN;

-- ============================================================================
-- Section 1: REVOKE anon SELECT on admin-only tables (gap from Lane 4.5 v2)
-- ============================================================================
DO $$
DECLARE
  tbl TEXT;
  pol RECORD;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['tool_providers', 'rate_limit_windows']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      RAISE NOTICE 'skip: public.% does not exist', tbl;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    -- Drop any permissive SELECT policy that could re-open access
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl AND cmd = 'SELECT'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
    END LOOP;

    EXECUTE format('REVOKE SELECT ON public.%I FROM anon, authenticated', tbl);
  END LOOP;
END $$;

-- ============================================================================
-- Section 2: REVOKE anon INSERT/UPDATE/DELETE on all 7 financial-gateway
--            tables (defense-in-depth against future RLS policy drift)
-- ============================================================================
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'gateway_users',
    'api_keys',
    'user_provider_keys',
    'tool_providers',
    'rate_limit_windows',
    'gateway_usage_log',
    'credit_transactions'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      RAISE NOTICE 'skip: public.% does not exist', tbl;
      CONTINUE;
    END IF;

    EXECUTE format(
      'REVOKE INSERT, UPDATE, DELETE ON public.%I FROM anon, authenticated',
      tbl
    );

    -- service_role keeps all privileges (it's the bypass-RLS role and the
    -- one supabaseAdmin() authenticates as; do not touch it)
  END LOOP;
END $$;

COMMIT;

-- ============================================================================
-- Verification probes (run from a terminal with only the public anon JWT;
-- each line MUST return 401/403, NOT 200/[] or 204):
-- ============================================================================
--
-- # Section 1 read-revoke verification
-- curl ".../rest/v1/tool_providers?select=*&limit=1"      # MUST 401/403
-- curl ".../rest/v1/rate_limit_windows?select=*&limit=1"  # MUST 401/403
--
-- # Section 2 write-revoke verification
-- curl -X POST   ".../rest/v1/credit_transactions"  -d '{}'                # MUST 401/403
-- curl -X PATCH  ".../rest/v1/gateway_users?id=not.is.null" -d '{"x":1}'   # MUST 401/403
-- curl -X DELETE ".../rest/v1/api_keys?id=eq.0..."                         # MUST 401/403
--
-- Pre-fix: PATCH/DELETE return 200/204 with Content-Range */0 (Hard Rule #45).
-- Post-fix: 401/403 (REVOKE took effect at the GRANT layer).
-- ============================================================================
