# Lane 4.84 — COGS Undercount on Adapter-Failure Path (financial accuracy)

**Class**: silent under-recording of provider COGS when an adapter fires a paid upstream call but returns `success: false`
**Severity**: MEDIUM (financial-accuracy class — affects unit economics + provider-invoice reconciliation, not customer-facing revenue leak)
**Date**: 2026-04-28
**Sibling lanes**: 4.10 (COGS leak audit — exposure class), 4.51-4.55 (cost calculation correctness), 4.63 (Stripe refund clawback)

---

## Symptom

`gateway.ts` line 333:

```ts
const finalCost = result.success ? actualCost : 0;

if (keySource === "master" && result.success) {
  if (masterCostModel === "per_unit" && result.units_consumed) {
    costToUs = masterCostPerCall * result.units_consumed;
  } else {
    costToUs = masterCostPerCall;
  }
}
```

`costToUs` is initialized to `0` at line 243 and only mutated inside the
`result.success` branch. When the adapter fires a master-pool fetch and the
upstream returns 4xx/5xx (or the response body indicates failure), the
adapter returns `success: false`, and we log `cost_to_us: 0` — even though
we paid for the upstream call.

---

## Why this matters for a "production-ready financial gateway"

1. **Monthly reconciliation breaks**: Provider invoice (OpenAI, Anthropic,
   Apollo, Tavily, etc.) will exceed `SUM(gateway_usage_log.cost_to_us)`
   for the period. Margin calculation overstates margin by the
   undercount delta.
2. **No anomaly detection**: If a provider has a billing bug or we get
   compromised and an attacker drains our master pool with malformed
   inputs that intentionally fail, we have no internal log to reconcile
   against.
3. **Hard Rule #7 violation in spirit**: "X% working, Y% broken" — our
   COGS table claims to be the source of truth for what we paid
   providers, but it silently undercounts. A naïve operator looking at
   the table would draw wrong conclusions about unit economics.

---

## Concrete failure modes

### Class A — provider charges for failed requests (per-attempt billing)

Some providers count any HTTP request against quota or bill per-attempt
regardless of outcome:

- **ScraperAPI / Outscraper / Tavily** — proxy/scraper providers
  generally bill per-attempt
- **Apollo (mixed_people/search)** — credits debited on request, even if
  the response is empty or 4xx (per Apollo billing docs)
- **Some image-gen providers** — generation credit deducted before
  validation passes (e.g., a 422 still costs)

For these, every customer-facing failure is a silent COGS leak.

### Class B — provider doesn't bill, but we still get rate-limited

Most providers (OpenAI, Anthropic, Resend, SendGrid) don't charge for
4xx/5xx. Class B isn't a financial leak — but it's a quota-burn we don't
log, which limits our ability to debug "why did our master pool hit
its OpenAI minute-quota at 11pm?"

### Class C — adapter pre-fetch failures

If the adapter validates input before fetching (returns `success: false`
without firing upstream), `costToUs` correctly stays 0. **This is the
correct behavior** — the audit fix must not change this case.

---

## Per-adapter classification (from origin/master, 51 adapters)

I have not done a full per-adapter breakdown for which providers bill
per-attempt vs per-success. The Lane 6.8 master-pool ToS audit covered
5 funded providers (the real money). Pulling those into this finding:

| Provider | Master-pool funded? | Bills on failure? | Severity |
|---|---|---|---|
| OpenAI | ✓ | No (free 4xx) | Class B |
| Anthropic (Claude) | ✓ | No | Class B |
| Resend | ✓ | No | Class B |
| Tavily | ✓ | **Yes (per-attempt)** | **Class A** |
| Apollo | ✓ | **Yes (mixed_people)** | **Class A** |

The two provider-paid masters (Tavily and Apollo) are exactly the two
on the body-cred-leak track (Lanes 4.76, 4.79) — they're our highest-
exposure providers in this class too.

---

## Recommended fix — `[lane-4.84-impl]` Codex ticket

### Option 1 — minimum-viable bookkeeping correction (preferred)

When `keySource === "master"` AND we fired a fetch (i.e., the adapter
got past input validation), record `cost_to_us = masterCostPerCall`
regardless of `result.success`. Add an opt-out for adapters that pre-
flight validate (which they should signal via `result.upstream_fired`).

Required changes:

1. `AdapterResult` type adds `upstream_fired?: boolean` — adapter sets
   this `true` immediately before the first paid `fetch()` call.
2. `gateway.ts` records `cost_to_us = masterCostPerCall *
   (units_consumed ?? 1)` when `keySource === "master" &&
   result.upstream_fired === true`, separate from the success branch.
3. New column `gateway_usage_log.cost_to_us_billed` stays the
   success-only number (current behavior); existing `cost_to_us` column
   is repurposed to "what we paid the provider" (success or fail).
4. Monthly margin report queries SUM(cost_to_us) for COGS and
   SUM(cost_to_user) for revenue.

### Option 2 — separate `cogs_log` table

If renaming the column is too disruptive, create a parallel
`cogs_log(id, request_id, provider, attempted_cost, billed_cost,
created_at)` table. Adapter signals via `upstream_fired`; gateway
inserts a row in `cogs_log` always when master + fired. Reconciliation
queries `cogs_log.attempted_cost`.

### Option 3 — defer to per-provider classification

For providers in Class B (free 4xx), do nothing — current behavior is
correct for those. For Class A providers (Tavily, Apollo, plus any
future per-attempt-billing providers), wire `upstream_fired = true`
explicitly. Migration is gradual.

**Recommendation**: Option 3 first (covers Tavily + Apollo, our actual
exposure today), with Option 1 as the architecturally-clean follow-on
when we add a third Class-A provider.

### Drift guard

`tests/unit/cogs-recording-coverage.test.ts` — fails if any adapter on
a known Class-A provider (allowlist of slugs) doesn't set
`upstream_fired: true` in its result on the failure path. Initial
allowlist = `["tavily", "apollo"]`. Sibling pattern to Lane 4.81
(adapter URL-cred-leak drift guard).

---

## Acceptance

- [ ] Tavily adapter sets `upstream_fired: true` on its failure path
- [ ] Apollo adapter sets `upstream_fired: true` on its failure path
- [ ] `gateway.ts` records `cost_to_us = masterCostPerCall` when
  `keySource === "master" && result.upstream_fired === true`,
  regardless of success
- [ ] Drift test fails if a Class-A adapter forgets `upstream_fired`
- [ ] Monthly margin report shows new "attempted-but-failed COGS" row
  and reconciles to provider invoice within rounding

## Out of scope

- Class B providers (OpenAI, Anthropic, Resend) — no fix needed today
- Per-token vs per-call billing model differences (Lane 4.51 already
  handles `units_consumed` math)
- Customer-facing refunds — customer is correctly NOT charged on
  failure (Lane 4.51-4.55 invariant); this lane only fixes our
  internal COGS bookkeeping
- Real-time anomaly detection on provider-billing variance — that's a
  separate observability lane

## Related findings

- Lane 4.10: COGS exposure class (preventing customers from seeing our
  COGS) — this lane is the inverse: making sure we ourselves see all of
  our COGS
- Lane 4.51: estimateCost zero-return audit — ensures we never charge
  $0 erroneously; this lane is the cost-tracking sibling
- Lane 4.55: cost calculation correctness post-Lane 4.11 refactor —
  same area of code, different invariant
