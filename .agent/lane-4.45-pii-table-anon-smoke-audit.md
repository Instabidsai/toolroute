# Lane 4.45 — PII table anon-read smoke test

## Class
Live-fetch regression guard against the AMBIGUOUS-vs-LOCKED gap (Hard Rule #56). Complements static drift tests (Lane 4.4 / 4.5 / 4.34 — all currently unmerged in PRs #17, #18, #49).

## Surface
4 PII-bearing tables read by client components or admin routes:

| Table | PII fields | Read by |
|-------|-----------|---------|
| `gateway_users` | email, plan_slug, credit_balance, metadata | client `/dashboard`, server `/auth/callback`, admin `/api/admin/stats` |
| `api_keys` | key hashes, key prefixes, names | client `/dashboard`, server `/api/v1/keys` |
| `credit_transactions` | Stripe payment_intent IDs, charge amounts | client `/dashboard/billing`, server stripe webhook |
| `gateway_usage_log` | error_message (carries provider key fragments per Lane 4.17 tail-risk), tool_slug, COGS | client `/dashboard`, server gateway exec path |

## Threat model
Per Hard Rule #56, an anon `200 + []` is not proof of lockdown — could be:
- (a) Owner-scoped RLS denies bare anon (good)
- (b) Anon SELECT not granted (good)
- (c) Empty table (BAD — first row inserted leaks publicly)

`gateway_users`, `api_keys`, and `credit_transactions` all have rows (Justin signed up; demo key `tr_live_*` provisioned at task #3; e2e test at task #4 generated transactions). Their consistent `[]` response under bare anon JWT is therefore evidence of (a) or (b), not (c).

This test smoke-checks the live Supabase via fetch and fails on transition into LEAK state.

## Drift guard
`tests/unit/pii-table-anon-smoke.test.ts` — 4 assertions, one per table. Each fetches `${SUPABASE_URL}/rest/v1/<table>?select=id&limit=1` with the bare anon JWT and asserts `[]`.

Skip via `PII_ANON_SMOKE_SKIP=1` for offline CI runs (test hits live Supabase). Default ON in interactive vitest.

## Why this is independent of pending PRs
PRs #17 (Lane 4.4 RLS guard script), #18 (Lane 4.5 anon-read lockdown SQL), #20 (Lane 4.6 server-only sensitive reads) all unmerged. This test ships standalone — no dependency on those branches. Catches regressions even if those PRs land later (each fix narrows the surface; this test verifies the narrowing held).

## Sibling rules
- Hard Rule #56 — anon-read `200+[]` ambiguous, three-state probe
- Hard Rule #58 — anon-client in server components silently breaks after RLS lockdown
- Hard Rule #59 — failing-snapshot test as drift TODO

## Verification
```bash
npx vitest run tests/unit/pii-table-anon-smoke.test.ts
# Test Files  1 passed (1)
# Tests       4 passed (4)
```

## Follow-ups
- Lane 4.46 (queued): three-state probe needing service-role insert + cleanup. Requires Justin to provision a test row OR a Codex ticket with service-role access.
- Lane 4.47 (queued): extend smoke to authenticated-as-different-user probe (sign in as User A, attempt to read User B's rows via JWT-attached anon client) — tests owner-scoped RLS, not just anon lockdown.
