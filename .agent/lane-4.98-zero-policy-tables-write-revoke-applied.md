# Lane 4.98 — REVOKE writes on RLS-zero-policy registry/internal tables

**Class**: Defense-in-depth (RLS default-deny was sole writeguard)
**Severity**: HIGH — single migration mistake away from a self-mint surface
**Date**: 2026-04-28T19:05Z
**Sibling**: Lane 4.16 (anon SELECT) → 4.92 (RPC EXECUTE) → 4.94 (orphaned SECDEF) → 4.95 (clean-state) → 4.96 (anon WRITE financial) → 4.97 (authenticated WRITE financial + backdoor policies) → **4.98 (zero-policy registry/internal tables)**

---

## TL;DR

Generalized audit after Lane 4.97 found 8 tables with `RLS=enabled` but **zero policies** AND wide `INSERT/UPDATE/DELETE/TRUNCATE` grants to both `anon` and `authenticated`. Default-deny via RLS was the only thing blocking writes. If a future migration disables RLS, adds a single `USING (true)` policy, or recreates a table without `ENABLE ROW LEVEL SECURITY`, the GRANT layer silently re-opens writes — same fragility class as 4.96/4.97.

Two-line fix per table: `REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.<table> FROM anon, authenticated;`

Applied via Supabase Mgmt API at 2026-04-28T19:00Z. Verified post-apply: zero anon/authenticated WRITE grants remain on the 8 tables.

## Pre-fix state (zero-policy tables)

| Table              | Policies | anon writes                   | auth writes                   |
|--------------------|----------|-------------------------------|-------------------------------|
| conversations      | 0        | DELETE,INSERT,TRUNCATE,UPDATE | DELETE,INSERT,TRUNCATE,UPDATE |
| discovery_feed     | 0        | DELETE,INSERT,TRUNCATE,UPDATE | DELETE,INSERT,TRUNCATE,UPDATE |
| inventory          | 0        | DELETE,INSERT,TRUNCATE,UPDATE | DELETE,INSERT,TRUNCATE,UPDATE |
| rate_limit_windows | 0        | DELETE,INSERT,TRUNCATE,UPDATE | DELETE,INSERT,TRUNCATE,UPDATE |
| tool_memory        | 0        | DELETE,INSERT,TRUNCATE,UPDATE | DELETE,INSERT,TRUNCATE,UPDATE |
| tool_overrides     | 0        | DELETE,INSERT,TRUNCATE,UPDATE | DELETE,INSERT,TRUNCATE,UPDATE |
| tool_providers     | 0        | DELETE,INSERT,TRUNCATE,UPDATE | DELETE,INSERT,TRUNCATE,UPDATE |
| tool_requests      | 0        | DELETE,INSERT,TRUNCATE,UPDATE | DELETE,INSERT,TRUNCATE,UPDATE |

## Caller-side audit (zero false-positive risk)

Single direct REST writer in `src/`:

| File:line | Table | Operation | Client | Gate |
|---|---|---|---|---|
| `src/app/api/admin/providers/route.ts:91` | `tool_providers` | INSERT | `supabaseAdmin()` (line 47) | `validateAdmin(request)` (line 11) |

`service_role` bypasses both GRANT and RLS — REVOKE has no impact on this path.

All other 7 tables: zero direct REST writes from `src/`. Internal writes go through SECURITY DEFINER RPCs:
- `rate_limit_windows` ← `check_rate_limit()` SECDEF
- `tool_requests` ← `log_tool_request()` SECDEF
- `tool_memory` / `tool_overrides` / `inventory` / `discovery_feed` / `conversations` — written by SECDEF maintenance/backfill RPCs running as their owner

## Post-fix behavior

```bash
# anon attempt to INSERT into tool_providers
curl -X POST "$TR_SUPA/rest/v1/tool_providers" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"slug":"forge","name":"Forge"}'
# → HTTP 401 {"code":"42501","message":"permission denied for table tool_providers"}
```

GRANT layer (42501) blocks BEFORE RLS evaluation. RLS becomes the secondary defense instead of the only defense.

## Verification

```sql
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema='public'
  AND grantee IN ('anon','authenticated')
  AND privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE')
  AND table_name IN ('conversations','discovery_feed','inventory',
                     'rate_limit_windows','tool_memory','tool_overrides',
                     'tool_providers','tool_requests');
-- → 0 rows ✓
```

Live-probed 3/8 tables with anon JWT — all returned `permission denied for table X`.

## Drift guard

`tests/unit/zero-policy-tables-write-grants-drift.test.ts` ships:
- 8 cases: per-table REVOKE coverage of INSERT/UPDATE/DELETE/TRUNCATE from anon AND authenticated
- 1 case: BEGIN/COMMIT transaction wrap
- 1 case: scope-creep guard (`ZERO_POLICY_TABLES` allowlist)

**10/10 green.**

## Out-of-scope follow-ups

- **Lane 4.99 candidate**: 8 one-policy SELECT-only registry tables — `tools`, `category_beliefs`, `tool_pricing`, `tool_categories`, `plans`, `provider_health_log`, `skills`, `composites`. These have `cmd=SELECT` policies (intentional public read) AND wide write grants. Default-deny via "no INSERT/UPDATE/DELETE policy" holds today, but they're crowd-source-writable via SECDEF RPCs (`challenge_tool`, `record_usage`) — needs deeper caller audit before REVOKE to confirm no direct REST writers exist.
- **Audit pattern check**: re-scan all `RLS=enabled, policies=0` tables monthly. New tables added without an explicit GRANT REVOKE in the same migration are caught here.

## Acceptance

- [x] All 8 zero-policy tables REVOKE INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER from anon AND authenticated
- [x] Live verification: zero anon+authenticated write grants remain on the 8 tables
- [x] Caller-side audit: only `tool_providers` has a direct REST writer (admin-gated, supabaseAdmin)
- [x] Live anon-probe of 3 tables returns 401 `permission denied for table X`
- [x] Drift guard `tests/unit/zero-policy-tables-write-grants-drift.test.ts` ships (10/10 green)
- [x] Migration script `scripts/lane-4.98-zero-policy-tables-write-revoke.sql` checked in
- [x] Idempotent — REVOKE on already-revoked grants is no-op
- [x] Sibling-lane chain documented (4.16 → 4.92 → 4.94 → 4.95 → 4.96 → 4.97 → 4.98)
