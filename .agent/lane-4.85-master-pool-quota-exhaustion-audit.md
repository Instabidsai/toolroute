# Lane 4.85 — Master-Pool Quota Exhaustion via Failure Amplification

**Class**: economic DoS — single attacker exhausts master-pool provider quota,
denying service to all paying customers
**Severity**: HIGH (multi-tenant outage from a single free-tier account)
**Date**: 2026-04-28
**Sibling lanes**: 4.27 (auth signup rate-limit), 4.84 (COGS undercount on
failure path — same root cause)

---

## Attack scenario

1. Attacker signs up via `/api/v1/signup` (email + TOS accept) — free tier
   → `tr_test_` key issued (`route.ts:23`) + starter credits granted
2. Attacker calls `/api/v1/execute` with malformed input targeting a
   high-COGS funded master-pool provider (e.g., OpenAI). Each call:
   - Passes `check_rate_limit` (per-key rpm/rpd is global, generous)
   - Passes `getKeyContext` (key is valid)
   - Fires upstream `fetch()` against OpenAI with the master-pool key
   - OpenAI returns 4xx (malformed body / invalid model / etc.)
   - Adapter returns `success: false`
   - Gateway logs `cost_to_us = 0` (Lane 4.84) and **does NOT deduct
     credits** (`gateway.ts:359`: `if (result.success && finalCost > 0)`)
3. Attacker repeats at the per-key rpm ceiling (free-tier ~60 rpm by default)
4. After ~10–60 minutes, OpenAI's **org-wide** rate limit (RPD or
   tokens-per-minute) trips for the entire ToolRoute master pool
5. **Every paying customer's** OpenAI call now fails with 429 from upstream
   until the org-wide window resets (potentially hours)

The attacker:
- Never paid a credit
- Can re-run from a new email after their key gets banned
- Doesn't need to bypass any auth — they used the system as designed

---

## Why the gateway lets this through

`gateway.ts:99-124` — `checkRateLimit()`:

```ts
const { data, error } = await sb.rpc("check_rate_limit", {
  p_key_id: ctx.keyId,
  p_rpm_limit: ctx.rateLimitRpm,
  p_rpd_limit: ctx.rateLimitRpd,
});
```

This is **per-key, global across providers**. There is:
- **No per-provider rate limit** (a single key can dump 60 rpm at OpenAI alone)
- **No per-tenant master-pool budget** (no "$X/day on OpenAI master pool, total")
- **No failure-rate throttle** (100% failure rate from a key = no escalation)
- **No circuit breaker** for the master pool itself (one provider's quota
  going red doesn't trigger any global protection)

`grep -nE 'circuit|exhaust|quota.*master|429.*master' src/lib/gateway.ts` →
**zero matches**.

---

## Sibling Lane 4.84 makes this worse

The COGS-undercount class (Lane 4.84) means we don't even *see* the attack
in our logs as it's happening:

- `cost_to_us = 0` for every failed attacker request (Lane 4.84)
- `cost_to_user = 0` (correct — customer didn't get value)
- Only signal: `gateway_usage_log.error_message` storing the upstream 4xx
- Nothing aggregates per-key failure-rate

By the time a paying customer reports "OpenAI is 429ing for me," the
master-pool window has already been exhausted and the only forensic
breadcrumb is `error_message` text in `gateway_usage_log`.

---

## Concrete impact in dollars (not just availability)

For a paying customer who hits the org-wide-429 wall:

- Their `success: true` attempt costs them credits per Lane 4.51
- An attacker-poisoned 429 returns `success: false` → no charge
- BUT they retry / their agent retries → cumulative latency to user
- AND if the customer's BYOK fallback isn't configured, no work gets done
- Reputation cost: "ToolRoute is unreliable for OpenAI" → churn

Worst case: attacker times the burst to a customer's launch / demo →
targeted DoS against a known ToolRoute customer at a critical moment.

---

## Recommended fix space — `[lane-4.85-impl]` Codex ticket(s)

### MVP (lowest-touch, ship first)

1. **Per-key failure-rate gate**: in `executeAdapter()`, after the result
   comes back, if last 10 calls from this `key_id` are >70% failures AND
   `keySource === "master"`, return 429 with code `failure_rate_exceeded`
   for the next N minutes. Implementation: stored in Redis or a Postgres
   table with TTL. The 10-call sliding window is bounded; can be
   computed from `gateway_usage_log` or held in process memory per Vercel
   instance (tradeoff: Vercel instances are short-lived, so process-mem
   gate is best-effort; Postgres is durable but adds latency).
2. **Per-provider per-key quota**: extend `check_rate_limit` to take
   `p_provider` and enforce a per-provider rpm separately from global.
   For free tier: 5 rpm per provider (instead of 60 global). Limits the
   attack to 5 × (window) per provider per key.

### Architectural (medium-touch)

3. **Master-pool circuit breaker**: track "consecutive 429s from
   master-pool-keyed upstream" per provider. After N in window, reject
   all master-pool calls to that provider with 503 + `Retry-After`,
   force users to BYOK or wait. Protects ALL customers from one
   attacker; coordinates well with Lane 6.5 (BYOK gate gap).
4. **Adapter-side input validation**: each adapter validates inputs
   against provider schema BEFORE firing the fetch. A malformed model
   name, missing required field, etc., should never hit upstream. Kills
   the failure-amplification vector at its source.

### Long-term (higher-touch)

5. **Per-tenant master-pool dollar budget**: e.g. `$0.10/day` of master
   pool for free-tier accounts; `$1/day` for starter; etc. Encoded as
   `gateway_usage_log` aggregation gated in `executeAdapter()`.
6. **Synthetic-input attack detection**: ML/heuristic on input patterns
   to catch "consistently malformed" requests. Risk: false positives
   against legitimate testing.

**Recommended sequencing**:
- MVP item 1 (per-key failure-rate) is the highest-bang-for-buck — kills
  the attack with minimal new infrastructure.
- MVP item 2 (per-provider rpm) is mechanical and addresses the rate
  amplification.
- Architectural item 3 is the right long-term answer but requires
  observability infrastructure.

### Drift guard

`tests/unit/gateway-failure-rate-gate.test.ts` — assert that
`executeAdapter()` rejects after N malformed requests with code
`failure_rate_exceeded`. Sibling pattern to Lane 4.81 / 4.83.

---

## Acceptance

- [ ] Per-key failure-rate gate ships and rejects after 70% failure rate
  in last 10 master-pool calls
- [ ] Per-provider rpm limit enforced separately from global
- [ ] `tests/unit/gateway-failure-rate-gate.test.ts` passes
- [ ] Free-tier (`tr_test_`) keys have a tighter quota envelope than
  paid (`tr_live_`) keys
- [ ] Smoke test: 100 malformed OpenAI calls from a single key get
  blocked after the 10th attempt

## Out of scope

- Customer-fault input validation (out of scope of this lane — Lane 4.51
  handles cost calculation; this lane is about systemic pool protection)
- BYOK isolation (BYOK calls naturally don't deplete master pool, so
  they're not part of the threat model — they're the *defense*)
- Provider-side cooperation on rate-limit headers — outside our control

## Related observations

- **Lane 4.27** (auth/signup rate-limiting) covers the *signup* attack
  vector but not the *post-signup* attack vector. Even with strict signup
  rate limits, an attacker who patiently creates 100 accounts over a
  week can still mount this attack from any one of them.
- **Lane 4.84** (COGS undercount) is the observability sibling — fix it
  and we at least *see* the attack as it's happening.
- **Lane 6.5** (BYOK gate gap) is the customer-facing escape hatch — if
  master pool is in degraded state, well-configured customers can fall
  back to their own keys.

The three together form the master-pool defense triad:
- 4.84 = observability (see the attack)
- 4.85 = prevention (block the attack)
- 6.5 = graceful degradation (customers stay productive when master pool is hot)
