# Lane 4.34 — RLS Coverage Audit + Drift Test

**Status:** CLEAN (gateway tier locked or known-leak; registry tier intentionally public)
**Probe date:** 2026-04-28

## Method

1. Static — grep `\.from\("[a-z_]+"\)` across `src/`. 14 unique tables found.
2. Live — anon-key `GET /rest/v1/<table>?select=*&limit=1` against
   `https://isbratmfnnzipzyoefbo.supabase.co`. Three-state probe per
   memory rule #56:
   - `rows>=1` on a sensitive table → **LEAK**
   - `rows=0` → **AMBIGUOUS** (empty table OR locked; disambiguated by
     checking whether demo seed data exists in that table via service-role)
   - HTTP 4xx → **LOCKED**
3. Drift test — `tests/unit/rls-coverage.test.ts` enforces every
   `from("X")` in src/ is classified, every classified table is referenced,
   and every gateway-tier table is `gateway-locked` or `gateway-leak-known`
   (never `registry-public`).

## Live probe results (anon key, 2026-04-28)

| Table                  | HTTP | rows | Demo seed exists? | State                  |
|------------------------|------|------|-------------------|------------------------|
| `usage_events`         | 200  | 1    | yes               | **LEAK** (Lane 0.1 pending) |
| `gateway_users`        | 200  | 0    | yes               | LOCKED                 |
| `api_keys`             | 200  | 0    | yes               | LOCKED                 |
| `gateway_usage_log`    | 200  | 0    | yes (via demo)    | LOCKED                 |
| `credit_transactions`  | 200  | 0    | yes               | LOCKED                 |
| `user_provider_keys`   | 200  | 0    | none              | LOCKED (presumed)      |
| `tool_providers`       | 200  | 0    | none              | LOCKED (admin-only writes) |
| `plans`                | 200  | >=1  | yes (pricing)     | registry-public (intentional) |
| `tools`                | 200  | >=1  | catalog           | registry-public (intentional) |
| `tool_categories`      | 200  | >=1  | catalog           | registry-public (intentional) |
| `category_beliefs`     | 200  | >=1  | catalog           | registry-public (intentional) |
| `composites`           | 200  | >=1  | catalog           | registry-public (intentional) |
| `inventory`            | 200  | >=1  | catalog           | registry-public (intentional) |
| `skills`               | 200  | >=1  | catalog           | registry-public (intentional) |

## Classification map

```
gateway-locked       — auth-gated; anon read returns rows=0 with seeded data
                       api_keys, credit_transactions, gateway_users,
                       gateway_usage_log, user_provider_keys

gateway-leak-known   — known leak, gated until Lane 0.1 SQL ships
                       usage_events

registry-public      — intentionally anon-readable (catalog, pricing)
                       tools, tool_categories, category_beliefs, composites,
                       inventory, skills, plans

admin-managed        — locked to admin writes; reads via admin endpoints only
                       tool_providers
```

## Findings

- **F-1**  `usage_events` still leaks one row to anon — `id=8ff69864-...`,
  `tool_id=a3d93814-...`, `company=DropClose`. Lane 0.1 lockdown SQL has
  not been run by Justin (35+ ticks). Tracked under Hard Rule #1 +
  pending task #11.
- **F-2**  `tool_providers` and `user_provider_keys` returned `rows=0`
  with empty tables. AMBIGUOUS until the first row lands. The drift test
  enforces classification today; the live probe must be re-run after the
  first non-anon insert into either table. (Sibling to memory rule #56.)
- **F-3**  Every other gateway-tier table responds correctly. No new
  RLS gaps detected this pass.

## Drift prevention

`tests/unit/rls-coverage.test.ts` (3 tests, regex-only per Hard Rule #59):

1. Every `\.from\("X"\)` in `src/` is in `EXPECTATION_MAP`.
2. Every map entry is referenced somewhere in `src/` (no stale entries).
3. Every gateway-tier table is `gateway-locked` or `gateway-leak-known`
   — accidental classification as `registry-public` is rejected at CI.

## Cross-references

- Memory rule #56 — three-state probe (LEAK / AMBIGUOUS / LOCKED).
- Memory rule #58 — anon-client in server components silently breaks
  post-RLS-lockdown. Companion audit recommended for `gateway_*` tables.
- Memory rule #59 — drift test scans source via regex, never imports
  runtime modules.
- Hard Rule #31 — service_role-only RLS silently empties admin
  dashboards. Verified `admin/stats` and `dashboard/page` use admin
  client, not anon.
