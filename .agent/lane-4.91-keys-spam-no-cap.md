# Lane 4.91 — `/api/v1/keys` POST Has No Per-User Cap or Rate Limit (DoS / abuse class)

**Class**: missing abuse controls on session-authed mutation endpoint
**Severity**: MEDIUM (DoS vector, table-bloat, COGS amplifier; no data leak)
**Date**: 2026-04-28
**Sibling lanes**: 4.27 (signup rate-limit audit — covered the auth path, not post-auth mutations), 4.30 (IDOR audit — focused on cross-user leaks, not own-user abuse), 4.86 (cancel revokes `tr_live_` — revoked rows still occupy the table)

---

## Symptom

`src/app/api/v1/keys/route.ts:11-100` (`POST`):

```ts
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const { userId } = await getUserFromSession(authHeader);

    let body: { name?: string; allowed_tools?: string[]; expires_in_days?: number };
    // ... body parsing, plan lookup ...

    const { raw, hash, prefix } = isPaidPlan ? generateApiKey() : generateTestApiKey();

    // ... expires_at logic ...

    const { data: keyRow, error } = await sb
      .from("api_keys")
      .insert({ user_id: userId, name: keyName, key_hash: hash, ... })
      .select(...)
      .single();
    // ... return raw key ...
```

What's missing:

1. **No `count(*)` check on existing `api_keys` rows for this `user_id`** before insert
2. **No per-IP or per-user rate limit** wrapping the handler
3. **No back-pressure** when insert fails (e.g., DB returns connection-pool-exhausted)

Compare to `/api/v1/execute` which goes through `validateRequest()` → `check_rate_limit` RPC. Session-authed mutation endpoints have NO equivalent.

---

## Why this matters

### Attack 1 — Table bloat (any user)

```bash
# Pseudo-attack
for i in {1..1000000}; do
  curl -X POST https://toolroute.ai/api/v1/keys \
    -H "Authorization: Bearer $SESSION_JWT" \
    -H "Content-Type: application/json" \
    -d '{"name":"x"}'
done
```

Free-tier user (Lane 4.3 gate forces `tr_test_` keys) creates a million `tr_test_` rows. Effects:

- `api_keys` table grows by ~200 MB per million rows
- `validate_api_key` RPC still O(log n) (key_hash is indexed) so per-call latency holds, BUT
- Any maintenance query (`SELECT count(*)`, `VACUUM`, schema migrations on this table) slows materially
- Supabase row-count overage charges if/when project moves to paid tier
- Even after Lane 4.86 ships, `customer.subscription.deleted` only soft-revokes (`is_active = false`); rows remain forever

### Attack 2 — Paid-tier abuse (after Lane 4.3 satisfied)

A paid user who briefly subscribes (one billing cycle, $5) can:

1. Mass-mint 1M `tr_live_` keys via this endpoint
2. Distribute keys to 1M end-users (effectively reselling ToolRoute access)
3. Cancel subscription → Lane 4.86 will revoke them at end-of-period
4. Re-subscribe next month → previous keys stay revoked, but this is one-time scaling, not the abuse pattern

The shorter loop:

1. Subscribe at $5/mo
2. During the active period, hand out 100k tr_live_ keys via a reseller wrapper
3. Each gets free-tier rate limits (rpm/rpd, since plan is downgraded to free at end-of-period)
4. They get free MCP+A2A access for the 30-day window AND a brief cliff at month-end

This is a different abuse vector than Lane 4.86 closed (post-cancellation `tr_live_` survival). Lane 4.86 only stops *post-cancel* misuse; the *during-paid-period reseller* class is wide open.

### Attack 3 — Stripe-API exhaustion via `/api/v1/checkout`

Sibling endpoint, `src/app/api/v1/checkout/route.ts`, calls `stripe.checkout.sessions.create` per request — also no rate limit. A user can call this endpoint 100x/sec, spamming Stripe with checkout-session creation calls. Eventually Stripe's per-account rate limit triggers, breaking checkout for ALL ToolRoute users until the limit resets.

Stripe's default account-level limit is 100 req/sec. One malicious session can saturate this for the platform.

---

## Audit scope: which session-authed mutation routes are unrate-limited?

`grep -rn "getUserFromSession" src/app/api/`:

| Route | Method | Insert/mutate? | Rate-limit? |
|---|---|---|---|
| `/api/v1/keys` | POST | `api_keys` insert (UNBOUNDED) | **No ❌** |
| `/api/v1/keys` | DELETE | soft-revoke | No (soft-revoke is bounded) |
| `/api/v1/keys` | PATCH | rename | No (bounded) |
| `/api/v1/byok` | POST | `user_provider_keys` upsert | No (bounded by #tools) |
| `/api/v1/byok` | DELETE | soft-revoke | No (bounded) |
| `/api/v1/checkout` | POST | Stripe API call | **No ❌** (Stripe-quota DoS class) |
| `/api/v1/settings` | PATCH | `gateway_users` update (bounded keys) | No (bounded) |

The two ❌ rows are the unbounded write paths.

---

## Recommended fix — `[lane-4.91-impl]` Codex ticket

Two-part fix. Part A is the per-user count cap (closes the table-bloat attack). Part B is per-user rate limit (closes the burst attack).

### Part A — Hard cap on `api_keys` per user

In `src/app/api/v1/keys/route.ts:POST`, before the insert:

```ts
const MAX_KEYS_PER_USER = 50; // generous; plenty for legitimate multi-key needs

// After plan lookup, before generateApiKey()
const { count } = await sb
  .from("api_keys")
  .select("id", { count: "exact", head: true })
  .eq("user_id", userId)
  .eq("is_active", true);

if ((count ?? 0) >= MAX_KEYS_PER_USER) {
  return NextResponse.json(
    {
      error: {
        message: `Active API key limit reached (${MAX_KEYS_PER_USER}). Revoke unused keys before creating new ones.`,
        code: "key_limit_reached",
      },
    },
    { status: 429, headers: AUTHED_RESPONSE_HEADERS }
  );
}
```

Counts only `is_active = true` so revoked keys don't count against the limit (legitimate users who rotate keys aren't penalized).

### Part B — Per-user rate limit on POST

Add a lightweight RPC `check_session_mutation_rate_limit(p_user_id, p_endpoint, p_limit_per_minute)` or reuse `check_rate_limit` from gateway. Cap at 10 req/min for `/api/v1/keys` POST.

```ts
// At top of POST handler, after auth
const allowed = await sb.rpc("check_session_mutation_rate_limit", {
  p_user_id: userId,
  p_endpoint: "keys_create",
  p_limit_per_minute: 10,
});
if (!allowed.data) {
  return NextResponse.json(
    {
      error: {
        message: "Too many key creation requests. Try again in 60 seconds.",
        code: "rate_limited",
      },
    },
    { status: 429, headers: AUTHED_RESPONSE_HEADERS }
  );
}
```

The RPC body (Codex ticket Part B): SECURITY DEFINER, reads/writes a `session_mutation_log(user_id, endpoint, ts)` table with a partial index on `(user_id, endpoint, ts)`. Returns false if count in last 60s ≥ p_limit_per_minute.

### Sibling: apply Part B to `/api/v1/checkout`

Same RPC call at top of POST: `p_endpoint: "checkout_create", p_limit_per_minute: 5`. Stripe-quota DoS closed.

---

## Drift guard

`tests/unit/keys-post-abuse-controls.test.ts` — parse `src/app/api/v1/keys/route.ts` source and assert the POST handler contains:

1. A `count: "exact"` query against `api_keys`
2. A comparison against a `MAX_KEYS_PER_USER` constant (or literal ≥10)
3. A `check_session_mutation_rate_limit` RPC call

Sibling guard for `/api/v1/checkout`:

`tests/unit/checkout-post-rate-limit.test.ts` — assert source contains the rate-limit RPC call before `stripe.checkout.sessions.create`.

---

## Acceptance

- [ ] `MAX_KEYS_PER_USER = 50` cap enforced on `/api/v1/keys` POST
- [ ] Returns 429 with `code: "key_limit_reached"` when exceeded
- [ ] `check_session_mutation_rate_limit` RPC + table created
- [ ] Rate limit applied to `/api/v1/keys` POST (10/min) and `/api/v1/checkout` POST (5/min)
- [ ] Drift guards in place
- [ ] Smoke test: POST /api/v1/keys 51 times → first 50 succeed (200), 51st returns 429
- [ ] Smoke test: POST /api/v1/keys 11 times in 60s → first 10 succeed, 11th returns 429

## Out of scope

- Hard cap of 50 may need tuning per plan tier (free: 5, pro: 50, enterprise: 500). For v1 use a flat 50; revisit when plan tiers diverge in actual usage patterns.
- IP-based rate limiting (Cloudflare/Vercel Edge layer) — defense-in-depth; user-id-scoped limit is the primary control because authenticated abuse is the targeted class.
- Cleanup of historical bloat — separate ops task; backfill script can soft-revoke keys >180 days old with `last_used_at = null`.
- BYOK / settings rate limits — bounded (upsert and field allowlist) so DoS surface is small. Defer to a future lane if abuse data shows otherwise.

## Related observations

- **Lane 4.86** revokes `tr_live_` keys on subscription cancel but doesn't delete them. Combined with this lane, `MAX_KEYS_PER_USER` only caps **active** keys, so a cycling user (subscribe → mint 50 → cancel → revoke → re-subscribe → mint 50 more) builds up unbounded soft-revoked rows. A periodic cleanup job (drop revoked keys with `last_used_at IS NULL` after 90d) would close this tail. Out of scope for this lane.
- **Lane 4.30** (IDOR audit) explicitly looked at cross-user mutation paths; it didn't cover own-user abuse-of-self class. This lane fills that gap for the keys endpoint specifically.
- **Lane 4.27** (signup rate limit) is enforced by Supabase Auth itself for the actual `auth.signUp()` call. Post-signup session-authed routes have no equivalent — this lane is the first to address that class.
