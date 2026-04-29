# Lane 4.96 — anon WRITE grants REVOKE (defense-in-depth)

**Class**: Defense-in-depth post-Lane-4.16 gap
**Severity**: HIGH (latent — RLS-only protection collapses to silent leak if any policy weakens)
**Date**: 2026-04-28T17:55Z
**Sibling**: Lane 4.16 (anon SELECT REVOKE — closed read surface only), Lane 4.92 (RPC EXECUTE), Lane 4.94 (orphaned SECDEF), Lane 4.95 (clean-state attestation)

---

## TL;DR

Lane 4.95's RLS coverage audit showed every financial table still has wide anon WRITE grants (`INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER`). RLS policies block the writes at runtime today, but RLS is the *only* line of defense. Any future policy weakening (`USING (true)`, owner-scope removed, table recreated without `ENABLE ROW LEVEL SECURITY`, etc.) silently re-opens a mint/drain surface.

Lane 4.16 REVOKE'd anon SELECT but did NOT revoke writes — this lane closes that gap for the 6 financial tables (`api_keys`, `credit_transactions`, `gateway_usage_log`, `gateway_users`, `usage_events`, `user_provider_keys`).

Applied via Supabase Mgmt API at 2026-04-28T17:55Z. Live re-probe of all 6 tables → HTTP 401 with new error message: `permission denied for table X` (was: `new row violates row-level security policy`). The error message change is the proof that REVOKE took effect at the GRANT layer — BEFORE RLS evaluation.

## Caller-side audit (proves zero false-positive risk)

All 7 write sites against the 6 financial tables use `supabaseAdmin()` (service_role), which bypasses both GRANTs and RLS:

| File:line | Table | Operation | Client |
|---|---|---|---|
| `src/lib/gateway.ts:503` | `gateway_users` | INSERT (free-tier user creation) | `admin` (supabaseAdmin) |
| `src/app/auth/callback/route.ts:72` | `gateway_users` | INSERT (OAuth callback) | `admin` (supabaseAdmin) |
| `src/app/api/v1/signup/route.ts:157` | `gateway_users` | INSERT (password signup) | `sb` (supabaseAdmin) |
| `src/app/api/v1/signup/route.ts:180` | `api_keys` | INSERT (signup default key) | `sb` (supabaseAdmin) |
| `src/app/api/webhooks/stripe/route.ts:48` | `credit_transactions` | INSERT (payment_failed log) | `sb` (supabaseAdmin) |
| `src/app/api/webhooks/stripe/route.ts:139` | `gateway_users` | UPDATE (stripe_customer_id) | `sb` (supabaseAdmin) |
| `src/app/api/webhooks/stripe/route.ts:164` | `gateway_users` | UPDATE (plan upgrade) | `sb` (supabaseAdmin) |

Other writes go through SECURITY DEFINER RPCs (`add_credits`, `deduct_credits`, `log_gateway_request`) which run as their owner (postgres) regardless of caller role.

## Live verification

```
=== Pre-fix (anon JWT, RLS blocked) ===
POST /rest/v1/api_keys             → 401 "new row violates row-level security policy"
PATCH /rest/v1/gateway_users       → 401 "permission denied"  (some policies already gated)
POST /rest/v1/credit_transactions  → 401 "new row violates row-level security policy"

=== Post-fix (anon JWT, GRANT blocked) ===
POST /rest/v1/api_keys             → 401 "permission denied for table api_keys"
PATCH /rest/v1/gateway_users       → 401 "permission denied for table gateway_users"
POST /rest/v1/credit_transactions  → 401 "permission denied for table credit_transactions"
DELETE /rest/v1/usage_events       → 401 "permission denied for table usage_events"
POST /rest/v1/gateway_usage_log    → 401 "permission denied for table gateway_usage_log"
POST /rest/v1/user_provider_keys   → 401 "permission denied for table user_provider_keys"
```

The `permission denied for table X` message means REVOKE fires before RLS — the request never reaches the policy evaluator. Mint-attack surface narrowed by one full layer.

## Out-of-scope follow-ups

- **`authenticated` role WRITE grants**: same GRANT-wide pattern exists. Different threat model — authenticated only fires when a logged-in user's JWT is presented, and policies use `auth.uid()` filters. Lane 4.97 candidate. All 7 write sites currently use service_role, so authenticated REVOKE is also safe; deferred for scope discipline.
- **Registry tables** (`tools`, `category_beliefs`, `tool_pricing`, etc.) intentionally allow some writes for crowd-sourced challenge/usage flows. NOT in scope.
- **`conversations`, `discovery_feed`, `inventory`, `rate_limit_windows`, `tool_memory`, `tool_overrides`, `tool_providers`, `tool_requests`** — RLS-enabled with 0 policies (default deny). Worth REVOKE'ing as defense-in-depth in a follow-up lane.

## Acceptance

- [x] All 6 financial tables REVOKE INSERT/UPDATE/DELETE/TRUNCATE from anon
- [x] Live re-probe confirms `permission denied for table` message (GRANT layer, not RLS layer)
- [x] All 7 write sites in src/ confirmed using `supabaseAdmin()` (service_role)
- [x] Drift guard `tests/unit/anon-write-grants-drift.test.ts` ships (8/8 green)
- [x] Migration script `scripts/lane-4.96-anon-write-grants-revoke.sql` checked in
- [x] Idempotent — REVOKE on already-revoked grants is no-op
- [x] Sibling-lane chain documented (4.16 → 4.92 → 4.94 → 4.95 → 4.96)
