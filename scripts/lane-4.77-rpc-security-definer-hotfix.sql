-- Lane 4.77 — RPC SECURITY DEFINER hotfix for post-lockdown anon-callable RPCs
--
-- After Lane 0.1 lockdown SQL revoked anon SELECT/INSERT on `inventory`,
-- `usage_events`, `api_keys`, `user_provider_keys`, etc., the four RPCs below
-- silently broke for anon callers because they internally read/write those
-- tables and were NOT marked SECURITY DEFINER.
--
-- Symptom: /discover ISR regeneration 500'd with
--   `42501: permission denied for table inventory`
-- because `librarian_startup` (called from the anon Server Component)
-- internally `COUNT(*) FROM inventory`.
--
-- Each RPC returns AGGREGATE data only (counts, joined champion summary, or
-- a write that records anon-allowed events). None expose row-level inventory
-- or usage_events data. SECURITY DEFINER + locked search_path is the safe fix.
--
-- Already executed against prod via Supabase Mgmt API on 2026-04-28.
-- This file exists for version-control parity.

-- 1. librarian_startup — used by /discover, /tools, MCP server startup
ALTER FUNCTION public.librarian_startup()
  SECURITY DEFINER
  SET search_path = public, pg_temp;

-- 2. check_before_build — used by ToolRoute MCP `check_before_build` skill
ALTER FUNCTION public.check_before_build(text)
  SECURITY DEFINER
  SET search_path = public, pg_temp;

-- 3. get_category_champion — used by /discover, MCP `get_category_champion`
ALTER FUNCTION public.get_category_champion(text, text)
  SECURITY DEFINER
  SET search_path = public, pg_temp;

-- 4. record_usage — used by MCP `record_usage` skill (writes usage_events)
ALTER FUNCTION public.record_usage(text, text, text, text, integer, text)
  SECURITY DEFINER
  SET search_path = public, pg_temp;

-- Verification
SELECT proname, prosecdef
FROM pg_proc
WHERE proname IN ('librarian_startup','check_before_build','get_category_champion','record_usage')
  AND prokind = 'f'
ORDER BY proname;
-- Expected: all four `prosecdef = true`
