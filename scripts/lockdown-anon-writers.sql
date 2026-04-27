-- ToolRoute — anon-write lockdown (Council finding 2026-04-26, room d7bbe1e1).
-- Public MCP server ships an anon JWT in source. RLS already blocks the
-- underlying table writes, but make the lockdown explicit at the function
-- grant level so future RPC changes can't accidentally open a write hole.
--
-- Run this in the Supabase SQL editor for project isbratmfnnzipzyoefbo.
-- All writes from external agents must now go through /api/v1/registry/*
-- which validates a tr_live_/tr_test_ API key and uses service-role.

BEGIN;

-- 1. Revoke EXECUTE on the 3 write-RPCs from public roles.
REVOKE EXECUTE ON FUNCTION public.record_usage(text, text, text, text, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_tool_request(text, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.challenge_tool(text, text, jsonb) FROM anon, authenticated;

-- 2. Tighten usage_events SELECT — currently anon can read all rows.
--    Drop any permissive SELECT policy and re-create as service-role only.
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS usage_events_anon_select ON public.usage_events;
DROP POLICY IF EXISTS usage_events_public_read ON public.usage_events;

-- 3. Verify state after.
SELECT
  p.proname AS function,
  has_function_privilege('anon', p.oid, 'execute') AS anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'execute') AS authed_can_execute,
  has_function_privilege('service_role', p.oid, 'execute') AS service_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('record_usage', 'log_tool_request', 'challenge_tool')
ORDER BY p.proname;

COMMIT;

-- Expected:
--  challenge_tool      | anon=f | auth=f | service=t
--  log_tool_request    | anon=f | auth=f | service=t
--  record_usage        | anon=f | auth=f | service=t
