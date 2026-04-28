# Lane 4.14 — P0: Credit RPCs are anon-callable + SECURITY DEFINER

**Status:** P0 PRODUCTION BLOCKER
**Date:** 2026-04-28
**Auditor:** Claude (auto-loop, tick 50)
**Goal context:** "Production-ready financial gateway" — this is the exact class of gap that blocks shipping.

## TL;DR

Five gateway-internal RPCs are callable by `anon` role. Two of them (`add_credits`, `deduct_credits`) are confirmed `SECURITY DEFINER` — they bypass RLS on `credit_transactions` and would directly let an anonymous attacker mint or drain credits on any user account. The only thing preventing exploitation right now is the `balance_after NOT NULL` constraint, which only fails when the function can't find the target user — i.e., when a fake UUID is supplied. **With any real `p_user_id`, credits are minted/drained at will.**

## Probes (anon JWT, public Supabase REST)

```
$ curl -X POST https://isbratmfnnzipzyoefbo.supabase.co/rest/v1/rpc/validate_api_key \
    -H "apikey: $ANON_JWT" -H "Authorization: Bearer $ANON_JWT" \
    -d '{"p_key_hash":"deadbeef..."}'
HTTP=200 BODY={"error":"Invalid or revoked API key","valid":false}
```
→ **anon-callable. Function exists and returns key-validity oracle.**

```
$ curl -X POST .../rpc/check_rate_limit \
    -d '{"p_key_id":"00000000-...","p_rpm_limit":60,"p_rpd_limit":1000}'
HTTP=409 BODY={"code":"23503","message":"insert or update on table \"rate_limit_windows\" violates foreign key constraint"}
```
→ **anon-callable. EXECUTE granted; only failed because zero-UUID is not a real api_key. Real attacker with a guessed/leaked key_id can manipulate rate-limit windows.**

```
$ curl -X POST .../rpc/add_credits \
    -d '{"p_user_id":"00000000-...","p_amount":0.01,"p_type":"purchase",
         "p_stripe_payment_id":"pi_anon_probe","p_description":"audit probe"}'
HTTP=400 BODY={"code":"23502","details":"Failing row contains (..., 00000000-..., 0.01, null, purchase, audit probe, null, null, pi_anon_probe, ...)",
              "message":"null value in column \"balance_after\" of relation \"credit_transactions\" violates not-null constraint"}
```
→ **anon-callable. SECURITY DEFINER inserted into `credit_transactions` (anon has no direct INSERT — see below). Only `balance_after IS NOT NULL` constraint stopped it because the fake user has no balance to compute against.**

```
$ curl -X POST .../rpc/deduct_credits \
    -d '{"p_user_id":"00000000-...","p_amount":0.01,"p_description":"...",
         "p_key_id":"00000000-...","p_tool_slug":"openai"}'
HTTP=400 BODY={"code":"23502","details":"Failing row contains (..., 00000000-..., -0.01, null, usage, ...)",
              "message":"null value in column \"balance_after\" ..."}
```
→ **same shape. anon-callable, SECURITY DEFINER bypasses RLS, only constraint saved us.**

## Proof RPC is SECURITY DEFINER (bypasses RLS)

```
$ curl -X POST .../credit_transactions \
    -d '{"user_id":"00000000-...","amount":0.01,"type":"purchase"}'
HTTP=401 BODY={"code":"42501","message":"new row violates row-level security policy for table \"credit_transactions\""}
```
→ Direct anon INSERT correctly **blocked by RLS**. The RPC INSERT therefore must be running as a privileged role (SECURITY DEFINER), bypassing RLS.

## Exploit scenario (with real `p_user_id`)

User IDs are UUIDs — large search space — but they leak in normal operation:
1. Attacker registers their own account → gets a legitimate `gateway_users.id` UUID.
2. Attacker calls `add_credits` from any HTTP client with `p_user_id = <their_own_id>`, `p_amount = 999999`.
3. SECURITY DEFINER function: `SELECT credits FROM gateway_users WHERE id = <id>` returns 0 (existing). `balance_after = 0 + 999999 = 999999`. INSERT into `credit_transactions` succeeds. UPDATE `gateway_users.credits = 999999`.
4. Attacker now has $999,999 of upstream provider spend, payable by ToolRoute pool keys.

Variant: attacker scrapes user_ids from any leaky surface (Stripe checkout success URLs, public user pages, leaked logs, social engineering) and mints credits to a coerced victim or drains them via `deduct_credits`.

## Why route-level auth doesn't save this

The Next.js route handlers (`/api/v1/execute`, etc.) sit in front of the gateway logic and require a valid API key. But they are **not in the request path** when the attacker hits the public Supabase REST endpoint directly:

- Attack URL: `POST https://isbratmfnnzipzyoefbo.supabase.co/rest/v1/rpc/add_credits`
- Required auth: only the public anon JWT (which is in every browser bundle).

There is no Next.js route protecting Supabase's REST surface. The RPC's own grants are the perimeter, and the perimeter is open.

## Inventory — all anon-callable gateway RPCs

| RPC | Anon-callable? | Severity | Why |
|-----|----------------|----------|-----|
| `validate_api_key` | YES | HIGH | Key-validity oracle |
| `check_rate_limit` | YES | HIGH | Rate-limit window manipulation with valid key_id |
| `add_credits` | YES | **CRITICAL** | Mint credits on any user account |
| `deduct_credits` | YES | **CRITICAL** | Drain credits from any user account |
| `log_gateway_request` | UNTESTED — same risk class | HIGH | Log poisoning / metric corruption |

The RPCs that SHOULD be anon-callable (registry-side, not gateway):
- `check_before_build`, `search_tools_text`, `librarian_startup`, `get_category_champion`, `record_usage`, `challenge_tool`, `log_tool_request`, `get_tool_catalog` — these are public tool-discovery endpoints. Leaving them open is correct.

## Proposed migration (P0 — Justin runs in Lane 0)

`scripts/lockdown-gateway-rpcs.sql` (in this PR) does:

```sql
-- Lock down gateway-internal RPCs to service_role only
REVOKE EXECUTE ON FUNCTION public.validate_api_key(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_credits(uuid, numeric, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.deduct_credits(uuid, numeric, text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_gateway_request(...) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.validate_api_key(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(uuid, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_credits(uuid, numeric, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.deduct_credits(uuid, numeric, text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.log_gateway_request(...) TO service_role;
```

The Next.js routes already use `supabaseAdmin()` (service-role client), so behavior is unchanged after the lockdown.

## Verification probe (re-run after Justin executes the SQL)

```bash
# Each line MUST return 401/403 (or 404 PGRST301 with "permission denied for function")
curl -X POST .../rpc/validate_api_key -d '{"p_key_hash":"x"}'  # MUST 401/403
curl -X POST .../rpc/check_rate_limit -d '{"p_key_id":"...","p_rpm_limit":60,"p_rpd_limit":1000}'  # MUST 401/403
curl -X POST .../rpc/add_credits -d '...'  # MUST 401/403
curl -X POST .../rpc/deduct_credits -d '...'  # MUST 401/403
curl -X POST .../rpc/log_gateway_request -d '...'  # MUST 401/403
```

## Drift prevention (follow-up Lane 4.15, optional)

A regression vitest could probe each gateway-internal RPC with the public anon JWT and assert non-200 response. Sits beside `cogs-leak-audit.test.ts` and `master-key-leak-audit.test.ts`. Same pattern: lock the door, then a CI guard ensures it stays locked.

## Sibling rules

- Hard Rule #56 (anon-read 200+[] AMBIGUOUS) — column-level access
- Hard Rule #58 (anon-client server-component reads) — client/server boundary
- Lane 4.10 / 4.12 (column-leak audits) — different surface, same defense-in-depth philosophy
- This finding (Lane 4.14) — RPC-level access. Different from RLS on tables; separate grant system that doesn't show up in `pg_policies`.

## Generalizable lesson

**RPC EXECUTE grants are a separate audit surface from table RLS.** A SECURITY DEFINER function with default `EXECUTE TO PUBLIC` bypasses every RLS policy on every table it touches. Audit pattern for any gateway/financial product:

```sql
SELECT n.nspname, p.proname, p.prosecdef AS is_security_definer,
       array_agg(DISTINCT (a.privilege_type || ':' || a.grantee)) AS grants
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
LEFT JOIN information_schema.routine_privileges a ON a.specific_name LIKE p.proname || '%'
WHERE n.nspname = 'public' AND p.prosecdef = true
GROUP BY 1, 2, 3
ORDER BY 2;
```

Any row where `grants` includes `EXECUTE:PUBLIC` or `EXECUTE:anon` on a SECURITY DEFINER function = audit it. Worth adding to the JarvisCRM / DropClose / GTM-Hub / AffixedAI audit checklist.
