-- ToolRoute — Lane 4.5 read-lockdown extension (2026-04-27).
-- Companion to scripts/lockdown-anon-read-leaks.sql (which covers
-- usage_events, inventory, tool_requests).
--
-- Why a v2:
-- The Lane 4.4 regression guard (scripts/verify-rls-lockdown.mjs) found 5
-- additional sensitive tables where anon currently has a SELECT grant. The
-- tables are empty in production today, but a single inserted row would leak.
--
-- Two access patterns require two different fixes:
--
-- 1. Server-only tables (gateway uses supabaseAdmin/service-role; no client
--    code reads these): blanket REVOKE SELECT from anon + authenticated.
--      api_keys           — key_hash, key_prefix → auth-bypass material
--      user_provider_keys — encrypted BYOK provider tokens
--      tool_requests      — internal ops todo list (also in v1, idempotent)
--
-- 2. Client-readable owner-scoped tables (Lane 4.6 audit found 3 "use client"
--    components reading sensitive tables via the public anon client + user's
--    JWT, filtering by session.user.id). Blanket REVOKE would silently empty
--    the dashboard (Hard Rule #54). Instead: enable RLS and add owner-scoped
--    SELECT policy.
--      gateway_users        — id = auth.uid()        (dashboard/page.tsx:173)
--      gateway_usage_log    — user_id = auth.uid()   (dashboard/page.tsx:184)
--      credit_transactions  — user_id = auth.uid()   (dashboard/billing/page.tsx:258)
--
-- Run in Supabase SQL editor for project isbratmfnnzipzyoefbo. Idempotent.

BEGIN;

-- ============================================================================
-- Section 1: server-only tables (blanket REVOKE)
-- ============================================================================
DO $$
DECLARE
  tbl TEXT;
  pol RECORD;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['api_keys', 'user_provider_keys', 'tool_requests']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      RAISE NOTICE 'skip: public.% does not exist', tbl;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

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
-- Section 2: gateway_users — owner-scoped SELECT for dashboard
-- ============================================================================
ALTER TABLE public.gateway_users ENABLE ROW LEVEL SECURITY;

-- Drop any existing permissive SELECT policies so we don't double-cover.
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'gateway_users' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.gateway_users', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY gateway_users_owner_read ON public.gateway_users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- anon should not be able to read this table at all (they have no session yet).
REVOKE SELECT ON public.gateway_users FROM anon;
GRANT SELECT ON public.gateway_users TO authenticated;
-- The CREATE POLICY above + RLS gating means authenticated can only see own row.

-- ============================================================================
-- Section 3: gateway_usage_log — owner-scoped SELECT for dashboard
-- ============================================================================
ALTER TABLE public.gateway_usage_log ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'gateway_usage_log' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.gateway_usage_log', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY gateway_usage_log_owner_read ON public.gateway_usage_log
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

REVOKE SELECT ON public.gateway_usage_log FROM anon;
GRANT SELECT ON public.gateway_usage_log TO authenticated;

-- ============================================================================
-- Section 4: credit_transactions — owner-scoped SELECT for billing dashboard
-- ============================================================================
-- src/app/dashboard/billing/page.tsx:258 reads this client-side, filtering by
-- session.user.id and ordering by created_at. Same pattern as Sections 2-3.
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'credit_transactions' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.credit_transactions', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY credit_transactions_owner_read ON public.credit_transactions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

REVOKE SELECT ON public.credit_transactions FROM anon;
GRANT SELECT ON public.credit_transactions TO authenticated;

-- ============================================================================
-- Verification
-- ============================================================================

-- Locked-tight tables: zero policies, zero anon/auth grants.
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('api_keys', 'user_provider_keys', 'tool_requests')
ORDER BY tablename, policyname;
-- Expected: zero rows.

-- Grant matrix for locked-tight tables:
SELECT
  t AS table_name,
  has_table_privilege('anon', 'public.' || t, 'SELECT') AS anon_select,
  has_table_privilege('authenticated', 'public.' || t, 'SELECT') AS auth_select,
  has_table_privilege('service_role', 'public.' || t, 'SELECT') AS service_select
FROM unnest(ARRAY['api_keys', 'user_provider_keys', 'tool_requests']) AS t;
-- Expected: anon=f, auth=f, service=t for every row.

-- Owner-scoped tables: one SELECT policy each, anon=f, auth=t (RLS-gated).
SELECT tablename, policyname, cmd, roles, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('gateway_users', 'gateway_usage_log', 'credit_transactions')
ORDER BY tablename, policyname;
-- Expected: 1 row per table. policyname ends in `_owner_read`. qual mentions auth.uid().

SELECT
  t AS table_name,
  has_table_privilege('anon', 'public.' || t, 'SELECT') AS anon_select,
  has_table_privilege('authenticated', 'public.' || t, 'SELECT') AS auth_select
FROM unnest(ARRAY['gateway_users', 'gateway_usage_log', 'credit_transactions']) AS t;
-- Expected: anon=f, auth=t (RLS will gate per-row inside the SELECT).

COMMIT;

-- Post-deploy verification (replace <anon_jwt>):
--   for t in api_keys user_provider_keys tool_requests; do
--     curl -s "https://isbratmfnnzipzyoefbo.supabase.co/rest/v1/$t?limit=1" \
--       -H "apikey: <anon_jwt>" -H "Authorization: Bearer <anon_jwt>"; echo
--   done
-- Expected: 401 Unauthorized for each.
--
-- For gateway_users / gateway_usage_log: anon-with-no-session should 401;
-- a logged-in user calling with their JWT should see only their own rows.
-- Test path: open /dashboard while signed in — credit balance + usage chart
-- must still render.
--
-- After Justin runs both v1 and v2, run scripts/verify-rls-lockdown.mjs again.
-- Expected: api_keys/user_provider_keys/tool_requests/usage_events/inventory
-- show "(locked)". gateway_users/gateway_usage_log will still show
-- "permissive-but-empty" or "(locked)" via anon — that's correct, since
-- anon has no auth.uid() and the RLS USING clause filters everything out.
