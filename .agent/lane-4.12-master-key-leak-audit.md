# Lane 4.12 — Provider Master & BYOK Key Leak-Class Audit

**Status:** CLEAN
**Date:** 2026-04-28
**Auditor:** Claude (auto-loop)
**Scope:** Sibling audit to Lane 4.10 (gateway COGS leak class). Same pattern applied to provider auth-key columns.

## Why this audit

`tool_providers.auth_key_encrypted` holds **master pool API keys** for upstream providers (OpenAI, Anthropic, ElevenLabs, etc.). `byok_provider_keys.api_key_encrypted` holds **customer-supplied** keys. Both are credentials. If either leaks to a customer-facing response, the consequences are categorically worse than the COGS leak Lane 4.10 audited:

- **Master key leak** → attacker drains the pool wallet on the upstream provider, costs ToolRoute real money and may revoke the upstream account.
- **BYOK key leak** → attacker exfiltrates customer credentials, immediate breach disclosure obligation.

Same audit pattern as Lane 4.10: structural grep → categorize every hit → ship a regression vitest.

## Findings — `auth_key_encrypted` (master pool, table `tool_providers`)

5 hits across 2 files:

| File | Line | Category | Notes |
|------|------|----------|-------|
| `src/lib/gateway.ts` | 270 | **READ-INTERNAL** | SELECT inside `executeAdapter`. Column consumed locally as `resolvedKey`, passed to `adapter.execute()`. Never on response wire. |
| `src/lib/gateway.ts` | 276–277 | **READ-INTERNAL** | Same selection consumed to set `keySource = "master"`. Never on response wire. |
| `src/app/api/admin/providers/route.ts` | 59 | **WRITE** | UPDATE inside `validateAdmin`-guarded route. |
| `src/app/api/admin/providers/route.ts` | 96 | **WRITE** | INSERT inside `validateAdmin`-guarded route. |

The admin GET handler in `providers/route.ts:142` enumerates safe columns explicitly (`id, tool_slug, provider_name, api_base_url, auth_type, auth_header_name, cost_per_call, cost_model, cost_unit, markup_percent, is_active, health_*, last_health_check, avg_latency_ms, error_rate_24h, created_at, updated_at`) — **`auth_key_encrypted` is NOT in the select list**. Output decorates with `has_master_key: true` instead of exposing the value. Clean.

## Findings — `api_key_encrypted` (BYOK, table `byok_provider_keys`)

3 hits across 2 files:

| File | Line | Category | Notes |
|------|------|----------|-------|
| `src/lib/gateway.ts` | 253 | **READ-INTERNAL** | SELECT inside `executeAdapter` BYOK lookup. Internal-only consumption. |
| `src/lib/gateway.ts` | 261 | **READ-INTERNAL** | Assigned to `resolvedKey`. Never on response wire. |
| `src/app/api/v1/byok/route.ts` | 28 | **WRITE** | INSERT on customer key registration. TODO comment flags KMS encryption follow-up — separate concern, not a leak. |

## Categorization summary

| Class | Count |
|-------|-------|
| READ-INTERNAL (consumed locally, never on response) | 4 |
| WRITE (INSERT/UPDATE only) | 4 |
| **CUSTOMER-LEAK** | **0** |

## Conclusion

No leak. Both key column families are walled off from customer-facing response paths.

## Drift prevention

Shipped alongside this audit: `tests/unit/master-key-leak-audit.test.ts` — a static-grep regression test with an allowlist. Fails CI if either column appears in any source file outside:

- `src/lib/gateway.ts` (read path, internal-only consumption)
- `src/app/api/admin/providers/route.ts` (admin write path)
- `src/app/api/v1/byok/route.ts` (BYOK write path)

Sits beside `tests/unit/cogs-leak-audit.test.ts` (Lane 4.10) — same pattern, different column.

## Next-tier audit candidates (not yet run)

- `gateway_users.email_verified_token` / password-equivalent fields — if any password recovery tokens are stored, same leak class.
- Stripe `customer_id` / `subscription_id` — less severe (not credentials) but same audit pattern would catch shape-drift.
- Any column named `*_secret` / `*_key` / `*_token` across the schema — generalize the regex to `\b(auth_key|api_key|secret|token)_encrypted\b` for broader coverage.

## Cross-applies

Same audit (column names will differ): JarvisCRM plugin keys, DropClose resold-tool keys, GTM-Hub MCP server upstream keys, AffixedAI provider keys. The vitest pattern (allowlist + regex + `walkSrc`) is product-portable.
