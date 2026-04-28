-- ToolRoute — registry-side anon-read lockdown (Lane 4.1+4.2, 2026-04-27).
-- Companion to scripts/lockdown-anon-writers.sql.
--
-- Problems found by anon-read probe on 2026-04-27:
--   1. public.usage_events — anon read returns rows with company="DropClose",
--      action="product_demo_video". Competitive intel (which company uses which tool).
--   2. public.inventory — anon read exposes internal `our_experience`, `our_gotchas`,
--      `used_by_companies` columns. Internal operational notes, not customer-facing.
--   3. public.tool_requests — anon read exposes internal status strings like
--      "MISSING: Vector embeddings not populated...". Leaks our internal todo list.
--
-- Public-by-design and intentionally NOT touched here:
--   tools, tool_categories, category_beliefs, composites, skills — these are
--   the catalog surface (advertised on toolroute.ai) and must stay anon-readable.
--
-- Run in Supabase SQL editor for project isbratmfnnzipzyoefbo. Idempotent.
-- After: anon SELECT on each locked table returns 401 or [].

BEGIN;

-- For each leaky table: enable RLS, drop permissive SELECT policies, revoke grants.
DO $$
DECLARE
  tbl TEXT;
  pol RECORD;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['usage_events', 'inventory', 'tool_requests']
  LOOP
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

-- Service role bypasses RLS by default; no policy needed.

-- Verify: list any remaining SELECT policies on locked tables.
SELECT tablename, policyname, cmd, roles, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('usage_events', 'inventory', 'tool_requests')
ORDER BY tablename, policyname;
-- Expected: zero rows.

-- Verify: table-level SELECT privilege per role.
SELECT
  t AS table_name,
  has_table_privilege('anon', 'public.' || t, 'SELECT') AS anon_select,
  has_table_privilege('authenticated', 'public.' || t, 'SELECT') AS auth_select,
  has_table_privilege('service_role', 'public.' || t, 'SELECT') AS service_select
FROM unnest(ARRAY['usage_events', 'inventory', 'tool_requests']) AS t;
-- Expected for every row: anon=f, auth=f, service=t.

COMMIT;

-- Post-deploy verification (anon JWT, replace <anon_jwt>):
--   for t in usage_events inventory tool_requests; do
--     curl -s "https://isbratmfnnzipzyoefbo.supabase.co/rest/v1/$t?limit=1" \
--       -H "apikey: <anon_jwt>" -H "Authorization: Bearer <anon_jwt>"; echo
--   done
-- Expected: [] (empty array) or 401 for each — NOT row data.
