# Lane 4.6 — Server-Only Sensitive Table Reads

**Status**: Built (PR pending)
**Date**: 2026-04-27
**Owner**: Claude
**Depends on**: Nothing (must merge BEFORE PR #14 + #18 lockdown SQL runs, or simultaneously)

## Finding

`src/lib/api.ts` exported two functions reading sensitive tables via the public **anon** Supabase client:

- `getInventory()` — `SELECT * FROM inventory` (no filter)
- `getUsageEvents(limit)` — `SELECT * FROM usage_events ORDER BY created_at DESC LIMIT N`

Both tables are scheduled for anon-SELECT lockdown:
- `inventory` is in PR #18's blanket-REVOKE section (server-only)
- `usage_events` is in PR #14's lockdown.sql (already designed)

After Justin runs Lane 0.1 SQL, the anon client returns `[]` (or 401) for these tables — the 3 server-rendered pages that call them silently show zero data.

### Affected pages (all server components)

- `src/app/discover/page.tsx` — calls `getUsageEvents(20)` for activity dashboard
- `src/app/tools/page.tsx` — calls `getInventory()` for tool catalog (`installed_location` per tool)
- `src/app/tools/[slug]/page.tsx` — calls `getInventory()` for per-tool detail page

## Fix

Created `src/lib/api-server.ts`:

```ts
import "server-only";
import { supabaseAdmin } from "./supabase-server";

export async function getInventory(): Promise<InventoryItem[]> { /* uses supabaseAdmin */ }
export async function getUsageEvents(limit = 50): Promise<UsageEvent[]> { /* uses supabaseAdmin */ }
```

Removed those two functions from `src/lib/api.ts`. Updated 3 callers to import from `api-server`. The `import "server-only"` enforces server-only usage at build time — any future client component import fails with a clear error.

## Why this matters

Without this fix, a successful Lane 4.5 deployment **silently breaks** 3 customer-facing pages. The lockdown SQL succeeds, the build succeeds, deployment succeeds — but `/discover` and `/tools` show stale or empty data and nobody gets paged. This is the same class as Hard Rule #54 (`Supabase showcase-page hardcoded-JWT pattern`) and Hard Rule #56 (`RLS audit empty-table blind spot`).

## Verification before merge

1. `npx tsc --noEmit` clean
2. `npm run build` succeeds
3. Manual: hit `/discover`, `/tools`, `/tools/[any-slug]` in Vercel preview → confirm rows render
4. After Lane 0.1 SQL runs in prod: re-hit those 3 routes, confirm rows still render (proves service-role path works)

## Sequencing rule

Per Hard Rule #57 (pre-launch copy audit), tiered-access gates need ordered deploys. Same applies here:

1. **Merge this PR FIRST** (or simultaneously with Lane 4.5)
2. **Then run lockdown SQL** (Lane 0.1)
3. **Then deploy** to Vercel

Reverse order silently breaks 3 pages between SQL run and deploy.

## Other anon-client reads of sensitive tables

Also audited `src/app/api/**` and `src/app/dashboard/**`:

- All `src/app/api/**` routes use `supabaseAdmin` (service role) ✅
- `src/app/dashboard/page.tsx` (client) reads `gateway_users` + `gateway_usage_log` filtered by `session.user.id` — relies on PR #18 v2 owner-scoped RLS ✅
- `src/app/dashboard/billing/page.tsx` (client) reads `credit_transactions` filtered by `session.user.id` — relies on PR #18 v2 owner-scoped RLS ✅

No other server components read sensitive tables via the anon client.
