# Lane 4.53 — `actual_cost` adapter return path is dead in adapters but live in gateway

**Status:** Audit doc + drift guard vitest shipped.
**Severity:** P3 today (dead path) → P1 latent (becomes silent billing override the moment any adapter populates it).
**Date:** 2026-04-28
**Sibling:** Lane 4.51 (estimateCost return-0). Same threat class — adapter-controlled cost surface — different code path.

## Threat model

`src/lib/gateway.ts:330`:

```ts
const actualCost = result.actual_cost ?? estimatedCost;
const finalCost = result.success ? actualCost : 0;
```

`AdapterResult.actual_cost?: number` is declared in `src/lib/gateway-types.ts:107`:

```ts
export interface AdapterResult {
  ...
  /** If set, overrides the estimateCost calculation with the actual cost */
  actual_cost?: number;
}
```

The override is **adapter-controlled** and **unbounded**. There is no:
- Upper bound (e.g., `Math.min(actual_cost, estimateCost * 100)`)
- Cost-table sync check (user's quoted price ≠ what they pay)
- Logging of the override (`gateway_usage_log` records `cost_to_user` only — no field for "this differed from estimate by Nx")

Today this is dead code: a grep across all 51 adapters in `src/lib/adapters/` returns **zero** matches for `actual_cost`. Every user is billed `estimateCost(operation, input)`. The override path is purely latent.

## Why latent matters

Three risks if a future adapter populates `actual_cost`:

1. **Bug-induced overcharge.** Adapter author writes `actual_cost: result.totalTokens` (raw number, not `* costPerToken`). User pays $50,000 for a 50K-token call instead of $0.05.
2. **Cost-table desync.** `/cost-table` page (and `/api/v1/tools?format=openai` cost data) reads `estimateCost` for marketing. Adapter overrides it at runtime. User sees $0.005 quoted, gets billed $1.92 (Lane 4.51 Class B realized at runtime).
3. **Compromised-adapter mint.** A malicious adapter PR that returns `actual_cost: 0.0001` post-paid-call gives the adversary effectively-free upstream usage on ToolRoute's master pool. Lane 4.51's drift guard locks `estimateCost` against `return 0`; this lane locks the runtime sibling.

## Sibling finding — `ExecuteRequest.provider.max_price` is ignored

`src/lib/gateway-types.ts:142`:

```ts
provider?: {
  prefer?: string;
  allow_fallbacks?: boolean;
  max_price?: number;
  max_latency_ms?: number;
};
```

`grep -r 'max_price\|max_latency_ms' src/` returns **only the interface declaration**. The fields are never read by gateway.ts, route handlers, or adapters.

User passes `provider: { max_price: 0.001 }` expecting a cost cap; gateway silently ignores it and bills `estimateCost`. If a customer is auditing their bill against API contracts, this is a "you charged me X, but I told you max Y" complaint.

Two fixes possible:
- **Honor it:** add `if (estimatedCost > body.provider?.max_price) throw 402 "max_price exceeded"` at gateway.ts:228. Simple, ~5 LOC.
- **Remove it:** delete the fields from `ExecuteRequest.provider` and the marketing claim that ToolRoute supports cost caps.

Out of scope for this PR — flagged as Lane 4.54 follow-up.

## Drift guard shipped

`tests/unit/actual-cost-not-returned.test.ts` walks `src/lib/adapters/*-adapter.ts` and fails CI if any adapter file contains a `actual_cost:` field in a returned object literal. The regex anchors on the `actual_cost:` key in object position, after `return {` or `return { ... ` patterns, to avoid false positives on string/comment matches.

When a future adapter author adds `actual_cost`, the test fails with this guidance:

```
Lane 4.53: <file> populates actual_cost. Before unblocking, add to gateway.ts:
  1. Upper bound: actual_cost <= Math.max(estimateCost * 5, $0.01)
  2. Log when actual_cost > 1.5x estimateCost (surface in usage log)
  3. Update cost-table page if user-facing displayed cost can drift
Then add this adapter+operation to ALLOWLIST in this test.
```

## Allowlist

Empty by design. No adapter is currently allowlisted because no adapter populates `actual_cost`. Adding the first entry forces a deliberate code-review conversation about which of the three risks above applies to that adapter.

## Cross-applies to

Same dead-but-live audit class on every gateway-style aggregator that has both an `estimate` and `actual` cost surface:

- **JarvisCRM** (auto-generated billing) — interface declarations should not outlive their implementations.
- **DropClose** (lead-cost tiering) — same.
- **AffixedAI** (consultation-cost variance) — same.
- General lesson: **interface-but-no-impl is a latent bug class**. Either implement the field or delete it; "leave it for later" is a foot-gun where future contributors fill it in unaware of the surrounding constraints.

## Currently exploitable?

**No.** Zero adapters populate `actual_cost`. Path is genuinely dead. Drift guard in this PR locks the surface so it can't silently flip live in a future adapter PR.
