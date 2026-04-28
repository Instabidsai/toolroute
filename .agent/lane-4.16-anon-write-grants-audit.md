# Lane 4.16 — anon WRITE grants audit + defense-in-depth REVOKE

**Status:** P1 (RLS currently absorbs the risk; this is belt-and-suspenders)
**Date:** 2026-04-28
**Auditor:** Claude (auto-loop, tick 52)
**Sibling lanes:** 4.5 (read-revoke v2), 4.14 (RPC EXECUTE lockdown), 4.15 (RPC drift test)

## TL;DR

Anon role has `INSERT/UPDATE/DELETE` GRANT on all 7 financial-gateway tables.
RLS policies are currently absorbing the attack — INSERT throws `42501` and
UPDATE/DELETE silent-filter to 0 rows. But the GRANT layer is wide open, and
Hard Rule #45 ("RLS without UPDATE policy silently no-ops PostgREST PATCH")
means a single missed `WITH CHECK` clause turns this into a mass-mutation
exploit.

Two table-level SELECT gaps were also missed by Lane 4.5 v2:

- **`tool_providers`** — admin-only master pool keys table. Anon currently
  gets `200 + []` (AMBIGUOUS per Hard Rule #56). Empty today; first row
  inserted leaks.
- **`rate_limit_windows`** — gateway-internal rate-limit telemetry. Same
  state. Lower severity but no legitimate anon read.

Both should be in the v2 read-lockdown.

## Probe results (anon JWT, public Supabase REST)

### INSERT — RLS-blocked (CLEAN at RLS layer; GRANT layer still open)

```
POST /rest/v1/credit_transactions  → 401 / 42501  (RLS violation)
POST /rest/v1/gateway_users        → 401 / 42501
POST /rest/v1/api_keys             → 401 / 42501
POST /rest/v1/user_provider_keys   → 401 / 42501
POST /rest/v1/tool_providers       → 401 / 42501
POST /rest/v1/gateway_usage_log    → 401 / 42501
POST /rest/v1/rate_limit_windows   → 401 / 42501
```

All 7 tables correctly throw `42501 row-level security policy violation` on
anon INSERT. Good — the RLS `WITH CHECK` clauses are tight.

### UPDATE — anon GRANT present, RLS silent-filtering (AMBIGUOUS, per rule #45)

```
PATCH /rest/v1/gateway_users?id=not.is.null  return=representation,count=exact
  → HTTP 200
  → Content-Range: */0
  → []
```

The `200` (not `403`) means anon has the UPDATE GRANT. The empty body and
`*/0` count mean RLS filtered the row from the update set. Same shape on
all 7 tables.

This is the exact pattern Hard Rule #45 was written to flag — a future
schema change that drops or weakens the RLS USING clause silently turns
into a mass-mutation primitive with no error visible at the
application layer.

### DELETE — same shape as UPDATE

```
DELETE /rest/v1/credit_transactions?id=eq.<fake-uuid>  → 204 (0 rows affected)
```

All 7 tables: anon has DELETE GRANT, RLS USING clause filters. Same risk
shape as UPDATE.

### SELECT — 200/[] AMBIGUOUS (rule #56)

```
GET /rest/v1/tool_providers       → 200 BYTES=2  []   ← admin-only, NO anon read should exist
GET /rest/v1/rate_limit_windows   → 200 BYTES=2  []   ← gateway-internal
GET /rest/v1/gateway_usage_log    → 200 BYTES=2  []   ← Lane 4.5 v2 RLS owner-scoped (OK if policy correct)
GET /rest/v1/credit_transactions  → 200 BYTES=2  []   ← Lane 4.5 v2 RLS owner-scoped (OK if policy correct)
GET /rest/v1/gateway_users        → 200 BYTES=2  []   ← Lane 4.5 v2 RLS owner-scoped (OK if policy correct)
GET /rest/v1/api_keys             → 200 BYTES=2  []   ← Lane 4.5 v2 REVOKE'd on apply
GET /rest/v1/user_provider_keys   → 200 BYTES=2  []   ← Lane 4.5 v2 REVOKE'd on apply
```

The bottom 5 are covered by Lane 4.5 v2 (Justin still hasn't run that SQL —
Lane 0.1 unblocked). The top 2 (`tool_providers`, `rate_limit_windows`) are
NOT covered by Lane 4.5 v2 and need to be added.

## Why all write paths can absorb a REVOKE

Audited every Supabase-writing route in src/:

| File | Writes via |
|------|-----------|
| `src/lib/gateway.ts` | `supabaseAdmin()` (service-role) |
| `src/app/api/admin/providers/route.ts` | `supabaseAdmin()` |
| `src/app/api/webhooks/stripe/route.ts` | `supabaseAdmin()` |
| `src/app/api/v1/keys/route.ts` | `supabaseAdmin()` |
| `src/app/auth/callback/route.ts` | `supabaseAdmin()` |
| `src/app/api/v1/settings/route.ts` | `supabaseAdmin()` |
| `src/app/api/v1/signup/route.ts` | `supabaseAdmin()` |
| `src/app/api/v1/billing/setup-payment/route.ts` | `supabaseAdmin()` |
| `src/app/api/v1/byok/route.ts` | `supabaseAdmin()` |

**Zero anon-client INSERT/UPDATE/DELETE paths exist.** Every write goes
through service-role, which is unaffected by an anon-role REVOKE. So
defense-in-depth REVOKE on anon is safe to ship.

## Proposed migration

`scripts/lockdown-anon-writes-and-admin-tables.sql` (in this PR) does:

1. **REVOKE SELECT** on `tool_providers` and `rate_limit_windows` from anon
   and authenticated. (Gap-fill for Lane 4.5 v2.) These tables have no
   customer-facing read path.

2. **REVOKE INSERT, UPDATE, DELETE** on all 7 financial-gateway tables
   from anon and authenticated. Service-role keeps all permissions.

3. Idempotent (`DO $$` blocks check `information_schema.tables` first).

After this lands plus Lane 0.1 + Lane 4.5 v2 + Lane 4.14 SQL, the gateway
table surface looks like:

| Table | anon SELECT | anon INSERT | anon UPDATE | anon DELETE |
|-------|-------------|-------------|-------------|-------------|
| credit_transactions | RLS owner-scoped | REVOKED | REVOKED | REVOKED |
| gateway_users | RLS owner-scoped | REVOKED | REVOKED | REVOKED |
| api_keys | REVOKED | REVOKED | REVOKED | REVOKED |
| user_provider_keys | REVOKED | REVOKED | REVOKED | REVOKED |
| tool_providers | REVOKED (this PR) | REVOKED | REVOKED | REVOKED |
| rate_limit_windows | REVOKED (this PR) | REVOKED | REVOKED | REVOKED |
| gateway_usage_log | RLS owner-scoped | REVOKED | REVOKED | REVOKED |

## Verification probes (post-fix, all MUST 401/403)

```bash
# Each MUST return 401 or 403 (PostgREST permission_denied), NOT 200/[] or 204.
curl -X PATCH ".../gateway_users?id=not.is.null" -d '{"email":"x"}'
curl -X DELETE ".../credit_transactions?id=eq.0..."
curl -X POST ".../tool_providers" -d '{"tool_slug":"x"}'
curl ".../tool_providers?select=*&limit=1"
curl ".../rate_limit_windows?select=*&limit=1"
```

## Drift prevention (Lane 4.17 follow-up, optional)

A regression vitest could probe each gateway table with the public anon JWT
and assert non-200 on writes + 403 on reads of admin-only tables. Sits
beside `gateway-rpc-grants-drift.test.ts`. Same shape: lock the door, then
a CI guard ensures it stays locked.

Or skip the static test and add probes to `scripts/verify-rls-lockdown.mjs`
(Lane 4.4) to cover writes — that script is already plumbed through CI per
Codex Lane 4.8 ticket.

## Sibling rules

- Hard Rule #45 — RLS-without-UPDATE-policy silent no-op pattern
- Hard Rule #56 — anon-read 200+[] AMBIGUOUS, not LOCKED
- Hard Rule #58 — anon-client server-component reads must use service-role
- Lane 4.5 v2 — read-side lockdown (5 of 7 tables; this PR adds the missing 2)
- Lane 4.14 — RPC EXECUTE lockdown (function-level; this PR is table-level)
- Lane 4.15 — drift-prevention vitest for RPC EXECUTE grants

## Generalizable lesson

**INSERT-blocked by RLS is not the same as INSERT-blocked at GRANT.** A
correct INSERT-side `WITH CHECK` clause will throw 42501 today, but if a
later PR weakens the policy (e.g. adds an `OR true` for an admin path
that gets fat-fingered), anon INSERT becomes available with no GRANT
layer to backstop it. Same shape for UPDATE/DELETE silent-filter.

Audit pattern for any gateway/financial product:

```sql
-- Find tables where anon has any write privilege
SELECT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'PUBLIC')
  AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
ORDER BY table_name;
```

For any row where a financial/gateway table appears in the result, REVOKE
that privilege unless there's a demonstrable customer-facing write path
that would break. Cross-applies to JarvisCRM, DropClose, GTM-Hub,
AffixedAI, any future agent-routing/aggregator build.
