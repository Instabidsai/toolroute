-- Lane 4.99 — REVOKE anon+authenticated WRITE grants on 8 registry tables
--             with one SELECT-only policy (Apr 28 2026).
-- ============================================================================
-- Defense-in-depth, last sibling in the WRITE-grant audit chain. Pre-fix state:
--
--   - 8 registry/billing tables have RLS=on with one public-read SELECT policy
--     AND wide anon+authenticated WRITE grants. RLS default-deny on writes
--     (no INSERT/UPDATE/DELETE policy) is the ONLY thing blocking them today:
--
--     | table               | policies                 | anon writes               | auth writes              |
--     |---------------------|--------------------------|---------------------------|--------------------------|
--     | category_beliefs    | beliefs_public_read:S    | DELETE,INSERT,TRUNCATE,UPDATE | DELETE,INSERT,TRUNCATE,UPDATE |
--     | composites          | composites_public_read:S | DELETE,INSERT,TRUNCATE,UPDATE | DELETE,INSERT,TRUNCATE,UPDATE |
--     | plans               | plans_public_read:S      | DELETE,INSERT,TRUNCATE,UPDATE | DELETE,INSERT,TRUNCATE,UPDATE |
--     | provider_health_log | health_public_read:S     | DELETE,INSERT,TRUNCATE,UPDATE | DELETE,INSERT,TRUNCATE,UPDATE |
--     | skills              | anon_read:S              | DELETE,INSERT,TRUNCATE,UPDATE | DELETE,INSERT,TRUNCATE,UPDATE |
--     | tool_categories     | categories_public_read:S | DELETE,INSERT,TRUNCATE,UPDATE | DELETE,INSERT,TRUNCATE,UPDATE |
--     | tool_pricing        | pricing_public_read:S    | DELETE,INSERT,TRUNCATE,UPDATE | DELETE,INSERT,TRUNCATE,UPDATE |
--     | tools               | tools_public_read:S      | DELETE,INSERT,TRUNCATE,UPDATE | DELETE,INSERT,TRUNCATE,UPDATE |
--
-- Same fragility class as Lane 4.96/4.97/4.98: any future migration that
-- adds an `INSERT/UPDATE/DELETE USING (true)` policy or recreates a table
-- without the SELECT-only restriction silently re-opens writes via the
-- GRANT layer.
--
-- ============================================================================
-- CRITICAL — SELECT MUST REMAIN GRANTED:
--
-- These tables are the public catalog. `src/lib/api.ts` (browser-anon client)
-- reads them to feed Server Components for /tools, /discover, /tools/[slug],
-- /categories, /skills, etc. REVOKING SELECT would silently empty those pages
-- (PostgREST returns `[]` not error). This migration ONLY revokes writes.
--
-- Caller-side audit (zero false-positive risk) — direct .from(<table>) usage
-- across all 8 tables:
--
--   src/lib/api.ts                                     SELECT (anon, public catalog)
--     :13 .from("tools").select("*")
--     :22 .from("tools").select("*").eq("slug",..)
--     :32 .from("tool_categories").select("*")
--     :42 .from("category_beliefs").select("*")
--     :51 .from("composites").select("*")
--     :101 .from("tools").select("*")
--     :111 .from("skills").select("*")
--     :124 .from("category_beliefs").select("*")
--   src/lib/gateway.ts:498                             SELECT (admin, plan id lookup)
--   src/lib/adapters/toolroute-adapter.ts:75           SELECT (anon, slug exists check)
--   src/app/api/webhooks/stripe/route.ts:157,328       SELECT (admin, plan id lookup)
--   src/app/api/v1/tools/route.ts:128                  SELECT (admin/anon fallback)
--
-- ZERO direct REST WRITES across all 13 call sites — every hit is `.select(...)`.
--
-- Internal writes (intentional, NOT direct REST):
--   - tools, category_beliefs, tool_pricing ← challenge_tool() SECDEF RPC
--   - tools (rating/usage_count) ← record_usage() SECDEF RPC
--   - composites, skills, tool_categories ← admin-only seed/maintenance scripts
--     run via service_role
--   - plans ← admin-only seed (3 rows: free/scale/team) via service_role
--   - provider_health_log ← background health-check cron via service_role
--
-- All SECDEF RPCs run as their owner regardless of caller role; service_role
-- bypasses both GRANT and RLS. REVOKE has zero impact on legitimate write paths.
--
-- POST-FIX: writes from anon/authenticated hit "permission denied" at the
-- GRANT layer BEFORE RLS evaluation. Reads continue to work (SELECT grant
-- preserved + SELECT policy intact).
--
-- Sibling chain: 4.16 (anon SELECT) → 4.92 (RPC EXECUTE) → 4.94 (orphaned
-- SECDEF) → 4.95 (clean-state) → 4.96 (anon WRITE financial) → 4.97
-- (authenticated WRITE financial + backdoor policies) → 4.98 (zero-policy
-- registry/internal tables) → 4.99 (one-policy SELECT-only registry tables).
--
-- Idempotent — REVOKE on already-revoked grants is no-op.
-- ============================================================================

BEGIN;

-- 1. category_beliefs — crowd-sourced belief registry, written by challenge_tool SECDEF RPC
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON public.category_beliefs FROM anon, authenticated;

-- 2. composites — composite-tool definitions, admin-managed via service_role
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON public.composites FROM anon, authenticated;

-- 3. plans — billing plan registry (free/scale/team), admin-only seed
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON public.plans FROM anon, authenticated;

-- 4. provider_health_log — health-check time series, written by background cron
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON public.provider_health_log FROM anon, authenticated;

-- 5. skills — agent skill catalog, admin-managed via service_role
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON public.skills FROM anon, authenticated;

-- 6. tool_categories — taxonomy, admin-managed via service_role
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON public.tool_categories FROM anon, authenticated;

-- 7. tool_pricing — pricing rows, written by challenge_tool SECDEF RPC + admin
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON public.tool_pricing FROM anon, authenticated;

-- 8. tools — tool registry, written by challenge_tool + record_usage SECDEF RPCs
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON public.tools FROM anon, authenticated;

COMMIT;

-- ============================================================================
-- Verification (post-apply):
--
--   -- Zero anon/authenticated WRITE grants remain.
--   SELECT grantee, table_name, privilege_type
--   FROM information_schema.role_table_grants
--   WHERE table_schema='public'
--     AND grantee IN ('anon','authenticated')
--     AND privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE')
--     AND table_name IN ('tools','category_beliefs','tool_pricing','tool_categories',
--                        'plans','provider_health_log','skills','composites');
--   -- Expected: 0 rows.
--
--   -- SELECT grants intact (public catalog must keep working).
--   SELECT grantee, table_name FROM information_schema.role_table_grants
--   WHERE table_schema='public'
--     AND grantee IN ('anon','authenticated')
--     AND privilege_type='SELECT'
--     AND table_name IN ('tools','category_beliefs','tool_pricing','tool_categories',
--                        'plans','provider_health_log','skills','composites');
--   -- Expected: 16 rows (8 tables × 2 grantees).
--
--   -- Public catalog still loads.
--   curl "$TR_SUPA/rest/v1/tools?select=slug&limit=1" -H "apikey: $ANON_KEY" \
--     -H "Authorization: Bearer $ANON_KEY"
--   -- Expected: HTTP 200, [{"slug":"..."}]
-- ============================================================================
