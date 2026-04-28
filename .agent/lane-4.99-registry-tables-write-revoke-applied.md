# Lane 4.99 — REVOKE writes on one-policy SELECT-only registry tables

**Class**: Defense-in-depth (RLS default-deny on writes was sole writeguard)
**Severity**: HIGH — single migration mistake away from a writable public catalog
**Date**: 2026-04-28T20:05Z
**Sibling chain**: 4.16 → 4.92 → 4.94 → 4.95 → 4.96 → 4.97 → 4.98 → **4.99 (terminal — registry write surface fully locked)**

---

## TL;DR

Last sibling in the WRITE-grant audit chain. Lane 4.98 closed zero-policy tables; this one closes the symmetric class — tables with **one** SELECT-only policy AND wide write grants. 8 registry/billing tables had `RLS=on` with a public-read policy and wide `INSERT/UPDATE/DELETE/TRUNCATE` grants for both `anon` and `authenticated`. RLS default-deny on writes (no INSERT/UPDATE/DELETE policy) was the only thing blocking them.

**Critical constraint vs Lane 4.98**: SELECT must remain granted. These tables back the public catalog (`/tools`, `/discover`, `/tools/[slug]`, `/categories`, `/skills`) via `src/lib/api.ts` which uses the browser-anon Supabase client. REVOKING SELECT would silently empty those pages (PostgREST returns `[]` not an error — Memory rule #58).

Migration REVOKEs only `INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER`. SELECT untouched. Applied via Supabase Mgmt API at 2026-04-28T20:05Z.

## Pre-fix state

| Table               | Policies                   | anon writes                   | auth writes                   |
|---------------------|----------------------------|-------------------------------|-------------------------------|
| category_beliefs    | beliefs_public_read:S      | DELETE,INSERT,TRUNCATE,UPDATE | DELETE,INSERT,TRUNCATE,UPDATE |
| composites          | composites_public_read:S   | DELETE,INSERT,TRUNCATE,UPDATE | DELETE,INSERT,TRUNCATE,UPDATE |
| plans               | plans_public_read:S        | DELETE,INSERT,TRUNCATE,UPDATE | DELETE,INSERT,TRUNCATE,UPDATE |
| provider_health_log | health_public_read:S       | DELETE,INSERT,TRUNCATE,UPDATE | DELETE,INSERT,TRUNCATE,UPDATE |
| skills              | anon_read:S                | DELETE,INSERT,TRUNCATE,UPDATE | DELETE,INSERT,TRUNCATE,UPDATE |
| tool_categories     | categories_public_read:S   | DELETE,INSERT,TRUNCATE,UPDATE | DELETE,INSERT,TRUNCATE,UPDATE |
| tool_pricing        | pricing_public_read:S      | DELETE,INSERT,TRUNCATE,UPDATE | DELETE,INSERT,TRUNCATE,UPDATE |
| tools               | tools_public_read:S        | DELETE,INSERT,TRUNCATE,UPDATE | DELETE,INSERT,TRUNCATE,UPDATE |

## Caller-side audit (zero false-positive risk)

13 direct `.from(<table>)` call sites across `src/`, **all `.select(...)` reads** — zero direct REST writes:

| File:line | Table | Op | Client |
|---|---|---|---|
| `src/lib/api.ts:13,22,101` | `tools` | SELECT | anon (browser, public catalog) |
| `src/lib/api.ts:32` | `tool_categories` | SELECT | anon |
| `src/lib/api.ts:42,124` | `category_beliefs` | SELECT | anon |
| `src/lib/api.ts:51` | `composites` | SELECT | anon |
| `src/lib/api.ts:111` | `skills` | SELECT | anon |
| `src/lib/gateway.ts:498` | `plans` | SELECT | admin (plan id lookup) |
| `src/lib/adapters/toolroute-adapter.ts:75` | `tools` | SELECT | anon (slug exists check) |
| `src/app/api/webhooks/stripe/route.ts:157,328` | `plans` | SELECT | admin (plan id lookup) |
| `src/app/api/v1/tools/route.ts:128` | `tools` | SELECT | admin/anon fallback |

**Internal write paths (intentional, NOT direct REST)**:
- `tools`, `category_beliefs`, `tool_pricing` ← `challenge_tool()` SECDEF RPC
- `tools` (rating/usage_count) ← `record_usage()` SECDEF RPC
- `composites`, `skills`, `tool_categories` ← admin-only seed/maintenance via service_role
- `plans` ← admin-only seed (3 rows: free/scale/team) via service_role
- `provider_health_log` ← background health-check cron via service_role

All SECDEF RPCs run as their owner regardless of caller GRANT; service_role bypasses both GRANT and RLS. REVOKE has zero impact on legitimate write paths.

## Live verification

```sql
SELECT grantee, table_name, string_agg(privilege_type, ',' ORDER BY privilege_type) AS privs
FROM information_schema.role_table_grants
WHERE table_schema='public' AND grantee IN ('anon','authenticated')
  AND table_name IN ('tools','category_beliefs','tool_pricing','tool_categories',
                     'plans','provider_health_log','skills','composites')
GROUP BY grantee, table_name ORDER BY table_name, grantee;
-- → 16 rows, all show privs="SELECT" ✓
```

Live probes (anon JWT):
- `GET /rest/v1/tools?select=slug&limit=2` → **HTTP 200**, `[{"slug":"context7"},{"slug":"creatomate"}]` (catalog reads work)
- `POST /rest/v1/tools` → **HTTP 401**, `42501 permission denied for table tools` ✓
- `POST /rest/v1/skills` → **HTTP 401**, `42501 permission denied for table skills` ✓

## Drift guard

`tests/unit/registry-tables-write-grants-drift.test.ts` ships:
- 8 cases: per-table REVOKE coverage of INSERT/UPDATE/DELETE/TRUNCATE from anon AND authenticated
- 8 cases (folded into per-table): asserts SELECT is NOT in the revoked list
- 1 case: BEGIN/COMMIT transaction wrap
- 1 case: scope-creep allowlist guard (`REGISTRY_TABLES`)
- 1 case: global SELECT-protection (no REVOKE clause anywhere may include SELECT)

**11/11 green.**

## Why this is the terminal sibling

Post-4.99, every write grant on the gateway DB is one of:
1. `service_role` / `postgres` (legitimate admin path, bypasses everything)
2. SECDEF RPC owner-internal (run-as-owner, no caller GRANT involvement)

There are no remaining tables where `anon` or `authenticated` has a direct WRITE grant. The two-line audit query (zero anon/authenticated writes on financial tables, zero on registry tables) is now a flat invariant the test suite enforces.

## Out-of-scope follow-ups

- Periodic re-scan: `pg_policies WHERE cmd IN ('INSERT','UPDATE','DELETE')` should return `[]` for `roles @> ARRAY['anon','authenticated','public']::name[]` indefinitely. Add to quarterly audit checklist.
- New-table policy: any future migration adding a table needs an explicit GRANT REVOKE in the same script (or a default-revoke on `CREATE TABLE` via per-schema role grant override). Captured in CLAUDE.md Hard Rule #1 family.

## Acceptance

- [x] All 8 one-policy SELECT-only registry tables REVOKE INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER from anon AND authenticated
- [x] SELECT grants preserved (16 rows: 8 tables × 2 grantees)
- [x] Live verification: 0 rows for anon/authenticated WRITE grants on these tables
- [x] Live read-probe of `tools` returns HTTP 200 + data (public catalog still works)
- [x] Live write-probe of 2 spot-checked tables returns 42501 `permission denied`
- [x] Caller-side audit: all 13 src/ call sites are SELECT, zero direct REST writes
- [x] Drift guard `tests/unit/registry-tables-write-grants-drift.test.ts` ships (11/11 green)
- [x] Migration script `scripts/lane-4.99-registry-tables-write-revoke.sql` checked in
- [x] Idempotent — REVOKE on already-revoked grants is no-op
- [x] Sibling-lane chain documented (4.16 → 4.92 → 4.94 → 4.95 → 4.96 → 4.97 → 4.98 → 4.99)
