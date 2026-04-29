# Lane 4.95 — SECDEF RPC clean-state attestation (post-Lane-4.94)

**Class**: Audit closure / clean-state proof
**Date**: 2026-04-28T17:50Z
**Sibling**: Lane 4.94 (orphaned SECDEF lockdown), Lane 4.92 (gateway lockdown), Lane 4.78 (audit memo this generalizes)

---

## TL;DR

Post-Lane-4.94, ran the canonical `pg_proc` audit (`prosecdef = true AND nspname = 'public'`) against prod `isbratmfnnzipzyoefbo` to prove no third class of orphaned anon-callable SECURITY DEFINER RPCs remains. **Result: 12 SECDEF functions, all classified, no drift.**

This memo is the closing bookend to Lane 4.78 — that memo enumerated risks from `.rpc()` call sites in src/ (code-truth) and missed two orphaned RPCs. Lane 4.94 closed those two via DB-truth audit. Lane 4.95 verifies no third class exists and binds the audit surface.

## Final state — 12 SECURITY DEFINER functions

### Locked to service_role (7) — gateway-internal
| RPC | ACL | Locked by |
|---|---|---|
| `add_credits(uuid, numeric, text, text, text)` | postgres + service_role | Lane 4.92 (+ 4.93 input validation) |
| `check_rate_limit(uuid, integer, integer)` | postgres + service_role | Lane 4.92 |
| `cleanup_rate_limits()` | postgres + service_role | Lane 4.94 |
| `deduct_credits(uuid, numeric, text, uuid, text)` | postgres + service_role | Lane 4.92 (+ 4.93 input validation) |
| `get_user_dashboard(uuid)` | postgres + service_role | Lane 4.94 (P0 IDOR closed) |
| `log_gateway_request(uuid, uuid, text, text, integer, numeric, numeric, integer, boolean, text, jsonb, integer, text)` | postgres + service_role | Lane 4.92 |
| `validate_api_key(text)` | postgres + service_role | Lane 4.92 |

### Intentionally anon-callable (5) — registry/discovery
| RPC | ACL | Audited by |
|---|---|---|
| `check_before_build(text)` | PUBLIC + anon + authenticated + service_role | Lane 4.78 (registry) |
| `get_category_champion(text, text)` | PUBLIC + anon + authenticated + service_role | Lane 4.78 (registry) |
| `get_tool_catalog()` | PUBLIC + anon + authenticated + service_role | Lane 4.78 (registry) |
| `librarian_startup()` | PUBLIC + anon + authenticated + service_role | Lane 4.78 (registry) |
| `record_usage(text, text, text, text, integer, text)` | PUBLIC + anon + authenticated + service_role | Lane 4.78 (registry) |

These 5 are registered in `tests/unit/gateway-rpc-grants-drift.test.ts:51-60` `REGISTRY_PUBLIC_RPCS` set. Each reads/writes only the public registry tables (tools, category_beliefs, tool_requests) — no PII, no financial data, no privilege escalation surface.

## Discovery query (kept for replay)

```sql
SELECT n.nspname AS schema,
       p.proname AS name,
       pg_get_function_identity_arguments(p.oid) AS args,
       p.prosecdef AS sec_def,
       array_to_string(p.proacl,',') AS acl
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef = true
ORDER BY p.proname;
```

Run quarterly (or on every new SECDEF RPC migration) — same as Lane 6.8.2 ToS recheck cadence. If the result returns more than 12 rows OR introduces a new ACL pattern, audit immediately.

## Drift guard binding

`tests/unit/gateway-rpc-grants-drift.test.ts` already enforces:

1. **GATEWAY_INTERNAL_RPCS** must each have REVOKE + GRANT in `lockdown-gateway-rpcs.sql` (or be otherwise locked). Covered by case 1 + 2.
2. **REGISTRY_PUBLIC_RPCS** are explicitly allowlisted (case "RPC categorization sets do not overlap").
3. **Every RPC in src/ is classified** (case "every RPC referenced in src/ is classified") — un-classified = test fail.
4. **LANE_4_94_LOCKED_RPCS** must each have REVOKE + GRANT in `lane-4.94-secdef-rpc-lockdown.sql` (Lane 4.94 added 4 new cases).
5. **Orphan invariant** — Lane 4.94 RPCs must remain unreferenced in src/ (else re-classify).

Combined: the test suite forces drift back through PR review.

## Generalizable rule

> RPC audit must start at `pg_proc` (DB-truth), not at `grep .rpc(` (code-truth). Orphaned SECURITY DEFINER + EXECUTE-to-PUBLIC RPCs are still attack surface via PostgREST OpenAPI introspection — even with zero callers in the app.

Captured into the codex-build-queue lesson log. Future RPC additions:
1. New SECDEF RPC migration → must include EXECUTE grant decision in same SQL file (lock or allowlist)
2. New SECDEF lockdown SQL → must add to drift guard test (REVOKE + GRANT case + caller invariant)
3. Quarterly re-run of the discovery query (or trigger on prod-DDL detected)

## Acceptance

- [x] `pg_proc` enumeration confirms 12 total SECDEF functions in `public`
- [x] All 7 sensitive RPCs locked to service_role only (verified via `proacl`)
- [x] All 5 registry RPCs match `REGISTRY_PUBLIC_RPCS` test set
- [x] No third class of orphaned anon-callable SECDEF RPC remains
- [x] Discovery query checked in to this memo for replay
- [x] Drift guard binds the audit surface (9/9 cases green in `gateway-rpc-grants-drift.test.ts`)
- [x] Lane 4.78 audit gap (code-truth-only enumeration) generalized into `pg_proc`-first rule
