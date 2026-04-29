# Lane 4.78 — Anon-callable RPC ↔ post-lockdown table audit

> Run quarterly. Closes the audit gap that produced Lane 4.77 (production
> /discover ISR break after Lane 0.1 lockdown).

## Trigger

Lane 4.77 hotfix landed 4 RPCs into SECURITY DEFINER after `/discover`
prerender 500'd in production with `42501: permission denied for table
inventory`. Root cause: anon-context Server Component called
`librarian_startup` which internally `COUNT(*) FROM inventory` — and
`inventory` had just lost anon SELECT. Without `SECURITY DEFINER` the
function ran as the caller (anon).

This memo extends the audit to **every** anon-callable RPC, not just the
4 that broke loudest, and documents the steady-state invariant.

## Locked tables (Lane 0.1)

Anon has NO `SELECT` on these (verified 2026-04-28 via `information_schema`
+ live probe):

- `inventory`
- `usage_events`
- `api_keys`
- `user_provider_keys`

Anon retains some write grants on these (separate Lane 4.16 audit
surface — REVOKE not yet applied as defense-in-depth) but no read.

## Anon-callable RPCs in src/ (8)

| RPC | Caller(s) | Reads locked? | DEFINER? | Status |
|-----|-----------|---------------|----------|--------|
| `librarian_startup` | `src/lib/api.ts:80` (Server Component) | YES (`inventory`, `usage_events`) | ✅ (Lane 4.77) | LOCKED |
| `check_before_build` | `src/lib/api.ts:63`, `src/lib/adapters/auto-adapter.ts:1081`, `src/lib/adapters/toolroute-adapter.ts:32` | YES (`inventory`) | ✅ (Lane 4.77) | LOCKED |
| `get_category_champion` | `src/lib/api.ts:89` (Server Component) | YES (`inventory`) | ✅ (Lane 4.77) | LOCKED |
| `record_usage` | `src/app/api/v1/registry/usage/route.ts:38` | WRITES `usage_events` | ✅ (Lane 4.77) | LOCKED |
| `search_tools_text` | `src/lib/api.ts:71`, `src/lib/adapters/toolroute-adapter.ts:51` | NO (only `tools` — anon SELECT allowed) | ❌ | SAFE — no DEFINER needed |
| `challenge_tool` | `src/app/api/v1/registry/challenge/route.ts:58` | NO (only `tools`, `category_beliefs` — both anon-allowed) | ❌ | SAFE — no DEFINER needed |
| `log_tool_request` | `src/app/api/v1/registry/request/route.ts:32` | NO (writes `tool_requests` — anon INSERT allowed) | ❌ | SAFE — no DEFINER needed |
| `get_tool_catalog` | `src/app/api/v1/tools/route.ts:124` | NO (only `tools`) | ✅ | LOCKED (already DEFINER) |

## Steady-state invariant

> Any anon-callable public RPC that reads OR writes a table where anon
> lacks the corresponding grant MUST be `SECURITY DEFINER` with locked
> `search_path`. New RPCs added without this property silently break
> anon callers post-lockdown.

## Verification query (run quarterly)

```sql
-- Expected: all 4 below are prosecdef = true.
SELECT proname, prosecdef
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
  AND proname IN (
    'librarian_startup',
    'check_before_build',
    'get_category_champion',
    'record_usage',
    'get_tool_catalog'
  )
ORDER BY proname;
```

If any of the above five flips back to `prosecdef = false` (e.g. a CREATE
OR REPLACE in a migration), `/discover`, `/tools`, the MCP server, and
the registry usage endpoint all 500 silently for anon callers.

## Related

- Lane 0.1 — anon-read lockdown SQL (the trigger)
- Lane 4.14, 4.15 — gateway-internal RPC EXECUTE lockdown + drift test
- Lane 4.77 — production hotfix that prompted this audit
- [Hard Rule #58](../../.claude-jarvis/projects/C--Users-Not-John-Or-Justin/memory/feedback_anon_client_in_server_components_pre_lockdown_audit.md) — anon-client reads of locked tables silently break in Server Components (extended to RPCs by this lane)
