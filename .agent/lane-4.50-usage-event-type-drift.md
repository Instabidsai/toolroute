# Lane 4.50 — UsageEvent TS type drift fix

## Bug

`UsageEvent` in `src/lib/types.ts` declared `tool_slug: string`. The live
`usage_events` table has no such column — the actual FK is
`tool_id uuid` referencing `tools.id`. Confirmed via anon probe:

```json
{"id":"...","tool_id":"a3d93814-f633-4400-b7ae-ae6a9f438afa",
 "company":"DropClose","action":"product_demo_video","outcome":"success",
 "duration_ms":45000,"created_at":"2026-03-27T..."}
```

Every consumer of `UsageEvent` was reading `e.tool_slug` → `undefined` at
runtime. TypeScript was happy because the type declared the field; the
DB silently delivered nothing.

## Surfaced by

Lane 4.49 (`.select("*")` audit). When tightening
`getUsageEvents()` to project explicit columns,
`npm run build` failed with:

```
Error: column usage_events.tool_slug does not exist (42703)
```

The `.select("*")` was masking the type/schema mismatch — every row had
`tool_id` populated and an `undefined` for the non-existent `tool_slug`,
so TS reads compiled but rendered empty values.

## Live impact

`/discover` page renders 10 most-recent usage events. The lookup
`toolMap.get(e.tool_slug)` always returned `undefined` (toolMap was keyed
by `slug`, but `e.tool_slug` was `undefined`), and the fallback
`tool?.name || e.tool_slug` rendered an empty cell. Every row showed a
blank tool name. Page has been visibly broken since `usage_events` first
populated.

## Fix

1. `src/lib/types.ts` — rename `tool_slug` → `tool_id` to match the DB.
2. `src/app/discover/page.tsx` — re-key `toolMap` by `tool.id`, look up
   `e.tool_id`, replace fallback string with `"Unknown tool"` (a UUID is
   not a useful display value).

Two-file change. No DB migration. No new dependencies.

## Why no drift guard

Schema↔type sync is owned by `supabase gen types`. Lane 4.51 (queued)
should consider regenerating types from the live DB and committing the
result, which would catch this class of drift across all tables in one
shot. Adding a one-off vitest for `usage_events` only would be a
band-aid.

## Currently exploitable?

No — this is a render bug, not a security bug. Documented under Lane 4
(RLS hardening) only because it surfaced during the 4.49 audit.
