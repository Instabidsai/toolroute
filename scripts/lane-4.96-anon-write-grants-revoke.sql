-- Lane 4.96 — REVOKE anon WRITE grants on financial tables (Apr 28 2026).
-- ============================================================================
-- Defense-in-depth gap surfaced by Lane 4.95 pg_proc audit.
--
-- Pre-fix state (information_schema.role_table_grants for grantee='anon'):
--   api_keys             → DELETE,INSERT,REFERENCES,TRIGGER,TRUNCATE,UPDATE
--   credit_transactions  → DELETE,INSERT,REFERENCES,TRIGGER,TRUNCATE,UPDATE
--   gateway_usage_log    → DELETE,INSERT,REFERENCES,TRIGGER,TRUNCATE,UPDATE
--   gateway_users        → DELETE,INSERT,REFERENCES,TRIGGER,TRUNCATE,UPDATE
--   usage_events         → DELETE,INSERT,REFERENCES,TRIGGER,TRUNCATE,UPDATE
--   user_provider_keys   → DELETE,INSERT,REFERENCES,TRIGGER,TRUNCATE,UPDATE
--
-- Live anon probes (anon JWT, no session) PRE-FIX confirmed:
--   POST /api_keys              → 401 "new row violates RLS"     (RLS blocks)
--   PATCH /gateway_users        → 401 "permission denied"        (RLS blocks)
--   DELETE /api_keys            → 401 "permission denied"        (RLS blocks)
--   POST /credit_transactions   → 401 "new row violates RLS"     (RLS blocks)
--
-- RLS is currently the ONLY thing preventing anon writes. If any policy
-- weakens (USING/WITH_CHECK reverts to true, owner-scope removed, table
-- recreated without RLS, etc.) anon could mint credits or drain accounts.
--
-- Lane 4.16 REVOKE'd anon SELECT on these tables but did NOT revoke the
-- write grants. This lane closes that defense-in-depth gap.
--
-- Caller-side audit (proves zero false-positive risk):
--   src/lib/gateway.ts:503        admin.from(gateway_users).insert    [supabaseAdmin]
--   src/app/auth/callback/route.ts:72  admin.from(gateway_users).insert  [supabaseAdmin]
--   src/app/api/webhooks/stripe/route.ts:48  sb.from(credit_transactions).insert  [supabaseAdmin]
--   src/app/api/webhooks/stripe/route.ts:139 sb.from(gateway_users).update        [supabaseAdmin]
--   src/app/api/webhooks/stripe/route.ts:164 sb.from(gateway_users).update        [supabaseAdmin]
--   src/app/api/v1/signup/route.ts:157  sb.from(gateway_users).insert  [supabaseAdmin]
--   src/app/api/v1/signup/route.ts:180  sb.from(api_keys).insert       [supabaseAdmin]
--
-- All 7 write sites use supabaseAdmin() (service_role), which bypasses
-- both RLS and grants. anon REVOKE has zero impact on legitimate writes.
--
-- POST-FIX: anon writes hit "permission denied" at the GRANT layer
-- BEFORE RLS evaluation — eliminates the policy-weakening attack class.
--
-- Sibling: Lane 4.16 (anon SELECT REVOKE), Lane 4.92 (RPC EXECUTE),
-- Lane 4.94 (orphaned SECDEF lockdown), Lane 4.95 (clean-state).
--
-- Idempotent — REVOKE on already-revoked grants is no-op.
-- ============================================================================

BEGIN;

-- 1. api_keys — gates premium tr_live_ key issuance + per-user request count
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON public.api_keys FROM anon;

-- 2. credit_transactions — append-only audit ledger; anon mint-attack target
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON public.credit_transactions FROM anon;

-- 3. gateway_usage_log — billing-cost audit trail (cost_to_user, cost_to_us)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON public.gateway_usage_log FROM anon;

-- 4. gateway_users — credit_balance, plan_slug, stripe_customer_id; mint target
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON public.gateway_users FROM anon;

-- 5. usage_events — gateway request log (Lane 4.1 already locked SELECT)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON public.usage_events FROM anon;

-- 6. user_provider_keys — BYOK plaintext keys (Lane 4.36-impl pending encryption)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON public.user_provider_keys FROM anon;

COMMIT;

-- ============================================================================
-- Verification (anon JWT, all writes must hit GRANT-level 42501):
-- ============================================================================
--   POST /rest/v1/api_keys             → 401 "permission denied for table api_keys"
--   PATCH /rest/v1/gateway_users        → 401 "permission denied for table gateway_users"
--   POST /rest/v1/credit_transactions  → 401 "permission denied for table credit_transactions"
--   DELETE /rest/v1/usage_events       → 401 "permission denied for table usage_events"
--
-- Pre-fix error message: "new row violates row-level security policy"
-- Post-fix error message: "permission denied for table" (GRANT-level, before RLS)
--
-- Logged-in user paths (role=authenticated, NOT anon) are unaffected — those
-- still go through RLS owner-scoped policies. Service_role paths bypass all.
-- ============================================================================
