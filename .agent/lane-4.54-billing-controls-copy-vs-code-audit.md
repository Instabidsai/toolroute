# Lane 4.54 — billing-control claims: copy promises ≠ code reality

**Status:** `max_price` honor implemented (this PR). Three sibling claims still unimplemented; flagged for Justin decision (build vs delete copy).
**Severity:** P2 (false marketing) — auto-elevates to P1 if any customer pays for a tier referencing these features.
**Date:** 2026-04-28
**Sibling:** Lane 6.3 (pre-launch copy audit pattern), Lane 4.51/4.53 (gateway billing surface).

## What changed in this PR

`gateway.ts:executeToolRequest` now accepts an `options.max_price` parameter. When present:

```ts
if (typeof options?.max_price === "number" &&
    options.max_price >= 0 &&
    estimatedCost > options.max_price) {
  throw new GatewayError("Estimated cost $X exceeds requested max_price $Y",
                         402, "max_price_exceeded");
}
```

`/api/v1/execute/route.ts` threads `body.provider?.max_price` through. MCP and A2A protocols do not natively expose this field — they pass `undefined` (no behavior change).

This restores truth to one specific marketing claim: blog `ai-agent-tool-billing-credits/page.tsx:438-443` "Per-Call Ceiling — Set a max cost per individual execution. If a tool call would exceed this, the gateway rejects it before executing."

## What is STILL false in marketing copy

### Claim 1: Monthly Limit (FALSE)

`src/app/blog/ai-agent-tool-billing-credits/page.tsx:430-435`:
> "Hard cap on total monthly spend. Once reached, all paid tool calls return a 429 with a clear message."

Plus three blog code samples showing `"monthly_limit": 10000` as if it were a real field on key settings.

**Reality:** No `monthly_limit` column on `api_keys`, no enforcement in `validate_api_key` RPC, no rejection logic in gateway. Customer can set the field via `PATCH /api/v1/settings`, get a 200 back, and there will be no monthly cap.

**Path forward (pick one):**
- **Build:** add `monthly_limit_cents` column on `api_keys`, sum `usage_events.cost_to_user` over current calendar month in `validate_api_key`, throw `GatewayError(429, "monthly_limit_exceeded")`. ~30 LOC + migration.
- **Delete copy:** remove the "Monthly Limit" block + the `monthly_limit` field from the three code samples. ~20 line deletions.

### Claim 2: Balance Alerts via webhook (FALSE)

`src/app/blog/ai-agent-tool-billing-credits/page.tsx:445-451`:
> "Webhook notifications when your balance crosses thresholds you define. Wire them to Slack, email, or your agent's decision loop."

Also `src/app/docs/page.tsx:2039`:
> "Webhook event system for tool executions, balance alerts, and key lifecycle"

**Reality:** No `webhooks` table, no event dispatcher, no signing-secret column. `grep -rn 'webhook' src/` shows only Stripe webhook ingress (one direction, inbound only).

**Path forward:**
- **Build:** ~3-4 days of work. Webhooks table, async dispatcher, retry queue, signing-secret HMAC, settings UI, docs. Real product surface, not a 1-line fix.
- **Delete copy:** remove block from blog + docs page reference.

### Claim 3: max_latency_ms (DECLARED, NOT HONORED)

`gateway-types.ts:143`:
```ts
max_latency_ms?: number;
```

`public/openapi.json:1120`:
```json
"max_latency_ms": { "description": "Maximum acceptable latency in milliseconds" }
```

**Reality:** Never read. `adapter.execute()` is awaited unconditionally; if upstream takes 30s the customer pays even though they passed `max_latency_ms: 5000`.

**Path forward:**
- **Build:** wrap `adapter.execute(...)` in `Promise.race([..., timeout(max_latency_ms)])`. ~10 LOC. Note: aborting upstream HTTP requires AbortController plumbing into adapters — not all 51 adapters honor abort signals.
- **Delete:** drop the field from `gateway-types.ts:143` AND `public/openapi.json:1120` AND `public/.well-known/openapi.json:1120`.

### Claim 4 (smaller): allow_fallbacks (DECLARED, NOT HONORED)

Sibling unused field: `provider.allow_fallbacks?: boolean` declared at `gateway-types.ts:141`. Documented in openapi.json:1111-1114 ("Whether to fall back to alternative providers on failure"). No fallback router exists. Each adapter call is single-provider. Either delete or build out a fallback chain (substantial — it's the OpenRouter feature parity story).

## Risk if these stay false

Per Hard Rule #57 (pre-launch copy audit): copy that promises features the code doesn't ship is a P1 the moment a customer pays for a tier that references those features. Today no tier explicitly markets these — they're discoverable in blog posts and docs but not on `/pricing`. So this is a **latent Lane 6.3-class issue**.

Specific exposure paths:
- Customer reads blog → assumes per-key monthly cap exists → builds an LLM agent expecting hard cap → gets billed unexpectedly when agent loops → "you advertised this feature".
- Third-party tool (LangChain, CrewAI, etc.) reads `openapi.json` → generates client SDK with `max_latency_ms` and `max_price` → customer's agent passes both → only `max_price` works post-this-PR; `max_latency_ms` silently ignored.
- Auditor (security/billing/SOC2) sees the contract claims, asks for proof of enforcement → deny.

## Recommended sequencing

1. **This PR**: ship `max_price` honor (concrete progress, ~7 LOC).
2. **Lane 4.55** (immediate follow-up): ship a **vitest drift guard** that `grep`s blog + docs source files for billing-control feature names and asserts each is either implemented OR explicitly allowlisted as "unbuilt — copy will be removed before next deploy". Same pattern as Lane 4.53. Forces copy/code reconciliation in code review.
3. **Lane 6.9** (Justin decision): for each false claim, decide **build** or **delete copy**. Default to delete unless tier-revenue depends on it.
4. **Lane 4.55a** (after #3): if max_latency_ms is built, add Promise.race wrapper in gateway. If deleted, strip from gateway-types + both openapi.json files.

## Drift guard NOT shipped this PR

A clean drift guard for "copy claims feature X" → "gateway implements feature X" is non-trivial because the claims are prose, not patterns. Lane 4.55 will scope a regex-based version (search blog files for `monthly_limit`, `max_price`, `max_latency_ms`, `webhook`, `balance alert` keywords; require each to either appear in `gateway.ts` honoring code OR a top-of-file allowlist comment).

## Cross-applies to

Same copy/code drift class on every product where marketing site and gateway live in the same repo:
- **DropClose** — pricing-page features must map to gateway enforcement.
- **CallTwin** — call-budget claims should map to dispatcher rejection.
- **AffixedAI** — consultation-cost-limit claims should map to backend cap.
- **PureUSPeptide2** — out-of-scope (WooCommerce-driven).

## Currently exploitable?

**No** in the security sense — these are honesty-of-claim issues, not RCE/auth bypasses. But every customer who reads the blog and configures their integration based on it will hit "did nothing" on three of four advertised guardrails.

## Files touched in this PR

- `src/lib/gateway.ts` (executeToolRequest signature + max_price gate)
- `src/app/api/v1/execute/route.ts` (thread provider.max_price)
- `.agent/lane-4.54-billing-controls-copy-vs-code-audit.md` (this file)

## Files NOT touched (intentional — defer to Lane 6.9 decision)

- `src/lib/gateway-types.ts` (max_latency_ms, allow_fallbacks still declared)
- `public/openapi.json` (max_latency_ms, allow_fallbacks still claimed)
- `public/.well-known/openapi.json` (same)
- `src/app/blog/ai-agent-tool-billing-credits/page.tsx` (Monthly Limit + Balance Alerts blocks + monthly_limit code samples)
- `src/app/docs/page.tsx:2039` (webhook claim)
- `src/app/glossary/page.tsx` ("hard spending limits" general claim)
