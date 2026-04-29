# Lane 4.52 — credit deduction TOCTOU race audit

**Status:** Audit doc written. Live RPC body inspection deferred to Codex ticket.
**Severity:** P1 if `deduct_credits` is non-atomic, P3 (already-defended) if atomic.
**Date:** 2026-04-28
**Sibling:** Lane 4.20/4.23 (Stripe webhook double-grant), Hard Rule #57 (financial double-grant class).

## Threat model

Gateway flow (`src/lib/gateway.ts`):

| Line | Op | What |
|---|---|---|
| 47-49 | `validate_api_key` RPC | returns `credit_balance` snapshot into `ctx.creditBalance` |
| 229 | balance gate | `if (ctx.creditBalance < estimatedCost && estimatedCost > 0) throw 402` |
| 294 | `adapter.execute(...)` | upstream call (1-30s wall time, longer for chat/transcribe/crawl) |
| 345 | `log_gateway_request` | usage row write |
| 361 | `deduct_credits` RPC | actual decrement |

`ctx.creditBalance` is a snapshot at request entry — never refreshed before the deduct call. The decision to allow execution is made against stale state.

### Race window

```
T=0      Req A enters: validate_api_key → snapshot=$0.10, gate passes ($0.005 < $0.10)
T=10ms   Req B enters: validate_api_key → snapshot=$0.10, gate passes ($0.005 < $0.10)
T=20ms   Req A: adapter.execute starts (chat call, 12s)
T=30ms   Req B: adapter.execute starts (chat call, 12s)
T=12s    Req A: deduct_credits($0.005) → balance=$0.095
T=12.01s Req B: deduct_credits($0.005) → balance=$0.090
```

Both passed the gate against the same snapshot. Two upstream calls landed against ToolRoute's master pool. Even with a balance UPDATE on each `deduct_credits`, **the balance check at T=10ms used stale data** — neither request saw the other's decrement.

For typical $5 credit balances and $0.005 estimates that's noise. The leak surfaces when:

1. **Balance is near-empty.** Account at $0.01 with two concurrent $0.005 calls → both pass the snapshot gate, second deduct goes to **$0.005 negative** if the RPC doesn't enforce a non-negative floor.
2. **Estimate is far below actual cost.** Lane 4.51 Class B (openai chat $0.005 estimate vs $1.92 actual). Two concurrent $0.005 calls against a $0.01 balance both pass, both burn ~$1.92 upstream → **~$3.84 COGS leak vs $0.01 user balance**.
3. **Adapter calls are long-running.** Chat / transcribe / crawl / image-gen — 5-30s wall time gives a wide T=0..T=30s window where N concurrent requests all pass the same snapshot.

Class B from Lane 4.51 (openai/deepgram/firecrawl) is exactly the class that amplifies this — flat-estimate-on-variable-cost AND long-running upstream. The two failure classes compound.

### What does *not* save us

- **Rate limiting.** `check_rate_limit` (line 102) gates RPM/RPD per key, not "concurrent in-flight requests" — N requests below the per-second rate but launched within a 30ms burst all pass.
- **Lane 4.20 / 4.23 dedup.** Those are Stripe-side: `credit_transactions` UNIQUE on `(stripe_payment_id, type)`. They protect against double-credit-MINT, not double-DEDUCT.
- **Application-layer probe.** `gateway.ts` doesn't probe `gateway_users.credits` between the snapshot and the deduct. Even if it did, the probe→deduct would itself be a TOCTOU.

## What I cannot determine from the repo alone

The `deduct_credits` SQL function body is **not in this repo** — only EXECUTE grants in `scripts/lockdown-gateway-rpcs.sql`. The function lives in Supabase (`isbratmfnnzipzyoefbo`). Three possible bodies:

### (a) Atomic — already defended

```sql
UPDATE gateway_users
   SET credits = credits - p_amount
 WHERE id = p_user_id
   AND credits >= p_amount       -- ← gate inside the UPDATE, atomic
RETURNING credits AS balance_after;
```

Two concurrent transactions serialize at row-lock; second sees decremented value, fails the `credits >= p_amount` predicate, returns 0 rows. Caller sees no row → returns `{success: false}`. **Race closed structurally.** Negative balances impossible.

If this is what's there, this audit ships as documentation only + a vitest that asserts the SQL spec.

### (b) Non-atomic — REAL TOCTOU

```sql
SELECT credits INTO v_balance FROM gateway_users WHERE id = p_user_id;
IF v_balance < p_amount THEN RETURN ...; END IF;
UPDATE gateway_users SET credits = credits - p_amount WHERE id = p_user_id;
INSERT INTO credit_transactions (..., balance_after, ...) VALUES (..., v_balance - p_amount, ...);
```

Two concurrent calls: both `SELECT` returns `$0.01`, both pass the IF, both `UPDATE` (Postgres serializes the writes but the IF gate is already passed). Final balance: `$0.01 - $0.005 - $0.005 = $0.00`. **Concurrent calls beyond available balance succeed.** And `balance_after` is computed from stale `v_balance`, so the ledger row is wrong.

This is a P1 ship-now finding.

### (c) Row-locked — defended within transaction

```sql
SELECT credits INTO v_balance FROM gateway_users WHERE id = p_user_id FOR UPDATE;
IF v_balance < p_amount THEN ... END IF;
UPDATE gateway_users SET credits = credits - p_amount WHERE id = p_user_id;
```

`FOR UPDATE` row-lock serializes concurrent calls. Second waits for first to commit, re-reads decremented value, fails the IF. **Race closed transactionally** — equivalent safety to (a) but slightly less efficient (extra round-trip). Caller-side: gateway.ts doesn't appear to wrap the RPC in a transaction, but a SECURITY DEFINER function executes its body in an implicit transaction by default, so `FOR UPDATE` here would still serialize.

Likely what's there if Justin / Codex authored it carefully.

## Decision tree

| Outcome | Action |
|---|---|
| (a) atomic UPDATE-with-WHERE-gate | Lane 4.52 ships as audit doc + vitest asserting SQL spec. No P1 fix. |
| (b) non-atomic SELECT-then-UPDATE | Lane 4.52-impl Codex ticket: rewrite to (a). Ship same-deploy vitest. |
| (c) FOR UPDATE row-lock | Lane 4.52 ships as audit doc + vitest asserting SQL contains `FOR UPDATE`. No P1 fix. |

## Codex ticket (Lane 4.52-inspect)

**Goal:** dump `deduct_credits` and `add_credits` function bodies via `mcp__supabase` introspection so this audit can resolve to (a/b/c). Do NOT modify either function.

**Steps:**

1. `mcp__supabase__execute_sql` with:
   ```sql
   SELECT pg_get_functiondef(p.oid) AS def
     FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname IN ('deduct_credits', 'add_credits')
    ORDER BY p.proname;
   ```
2. Paste both bodies into the PR description.
3. Append findings to this doc as `## Live RPC body (Codex inspection 2026-MM-DD)` section.
4. If outcome is (a) or (c): close Lane 4.52 with audit doc + spec vitest only.
5. If outcome is (b): open Lane 4.52-impl ticket with the rewrite SQL + concurrent-call vitest.

This is a **read-only inspection**. No `BEGIN`, no `CREATE OR REPLACE`. PR title: `[lane-4.52-inspect] dump deduct_credits / add_credits bodies for TOCTOU audit`.

## Why Claude can't run this directly

Production `deduct_credits` was REVOKEd from anon by Lane 4.14 (script ready, Justin runs in Lane 0.1). Even pre-lockdown the anon role couldn't `pg_get_functiondef` against most schemas. Codex with `mcp__supabase` (service-role) is the right tool.

## Cross-applies to

Same TOCTOU class on every Justin product with credit/balance-gated execution:

| Product | Likely RPC | Audit step |
|---|---|---|
| **DropClose** | `deduct_lead_credit` or equivalent | grep `from(... credits ...).update` |
| **CallTwin** | `consume_call_minute` | check between gateway and twilio webhook |
| **AffixedAI** | `decrement_consult_quota` | session-token-issuance gate |
| **JarvisCRM** | per-tenant generated billing tables | scan generator template |
| **PeptideAI** | order-quota / inventory | Stripe-funded inventory writes |

Universal pattern: any **balance-snapshot at request entry** + **balance-mutation later in the same request** is suspect unless the mutation enforces the balance constraint atomically (single UPDATE with WHERE clause).

## Currently exploitable?

**Yes — latent.** Today the leak is bounded by:
- Master pool only funded for ResendEmail (ToolRoute env vars currently). Class-B providers (openai/deepgram/firecrawl) need `tool_providers` rows that are admin-locked.
- Per Lane 6.5-impl: `AMBIGUOUS_DEFAULT_BYOK_SLUGS` will close openai/deepgram/firecrawl from master-pool-routing — user pays their own COGS via BYOK.

After Lane 6.5-impl ships, the COGS-leak class drops to "user balance can go negative on their own concurrent calls" — annoying UX, not financial leak. Today, it's both.

## Conclusion

This PR ships the audit doc only. No code change. Pending Codex inspection of the live RPC body (ticket queued in `codex-build-queue.md`). After Codex confirms the body shape, follow-up is either (a) spec-locking vitest only, or (b) Codex ticket to convert SELECT-then-UPDATE → atomic UPDATE-with-WHERE-gate.
