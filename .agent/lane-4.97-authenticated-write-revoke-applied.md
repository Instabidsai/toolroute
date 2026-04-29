# Lane 4.97 — authenticated WRITE REVOKE + backdoor-policy DROP

**Class**: P0 self-mint surface (logged-in user attack)
**Severity**: CRITICAL — exploitable today by any signed-up user
**Date**: 2026-04-28T18:15Z
**Sibling**: Lane 4.96 (anon WRITE REVOKE — same threat class for unauth attacker), Lane 4.16 (anon SELECT REVOKE), Lane 4.92 (RPC EXECUTE), Lane 4.94 (orphaned SECDEF)

---

## TL;DR

While auditing post-Lane-4.96, found that the `authenticated` role has full WRITE grants on the same 6 financial tables AND there are 7 PUBLIC-role RLS policies (`users_own_update`, `keys_own_insert`, etc.) whose `USING/WITH CHECK` clauses only check `auth.uid() = user_id`. Combination = a logged-in user can directly mutate their own rows via PostgREST, completely bypassing server-side gates.

**Concrete attack — credit mint:**
```
PATCH /rest/v1/gateway_users?id=eq.<my-uid>
Authorization: Bearer <my-supabase-jwt>
Content-Type: application/json
Prefer: return=representation

{"credit_balance": 999999, "plan_slug": "scale"}
```
Pre-fix: RLS policy `users_own_update USING (auth.uid() = id)` matches → 200 OK → balance set to $9999.99. Bypasses the SECURITY DEFINER `add_credits` RPC and its Lane 4.93 input-validation entirely.

**Concrete attack — premium key mint:**
```
POST /rest/v1/api_keys
Authorization: Bearer <my-supabase-jwt>
Content-Type: application/json

{"user_id":"<my-uid>", "key_prefix":"tr_live_", "key_hash":"...", "name":"forged"}
```
Pre-fix: RLS policy `keys_own_insert WITH CHECK (user_id = auth.uid())` matches → 201 Created → user has a `tr_live_` premium key without paying. Bypasses Lane 4.3's paid-plan gate enforced server-side in `/api/v1/keys`.

Applied via Supabase Mgmt API at 2026-04-28T18:15Z. Two-layer fix:

1. **REVOKE INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER from authenticated** on all 6 financial tables (GRANT layer)
2. **DROP 7 backdoor PUBLIC-role policies** (RLS layer)

Both layers because either alone is fragile: GRANT-only leaves a backdoor that re-activates if a future engineer adds a new role to PUBLIC; policy-only leaves the door open if a future role-grant change re-extends authenticated.

## Root cause — why was this latent until Lane 4.97?

Lane 4.16 closed anon SELECT but left writes alone; the audit memo focused on read-side leak class.
Lane 4.92 closed RPC EXECUTE; the audit was scoped to RPCs, not direct table writes.
Lane 4.96 closed anon WRITE; the memo explicitly punted authenticated WRITE to a follow-up.

Net: the authenticated mint surface had been visible in `pg_policies` since the schema was first created (legacy "owner can edit own row" pattern from a pre-credit-system version of the app). The audit chain caught it at the next layer.

Generalizable rule, captured for the audit chain:

> Every "owner-scoped self-modification" RLS policy on a financial/billable
> table is a mint surface unless the table holds zero financial fields. The
> audit must enumerate `pg_policies WHERE cmd IN ('INSERT','UPDATE','DELETE')`
> and treat each row as a potential bypass of server-side gate logic.

## Caller-side audit (zero false-positive risk)

Same as Lane 4.96. All 7 write sites against the 6 financial tables use `supabaseAdmin()` (service_role). authenticated REVOKE has no impact on legitimate writes.

| File:line | Table | Operation | Client |
|---|---|---|---|
| `src/lib/gateway.ts:503` | `gateway_users` | INSERT | `admin` (supabaseAdmin) |
| `src/app/auth/callback/route.ts:62` | `gateway_users` | UPDATE | `admin` (supabaseAdmin) |
| `src/app/auth/callback/route.ts:72` | `gateway_users` | INSERT | `admin` (supabaseAdmin) |
| `src/app/api/v1/signup/route.ts:157` | `gateway_users` | INSERT | `sb` (supabaseAdmin) |
| `src/app/api/v1/signup/route.ts:180` | `api_keys` | INSERT | `sb` (supabaseAdmin) |
| `src/app/api/webhooks/stripe/route.ts:48` | `credit_transactions` | INSERT | `sb` (supabaseAdmin via param type) |
| `src/app/api/webhooks/stripe/route.ts:139` | `gateway_users` | UPDATE | `sb` (supabaseAdmin) |
| `src/app/api/webhooks/stripe/route.ts:164` | `gateway_users` | UPDATE | `sb` (supabaseAdmin) |

Other writes go through SECURITY DEFINER RPCs (`add_credits`, `deduct_credits`, `log_gateway_request`) which run as their owner regardless of caller role.

## Backdoor policies dropped

| Policy | Table | Cmd | USING / WITH CHECK |
|---|---|---|---|
| `users_insert` | `gateway_users` | INSERT | WITH CHECK (auth.uid() = id) |
| `users_own_update` | `gateway_users` | UPDATE | USING (auth.uid() = id) |
| `keys_own_insert` | `api_keys` | INSERT | WITH CHECK (user_id = auth.uid()) |
| `keys_own_update` | `api_keys` | UPDATE | USING (user_id = auth.uid()) |
| `byok_own_insert` | `user_provider_keys` | INSERT | WITH CHECK (user_id = auth.uid()) |
| `byok_own_update` | `user_provider_keys` | UPDATE | USING (user_id = auth.uid()) |
| `byok_own_delete` | `user_provider_keys` | DELETE | USING (user_id = auth.uid()) |

Remaining policies (intentional, NOT dropped):
- `gateway_users_owner_read` — SELECT, authenticated, owner-scope dashboard read
- `credit_transactions_owner_read` — SELECT, authenticated, owner-scope ledger read
- `gateway_usage_log_owner_read` — SELECT, authenticated, owner-scope billing read

## Verification

```sql
-- Post-fix: zero authenticated WRITE grants on the 6 financial tables.
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema='public'
  AND grantee='authenticated'
  AND privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE')
  AND table_name IN ('api_keys','credit_transactions','gateway_usage_log',
                     'gateway_users','usage_events','user_provider_keys');
-- → 0 rows ✓

-- Post-fix: zero backdoor policies remain.
SELECT tablename, policyname FROM pg_policies WHERE schemaname='public'
  AND policyname IN ('users_insert','users_own_update','keys_own_insert',
                     'keys_own_update','byok_own_insert','byok_own_update',
                     'byok_own_delete');
-- → 0 rows ✓
```

Both queries returned `[]` post-apply. Two-layer lockdown confirmed.

## Drift guard

`tests/unit/authenticated-write-grants-drift.test.ts` ships:
- 6 cases: per-table REVOKE coverage of INSERT/UPDATE/DELETE/TRUNCATE
- 7 cases: per-policy DROP POLICY IF EXISTS clause presence
- 1 case: BEGIN/COMMIT transaction wrap
- 1 case: REVOKE scope-creep guard (FINANCIAL_TABLES allowlist)
- 1 case: DROP scope-creep guard (BACKDOOR_POLICIES allowlist)

**16/16 green.**

## Out-of-scope follow-ups

- **Lane 4.98 candidate**: 8 RLS-enabled-zero-policy tables (`conversations`, `discovery_feed`, `inventory`, `rate_limit_windows`, `tool_memory`, `tool_overrides`, `tool_providers`, `tool_requests`) — REVOKE writes from anon + authenticated as defense-in-depth. Default-deny holds today but same fragility class as 4.96/4.97.
- **Registry tables** (`tools`, `category_beliefs`, `tool_pricing`, `tool_runs`) intentionally allow some authenticated writes for crowd-sourced challenge/usage flows — NOT in scope.
- **Audit pattern check**: re-scan all `cmd IN ('INSERT','UPDATE','DELETE')` policies across the schema. If any other table has owner-scope-write policies pointing at billable fields, repeat 4.97 there.

## Acceptance

- [x] All 6 financial tables REVOKE INSERT/UPDATE/DELETE/TRUNCATE from authenticated
- [x] All 7 backdoor policies DROP POLICY IF EXISTS'd
- [x] Live verification: zero authenticated write grants + zero backdoor policies remain in prod
- [x] All 7 write sites in src/ confirmed using `supabaseAdmin()` (service_role)
- [x] Drift guard `tests/unit/authenticated-write-grants-drift.test.ts` ships (16/16 green)
- [x] Migration script `scripts/lane-4.97-authenticated-write-revoke.sql` checked in
- [x] Idempotent — REVOKE on already-revoked + DROP POLICY IF EXISTS are no-op
- [x] Sibling-lane chain documented (4.16 → 4.92 → 4.94 → 4.95 → 4.96 → 4.97)
