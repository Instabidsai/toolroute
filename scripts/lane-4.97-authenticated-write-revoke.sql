-- Lane 4.97 — REVOKE authenticated WRITE grants on financial tables (Apr 28 2026).
-- ============================================================================
-- P0 self-mint surface surfaced post-Lane-4.96. Lane 4.96 closed anon writes;
-- this lane closes the SAME class for the `authenticated` role.
--
-- Pre-fix state (logged-in user with a valid Supabase JWT):
--   PATCH /rest/v1/gateway_users?id=eq.<my-uid>  body: {credit_balance: 999999}
--     → RLS policy `users_own_update` (PUBLIC role, USING auth.uid() = id)
--     → matches → ALLOWED → user mints arbitrary credits to their own row.
--   POST /rest/v1/api_keys  body: {user_id:<my-uid>, key_prefix:"tr_live_", ...}
--     → RLS policy `keys_own_insert` (PUBLIC role, WITH CHECK user_id = auth.uid())
--     → matches → ALLOWED → user mints a tr_live_ premium key, bypassing the
--       Lane 4.3 paid-plan gate enforced server-side in /api/v1/keys.
--
-- Pre-fix grants (information_schema.role_table_grants, grantee=authenticated):
--   api_keys             → DELETE,INSERT,REFERENCES,TRIGGER,TRUNCATE,UPDATE
--   credit_transactions  → DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
--   gateway_usage_log    → DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
--   gateway_users        → DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
--   usage_events         → DELETE,INSERT,REFERENCES,TRIGGER,TRUNCATE,UPDATE
--   user_provider_keys   → DELETE,INSERT,REFERENCES,TRIGGER,TRUNCATE,UPDATE
--
-- Pre-fix policies (PUBLIC role) acting as backdoor self-modification surfaces:
--   users_insert          gateway_users        INSERT  WITH CHECK (auth.uid() = id)
--   users_own_update      gateway_users        UPDATE  USING (auth.uid() = id)
--   keys_own_insert       api_keys             INSERT  WITH CHECK (user_id = auth.uid())
--   keys_own_update       api_keys             UPDATE  USING (user_id = auth.uid())
--   byok_own_insert       user_provider_keys   INSERT  WITH CHECK (user_id = auth.uid())
--   byok_own_update       user_provider_keys   UPDATE  USING (user_id = auth.uid())
--   byok_own_delete       user_provider_keys   DELETE  USING (user_id = auth.uid())
--
-- Caller-side audit (zero false-positive risk — same as Lane 4.96):
--   src/lib/gateway.ts:503        admin.from(gateway_users).insert    [supabaseAdmin]
--   src/app/auth/callback/route.ts:62/72  admin.from(gateway_users).update/insert [supabaseAdmin]
--   src/app/api/webhooks/stripe/route.ts:48  sb.from(credit_transactions).insert  [supabaseAdmin via param type]
--   src/app/api/webhooks/stripe/route.ts:139/164  sb.from(gateway_users).update    [supabaseAdmin]
--   src/app/api/v1/signup/route.ts:157  sb.from(gateway_users).insert  [supabaseAdmin]
--   src/app/api/v1/signup/route.ts:180  sb.from(api_keys).insert       [supabaseAdmin]
--
-- All 7 write sites use supabaseAdmin() (service_role), which bypasses both
-- GRANTs and RLS. authenticated REVOKE + policy DROP has zero impact on
-- legitimate writes.
--
-- POST-FIX: logged-in users hit "permission denied" at the GRANT layer BEFORE
-- RLS evaluation — eliminates the self-mint attack class entirely.
--
-- The two-step (REVOKE grant + DROP policy) is intentional defense-in-depth:
--   1. GRANT REVOKE blocks even if a future engineer recreates the policy.
--   2. Policy DROP removes the backdoor so that re-granting writes (e.g.,
--      adding a new "support" role to PUBLIC) doesn't silently re-open mint.
--
-- Sibling: 4.16 (anon SELECT REVOKE) → 4.92 (RPC EXECUTE) → 4.94 (orphaned
-- SECDEF) → 4.95 (clean-state) → 4.96 (anon WRITE REVOKE) → 4.97 (authenticated
-- WRITE REVOKE + dead-policy DROP).
--
-- Idempotent — REVOKE on already-revoked is no-op; DROP POLICY IF EXISTS
-- guards against re-runs.
-- ============================================================================

BEGIN;

-- 1. REVOKE write grants from authenticated on all 6 financial tables.
--    SELECT grants stay where they exist (gateway_users / credit_transactions /
--    gateway_usage_log have authenticated SELECT policies for owner-scope reads).

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON public.api_keys FROM authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON public.credit_transactions FROM authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON public.gateway_usage_log FROM authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON public.gateway_users FROM authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON public.usage_events FROM authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON public.user_provider_keys FROM authenticated;

-- 2. DROP the dead PUBLIC-role write policies. These were the backdoor
--    self-modification surface — they only ever fired for authenticated
--    (auth.uid() is null for anon, and service_role bypasses RLS). With
--    authenticated WRITE revoked above, the policies are unreachable; DROP
--    them so a future role-grant change can't silently re-open mint.

DROP POLICY IF EXISTS users_insert         ON public.gateway_users;
DROP POLICY IF EXISTS users_own_update     ON public.gateway_users;
DROP POLICY IF EXISTS keys_own_insert      ON public.api_keys;
DROP POLICY IF EXISTS keys_own_update      ON public.api_keys;
DROP POLICY IF EXISTS byok_own_insert      ON public.user_provider_keys;
DROP POLICY IF EXISTS byok_own_update      ON public.user_provider_keys;
DROP POLICY IF EXISTS byok_own_delete      ON public.user_provider_keys;

COMMIT;

-- ============================================================================
-- Verification queries (post-apply):
--
--   -- Confirm authenticated has zero write grants on the 6 tables:
--   SELECT grantee, table_name, privilege_type
--   FROM information_schema.role_table_grants
--   WHERE table_schema = 'public'
--     AND grantee = 'authenticated'
--     AND privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE')
--     AND table_name IN ('api_keys','credit_transactions','gateway_usage_log',
--                        'gateway_users','usage_events','user_provider_keys');
--   -- Expected: 0 rows.
--
--   -- Confirm 7 backdoor policies are gone:
--   SELECT tablename, policyname FROM pg_policies
--   WHERE schemaname = 'public'
--     AND policyname IN ('users_insert','users_own_update','keys_own_insert',
--                        'keys_own_update','byok_own_insert','byok_own_update',
--                        'byok_own_delete');
--   -- Expected: 0 rows.
--
-- The remaining 3 authenticated SELECT policies (gateway_users_owner_read,
-- credit_transactions_owner_read, gateway_usage_log_owner_read) stay — they
-- are the dashboard owner-scope reads and are NOT a write surface.
-- ============================================================================
