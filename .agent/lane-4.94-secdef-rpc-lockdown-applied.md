# Lane 4.94 — Orphaned SECURITY DEFINER RPC lockdown (APPLIED)

**Class**: P0 IDOR + lockdown drift
**Severity**: CRITICAL (full PII + financial leak via anon JWT)
**Date**: 2026-04-28
**Sibling**: Lane 4.92 (gateway RPC lockdown), Lane 4.78 (audit memo this corrects), Lane 4.14 (original gateway P0)

---

## TL;DR

Lane 4.78's audit memo only enumerated the 5 gateway-internal RPCs as anon-callable risks (`add_credits`, `deduct_credits`, `validate_api_key`, `check_rate_limit`, `log_gateway_request`). A re-audit via `pg_proc` (filtering `prosecdef = true` AND `EXECUTE TO PUBLIC`) found **two more** SECURITY DEFINER functions reachable as anon — both orphaned (zero callers in the Next.js app):

1. **`get_user_dashboard(uuid)` — P0 IDOR.** Anon JWT + any valid `gateway_users.id` returns: email (PII), credit_balance + lifetime_usage + lifetime_credits (financial), api_keys[] (id/name/key_prefix/request_count/spending_used — operational), usage_7d[] from `gateway_usage_log`, recent_transactions[] from `credit_transactions`. Bypasses Lane 4.1 RLS lockdown because SECDEF reads run with function-owner privilege.
2. **`cleanup_rate_limits()` — abuse-class.** Maintenance function; `window_start < now() - interval '2 days'` filter prevents anon spam from clearing live windows (1m/1d), but anon-callable maintenance is wrong on principle.

Live IDOR probe at 17:25Z (anon JWT, arbitrary `p_user_id`):
```
HTTP 200 + full payload — email "agent-test@toolroute.ai", credit_balance 4.9290,
api_keys[8e1bc382-...], usage_7d[...], recent_transactions[20]
```

Both RPCs locked via Supabase Mgmt API at 2026-04-28T<UTC>. Re-probe → HTTP 401 `permission denied for function`. P0 closed.

## Drift findings table

| RPC | SECDEF | EXECUTE pre-fix | Callers in src/ | Severity | Lockdown applied |
|---|---|---|---|---|---|
| `get_user_dashboard(uuid)` | yes | PUBLIC, anon, authenticated | 0 | CRITICAL (IDOR) | yes |
| `cleanup_rate_limits()` | yes | PUBLIC, anon, authenticated | 0 | LOW (abuse) | yes |

Discovery query (kept for replay):
```sql
SELECT proname, pg_get_function_identity_arguments(oid) AS args, prosecdef
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND prosecdef = true
  AND proname NOT IN ('add_credits','deduct_credits','validate_api_key',
                      'check_rate_limit','log_gateway_request',
                      -- registry/discovery (intentionally anon)
                      'check_before_build','search_tools_text','librarian_startup',
                      'get_category_champion','get_tool_catalog',
                      'challenge_tool','log_tool_request','record_usage');
```

## Live verification

```
=== Pre-fix (anon JWT) ===
POST /rest/v1/rpc/get_user_dashboard {"p_user_id":"150c42fd-..."}
  → HTTP 200 + full PII payload

POST /rest/v1/rpc/cleanup_rate_limits {}
  → HTTP 204 (success)

=== Post-fix (anon JWT) ===
POST /rest/v1/rpc/get_user_dashboard {"p_user_id":"150c42fd-..."}
  → HTTP 401 "permission denied for function get_user_dashboard"

POST /rest/v1/rpc/cleanup_rate_limits {}
  → HTTP 401 "permission denied for function cleanup_rate_limits"
```

## Generalizable lesson — `pg_proc` audit beats codebase-caller audit

Lane 4.78 enumerated risks by scanning `src/` for `.rpc("name")` call sites — that finds **only the RPCs the app currently uses**. SECURITY DEFINER + EXECUTE-to-PUBLIC RPCs from earlier registry/admin designs that were never wired up remain attack surface, since `pg_proc` is publicly enumerable via PostgREST OpenAPI introspection. Future RPC audits MUST start at `pg_proc` (DB-truth), not at code-truth.

Drift guard: `tests/unit/gateway-rpc-grants-drift.test.ts` extended with a Lane 4.94 describe block that asserts both RPCs remain REVOKE'd in `scripts/lane-4.94-secdef-rpc-lockdown.sql` AND that they remain orphaned (no callers in src/). If a future feature adds a caller, the orphan invariant fails and forces re-classification into `GATEWAY_INTERNAL_RPCS` (which would then require `supabaseAdmin()` at every call site).

## Acceptance

- [x] `get_user_dashboard(uuid)` REVOKE'd from PUBLIC/anon/authenticated; GRANT'd to service_role
- [x] `cleanup_rate_limits()` REVOKE'd from PUBLIC/anon/authenticated; GRANT'd to service_role
- [x] Live re-probe (anon JWT) confirms HTTP 401 on both
- [x] Idempotent — `scripts/lane-4.94-secdef-rpc-lockdown.sql` is `BEGIN ... COMMIT;` with REVOKE/GRANT (PG no-ops on already-applied)
- [x] Drift guard extended (`tests/unit/gateway-rpc-grants-drift.test.ts` — 4 new cases, all green)
- [x] Caller audit confirms zero callers in src/ for both RPCs
- [x] Hive blocker `8c645116-b44e-48ee-bd3b-7b5a24c63a8d` filed at discovery, resolved on apply
- [x] Migration script checked in for replay
