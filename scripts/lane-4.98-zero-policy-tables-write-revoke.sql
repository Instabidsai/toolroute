-- Lane 4.98 — REVOKE anon+authenticated WRITE grants on 8 zero-policy
--             registry/internal tables (Apr 28 2026).
-- ============================================================================
-- Defense-in-depth, surfaced by Lane 4.97 generalized audit. Pre-fix state:
--
--   - 8 tables have RLS=on but ZERO policies (default-deny via RLS only)
--     AND wide anon+authenticated WRITE grants:
--
--     | table                | policies | anon writes               | auth writes              |
--     |----------------------|----------|---------------------------|--------------------------|
--     | conversations        | 0        | DELETE,INSERT,TRUNCATE,UPDATE | DELETE,INSERT,TRUNCATE,UPDATE |
--     | discovery_feed       | 0        | DELETE,INSERT,TRUNCATE,UPDATE | DELETE,INSERT,TRUNCATE,UPDATE |
--     | inventory            | 0        | DELETE,INSERT,TRUNCATE,UPDATE | DELETE,INSERT,TRUNCATE,UPDATE |
--     | rate_limit_windows   | 0        | DELETE,INSERT,TRUNCATE,UPDATE | DELETE,INSERT,TRUNCATE,UPDATE |
--     | tool_memory          | 0        | DELETE,INSERT,TRUNCATE,UPDATE | DELETE,INSERT,TRUNCATE,UPDATE |
--     | tool_overrides       | 0        | DELETE,INSERT,TRUNCATE,UPDATE | DELETE,INSERT,TRUNCATE,UPDATE |
--     | tool_providers       | 0        | DELETE,INSERT,TRUNCATE,UPDATE | DELETE,INSERT,TRUNCATE,UPDATE |
--     | tool_requests        | 0        | DELETE,INSERT,TRUNCATE,UPDATE | DELETE,INSERT,TRUNCATE,UPDATE |
--
-- RLS default-deny is the ONLY thing blocking writes today. If a future
-- migration disables RLS, adds an `USING (true)` policy, or recreates a
-- table without `ENABLE ROW LEVEL SECURITY`, the GRANT layer silently
-- re-opens writes — same fragility class as Lane 4.96 (anon WRITE) and
-- Lane 4.97 (authenticated WRITE).
--
-- Caller-side audit (zero false-positive risk):
--   src/app/api/admin/providers/route.ts:91 admin.from(tool_providers).insert
--     → admin-gated via validateAdmin() at line 11 + supabaseAdmin() at line 47
--     → service_role bypasses both GRANT and RLS
--
-- All other 7 tables: zero direct REST writes from src/. Internal writes
-- (rate_limit_windows from check_rate_limit RPC, tool_requests from
-- log_tool_request RPC, etc.) go through SECURITY DEFINER functions which
-- run as their owner regardless of caller's GRANT.
--
-- POST-FIX: writes from anon/authenticated hit "permission denied" at the
-- GRANT layer BEFORE RLS evaluation. RLS becomes the secondary defense
-- instead of the only defense.
--
-- Sibling chain: 4.16 (anon SELECT) → 4.92 (RPC EXECUTE) → 4.94 (orphaned
-- SECDEF) → 4.95 (clean-state) → 4.96 (anon WRITE financial) → 4.97
-- (authenticated WRITE financial + backdoor policies) → 4.98 (zero-policy
-- registry/internal tables).
--
-- Out of scope (Lane 4.99 candidate): 8 one-policy SELECT-only tables
-- (tools, category_beliefs, tool_pricing, tool_categories, plans,
-- provider_health_log, skills, composites). These are crowd-source-writable
-- via SECDEF RPCs (challenge_tool, record_usage), need deeper caller-side
-- audit before REVOKE.
--
-- Idempotent — REVOKE on already-revoked grants is no-op.
-- ============================================================================

BEGIN;

-- 1. conversations — chat history (zero direct writers in src/)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON public.conversations FROM anon, authenticated;

-- 2. discovery_feed — agent-discovery posts (zero direct writers in src/)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON public.discovery_feed FROM anon, authenticated;

-- 3. inventory — registry inventory tracking (zero direct writers in src/)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON public.inventory FROM anon, authenticated;

-- 4. rate_limit_windows — written by check_rate_limit SECDEF RPC only
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON public.rate_limit_windows FROM anon, authenticated;

-- 5. tool_memory — agent-internal memory store (zero direct writers in src/)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON public.tool_memory FROM anon, authenticated;

-- 6. tool_overrides — admin-managed config (zero direct writers in src/)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON public.tool_overrides FROM anon, authenticated;

-- 7. tool_providers — admin-managed provider registry
--    (write at src/app/api/admin/providers/route.ts:91 uses supabaseAdmin)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON public.tool_providers FROM anon, authenticated;

-- 8. tool_requests — written by log_tool_request SECDEF RPC only
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON public.tool_requests FROM anon, authenticated;

COMMIT;

-- ============================================================================
-- Verification (post-apply):
--
--   SELECT grantee, table_name, privilege_type
--   FROM information_schema.role_table_grants
--   WHERE table_schema='public'
--     AND grantee IN ('anon','authenticated')
--     AND privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE')
--     AND table_name IN ('conversations','discovery_feed','inventory',
--                        'rate_limit_windows','tool_memory','tool_overrides',
--                        'tool_providers','tool_requests');
--   -- Expected: 0 rows.
--
-- Service_role + postgres grants remain intact — legitimate writers
-- (admin/providers/route.ts via supabaseAdmin, SECDEF RPCs running as owner)
-- continue to work.
-- ============================================================================
