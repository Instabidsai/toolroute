# Lane 4.7 — Comprehensive anon-read audit (post Lane 4.6)

**Date:** 2026-04-28
**Author:** Claude (auditor lane)
**Status:** clean — no additional code fixes needed before Lane 0.1 SQL runs
**Continuation of:** Lane 4.6 (PR #20) which fixed `getInventory` + `getUsageEvents`

## Why this audit

Hard Rule #58 says: before any anon-SELECT lockdown SQL runs, grep every
`from("<gated_table>")` callsite, classify it, and confirm the post-lockdown
behavior. Lane 4.6 fixed the two callsites in `src/lib/api.ts`. This audit
extends the grep to **every** `.from(...)` call in `src/` against the full
table list the lockdown SQLs (v1 + v2) will gate.

If any callsite uses the public anon `supabase` client to read a table that
ends up REVOKE'd, the page silently empties out post-migration with no
exception, no log, no signal — same failure mode Hard Rule #58 was written
to prevent.

## Tables covered by lockdown SQLs

### v1 (`scripts/lockdown-anon-read-leaks.sql`) — server-only blanket REVOKE
- `usage_events`
- `inventory`
- `tool_requests`

### v2 (`scripts/lockdown-anon-read-leaks-v2.sql`) — Section 1 server-only blanket REVOKE
- `api_keys`
- `user_provider_keys`
- `tool_requests` (idempotent with v1)

### v2 — Sections 2-4 owner-scoped RLS (`USING ... = auth.uid()`)
- `gateway_users` (`id = auth.uid()`)
- `gateway_usage_log` (`user_id = auth.uid()`)
- `credit_transactions` (`user_id = auth.uid()`)

## Audit method

```bash
grep -rn '\.from(\(\\\\\)\"\(usage_events\|inventory\|tool_requests\|gateway_users\|gateway_usage_log\|credit_transactions\|api_keys\|user_provider_keys\)\"' src/
```

For each match, verify:

1. **Which client** (`supabase` from `@/lib/supabase` = anon browser client; `supabaseAdmin()` from `@/lib/gateway` = service-role).
2. **Where it runs** ("use client" component, server component, API route handler).
3. **Filter pattern** (does it filter by `auth.uid()` / `session.user.id`?).
4. **Post-lockdown behavior** (silent empty? 401/403? still works?).

## Audit results

| Callsite | Table | Client | Auth pattern | Post-lockdown | Status |
|----------|-------|--------|--------------|---------------|--------|
| `lib/api.ts:61` | `inventory` | anon (server cmpt) | none | silent empty | **FIXED in PR #20** |
| `lib/api.ts:68` | `usage_events` | anon (server cmpt) | none | silent empty | **FIXED in PR #20** |
| `lib/gateway.ts:69` | `api_keys` | service-role | bypasses RLS | works | OK |
| `lib/gateway.ts:175` | `credit_transactions` | service-role | bypasses RLS | works | OK |
| `lib/gateway.ts:252` | `user_provider_keys` | service-role | bypasses RLS | works | OK |
| `lib/gateway.ts:374,489,502` | `gateway_users` | service-role | bypasses RLS | works | OK |
| `lib/gateway.ts:410,415` | `gateway_usage_log` | service-role | bypasses RLS | works | OK |
| `app/dashboard/page.tsx:174` | `gateway_users` | anon (use client) | `.eq("id", session.user.id)` | matches RLS `id = auth.uid()` | OK |
| `app/dashboard/page.tsx:185,191` | `gateway_usage_log` | anon (use client) | `.eq("user_id", session.user.id)` | matches RLS `user_id = auth.uid()` | OK |
| `app/dashboard/billing/page.tsx:281` | `credit_transactions` | anon (use client) | `.eq("user_id", session.user.id)` | matches RLS `user_id = auth.uid()` | OK |
| `app/api/webhooks/stripe/route.ts:31,39,48,117,139,164,197,227,314` | `gateway_users`, `credit_transactions` | service-role | bypasses RLS | works | OK |
| `app/api/admin/stats/route.ts:63,84,109,132` | `gateway_usage_log` | service-role | bypasses RLS | works | OK |
| `app/api/v1/byok/route.ts:23,73,118` | `user_provider_keys` | service-role | bypasses RLS | works | OK |
| `app/api/v1/billing/setup-payment/route.ts:23,47` | `gateway_users` | service-role | bypasses RLS | works | OK |
| `app/api/v1/keys/route.ts:28,52,110,166,180,254,268` | `gateway_users`, `api_keys` | service-role | bypasses RLS | works | OK |
| `app/api/v1/signup/route.ts:149,172` | `gateway_users`, `api_keys` | service-role | bypasses RLS | works | OK |
| `app/api/v1/usage/route.ts:37` | `gateway_usage_log` | service-role | bypasses RLS | works | OK |
| `app/api/v1/settings/route.ts:13,157,184` | `gateway_users` | service-role | bypasses RLS | works | OK |
| `app/auth/callback/route.ts:49,63,71` | `gateway_users` | service-role | bypasses RLS | works | OK |

**No `tool_requests` reads found in `src/`.** The table is mentioned in v1+v2
SQL but is server-side ops-only — no application code reads it.

## Verifications

### `lib/supabase.ts` exports the right client for client components

```ts
import { createBrowserClient } from "@supabase/ssr";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
export const supabase = createBrowserClient(supabaseUrl, supabaseKey);
```

`createBrowserClient` from `@supabase/ssr` auto-attaches the session JWT to
PostgREST `Authorization` headers, so PostgREST evaluates `auth.uid()` from
the JWT. The owner-scoped RLS policies in v2 SQL (Sections 2-4) then match
`id = auth.uid()` / `user_id = auth.uid()` against the filter, returning the
user's own row.

### `lib/gateway.ts` factory creates a fresh service-role client each call

```ts
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
export function supabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey);
}
```

Every API route + the `gateway.ts` operations call `supabaseAdmin()` and use
that returned client for all `.from(...)` work. Service-role bypasses both
RLS and the GRANT/REVOKE layer.

## Pre-Lane 0.1 sequencing checklist

This audit confirms the code side is **ready** for the lockdown SQL. Justin's
checklist for Lane 0.1:

1. Merge PR #20 (Lane 4.6 — `lib/api-server.ts` split). **MUST merge before
   running v1 SQL** or `/discover`, `/tools`, `/tools/[slug]` will silently
   empty.
2. Vercel deploy of master containing #20 completes. Smoke-test those three
   routes — rows still rendering proves the service-role path works.
3. Run `scripts/lockdown-anon-read-leaks.sql` in Supabase SQL editor.
4. Re-run `scripts/verify-rls-lockdown.mjs` (PR #17) — should now show
   `usage_events` + `inventory` LOCKED.
5. Re-smoke `/discover`, `/tools`, `/tools/[slug]`, `/dashboard`,
   `/dashboard/billing` — all should still render data.
6. Run `scripts/lockdown-anon-read-leaks-v2.sql` in Supabase SQL editor.
7. Re-run `verify-rls-lockdown.mjs` — should show all 8 tables LOCKED.
8. Final smoke of dashboard/billing while logged in — owner rows still render.

## Tables NOT covered by this audit

The lockdown SQLs gate 8 tables. ToolRoute has many more. This audit was
**scoped to those 8** because they're the only ones the SQLs touch. A future
Lane 4.x can extend the same audit method to the rest (`tools`,
`tool_categories`, `category_beliefs`, `composites`, `skills`, etc.) — but
those are intentionally publicly readable (the catalog), so they're out of
scope for hardening.

## Cross-references

- Lane 4.6 (PR #20): `src/lib/api-server.ts` server-only split (the fix this
  audit confirms is sufficient)
- Lane 4.5 (PR #18): `lockdown-anon-read-leaks-v2.sql` (the SQL this audit
  validates code is ready for)
- Lane 4.4 (PR #17): `verify-rls-lockdown.mjs` (the post-SQL verifier)
- Hard Rule #54: Supabase showcase-page hardcoded-JWT pattern (different
  failure mode — client-side leak)
- Hard Rule #56: RLS audit empty-table blind spot (200+[] is AMBIGUOUS not
  LOCKED — what the verifier guards against)
- Hard Rule #58: Anon-client reads of sensitive tables in server components
  silently break after RLS lockdown (the rule this audit operationalizes)
