# Lane 4.131 — Gateway RPC callsite drift guard

## What this guards (relative to 4.121-4.130)

The column-family lanes (4.121-4.130) cover the PostgREST surface
(`.from("table").update/insert/delete`). They DON'T cover RPC-callable
writes. This lane locks the caller list of every gateway RPC.

These RPCs are SECURITY DEFINER + parameterized at the DB layer:

- Lane 4.92 — RPC EXECUTE lockdown (5 RPCs, anon revoked)
- Lane 4.93 — credit RPC input validation (mint-attack closed)
- Lane 4.94 — orphaned SECDEF RPC lockdown
- Lane 4.97 — `authenticated` write REVOKE on financial tables

But the caller list inside src/ is its own drift surface, and that's what
this PR locks.

## Audit findings — current callers

| RPC | Callers (file:line) | Purpose |
|-----|---------------------|---------|
| `add_credits` | `gateway.ts:207` | auto-top-up after off-session PaymentIntent |
| `add_credits` | `webhooks/stripe/route.ts:142` | one-time credit purchase (checkout.session.completed) |
| `add_credits` | `webhooks/stripe/route.ts:202` | subscription plan-credit grant (first invoice) |
| `add_credits` | `webhooks/stripe/route.ts:245` | monthly subscription renewal (invoice.paid) |
| `add_credits` | `webhooks/stripe/route.ts:281` | auto_topup PaymentIntent succeeded |
| `deduct_credits` | `gateway.ts:412` | per-tool execution charge in `executeToolRequest` |
| `validate_api_key` | `gateway.ts:47` | `validateRequest` wrapping logic |
| `check_rate_limit` | `gateway.ts:102` | `checkRateLimit` |
| `log_gateway_request` | `gateway.ts:331` | usage log on error path |
| `log_gateway_request` | `gateway.ts:387` | usage log on success path |

Total: 2 source files, 10 callsites.

## Tampering surface this guard closes

1. **`add_credits` mint surface (highest blast radius)** — A future PR
   adds an admin endpoint, "promo code" route, or UI mutation that calls
   `add_credits` without idempotency on `stripe_payment_id`. Same fraud
   class Lane 4.93 closed at the RPC input layer; this guard prevents a
   new caller from drifting in even if the RPC validation regresses.

2. **`deduct_credits` double-charge surface** — Drift = a new endpoint
   calls `deduct_credits` without going through `executeToolRequest`'s
   pre-validation (BYOK key resolution, COGS calculation, success-only
   gating). The audit said `gateway.ts:412` is the *only* deduct site.

3. **`validate_api_key` bypass surface** — Drift = a new file calls
   `validate_api_key` directly and skips `validateRequest`'s wrapping
   logic (the manual `expires_at` check that the RPC doesn't perform —
   gateway.ts:65-85). Bypass = expired keys validate.

4. **`check_rate_limit` bypass surface** — Drift = a new mutation path
   that doesn't call `checkRateLimit`, allowing rate-limit-bypass via
   side-channel.

5. **`log_gateway_request` silent-loss surface** — Drift = a new code
   path that mutates billing-reconciliation state but doesn't call
   `log_gateway_request`. Silent loss creates ghost revenue (credits
   deducted, no usage row to reconcile against).

## Test asserts (6)

1. `add_credits` callers ⊆ {`gateway.ts`, `webhooks/stripe/route.ts`}.
2. `deduct_credits` callers ⊆ {`gateway.ts`}.
3. `validate_api_key` callers ⊆ {`gateway.ts`}.
4. `check_rate_limit` callers ⊆ {`gateway.ts`}.
5. `log_gateway_request` callers ⊆ {`gateway.ts`}.
6. No raw SQL `SELECT add_credits(...)` / `CALL add_credits(...)` etc. in
   src/ — supabase-js `.rpc()` is the canonical entry point. (Raw SQL
   would side-channel both the SUPABASE-level grants and this caller-list
   guard.)

## Why source-file regex (not runtime import)

Memory feedback rule #59 — registry imports often pull in `createClient()`
and crash without prod env. Tests use `fs.readFileSync` + regexes; nothing
imports app code.

## Defense-in-depth (RPC layer)

1. **DB-grant layer**: Lane 4.92 — `EXECUTE` revoked on anon; only service-role
   can call.
2. **DB-input layer**: Lane 4.93 — `add_credits` rejects negative amounts,
   non-positive inputs.
3. **DB-orphan layer**: Lane 4.94 — orphaned SECDEF RPCs locked (no
   anon-callable IDOR surface).
4. **App-layer Lane 4.131** (this PR): caller-list allow-list per RPC.

## Drift-guard family progression

- 4.121-4.130 — PostgREST column families (10 PRs)
- **4.131 RPC callsite allow-list** (this PR) — RPC caller drift surface

After this PR merges, every gateway WRITE — both PostgREST and RPC — has
CI drift coverage. Combined coverage:

- `gateway_users.{credit_balance, plan_slug, plan_id, stripe_customer_id, auto_topup_*, email, metadata}` ✓
- `api_keys.{user_id, is_active, name, last_used_at, key_hash, key_prefix}` ✓
- `credit_transactions` (insert-only ledger) ✓
- `user_provider_keys` (write paths + user_id immutable) ✓
- `add_credits` / `deduct_credits` / `validate_api_key` / `check_rate_limit` / `log_gateway_request` ✓

Next-tier candidates:
- Lane 4.132+ — drift guard on adapter `execute()` callsites (currently
  only `executeToolRequest` calls them; new direct callers would skip
  cost/auth/log instrumentation).
- Lane 4.132 — drift guard on `supabaseAdmin()` callsites (currently
  spread across many files; could be locked to gateway.ts + webhooks).
