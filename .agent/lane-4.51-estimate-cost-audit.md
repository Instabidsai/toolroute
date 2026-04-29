# Lane 4.51 — `estimateCost` zero-return / underestimation audit

## Threat model

`gateway.ts` line 227-238 gates execution on credit balance:

```ts
const estimatedCost = adapter.estimateCost(operation, input);

if (ctx.creditBalance < estimatedCost && estimatedCost > 0) {
  throw new GatewayError("Insufficient credits...", 402, "insufficient_credits");
}
```

The `&& estimatedCost > 0` short-circuits the balance check whenever the
adapter returns 0. Two failure modes follow:

1. **Zero-balance bypass.** Any adapter returning 0 lets a $0-credit
   `tr_test_` key call upstream master-pool providers without a credit
   guard. Even free upstream operations consume our infra rate limits
   and may be DoS-amplified.

2. **COGS underestimation.** An adapter returning a flat rate against a
   provider that bills variably (per-token, per-minute, per-page) eats
   the difference between `estimateCost` and `actual_cost` whenever the
   master-pool key is used. A 256KB body to GPT-4-class chat ≈ 64K
   tokens ≈ $1.92 input cost. A flat $0.005 estimate passes the gate
   for any user with ≥ $0.005 — we eat $1.91 COGS per call.

## Findings

Audited every `estimateCost` body in `src/lib/adapters/`. 51 adapters.

### Class A — `return 0` literal (4 hits)

| Adapter | Operation | Justification | Risk |
|---|---|---|---|
| `higgsfield` | `list-models` | catalog read | low — free upstream, but bypasses balance gate |
| `openai` | `moderation` | officially free per OpenAI ToS | low — but if OpenAI starts charging, silent COGS |
| `replicate` | `list-models` | catalog read | low — also gated by Lane 6.7 (BYOK-required) |
| `textbelt` | `check-status` | cheap status poll | low |

All four are real free-tier operations. **The structural smell** is
relying on the gateway's `> 0` guard for free tiers instead of using a
"free-tier ping cost" floor (e.g. `0.0001`). A future PR adding a
new free-looking op via `return 0` could land a real bypass.

### Class B — flat-rate on variable-priced providers (3 hits)

| Adapter | Operation | Estimate | Real cost driver | Master-pool gating |
|---|---|---|---|---|
| `openai` | `chat` | flat $0.005 | per-token (input + output) | AMBIGUOUS → BYOK-required after Lane 6.5-impl |
| `deepgram` | `transcribe`, `transcribe-url` | flat $0.005 | per audio minute | AMBIGUOUS → BYOK-required after Lane 6.5-impl |
| `firecrawl` | `crawl` | flat $0.01 | per page crawled | AMBIGUOUS → BYOK-required after Lane 6.5-impl |

Worst-case per-call COGS exposure (256KB body, 60-min audio,
1000-page crawl):

- `openai chat` master pool: ~$1.92 vs. $0.005 estimate → **$1.91 leak**
- `deepgram transcribe`: ~$0.43 vs. $0.005 estimate → **$0.42 leak**
- `firecrawl crawl`: ~$1.00+ vs. $0.01 estimate → **$0.99+ leak**

**Live risk**: pre-Lane-6.5-impl deploy. Today, any of these can be
master-pool-routed if Justin has provisioned a `tool_providers` row.

**Post Lane 6.5-impl** (Codex Task #23): all three slugs land in
`AMBIGUOUS_DEFAULT_BYOK_SLUGS` (`.agent/lane-6.7-verified-byok-slug-list.md`)
and are gated to BYOK. Master-pool path is closed → user's own key
pays the upstream cost. COGS leak vanishes. Underestimate then only
affects *user's* balance ceiling — their problem, not ours.

### Class C — input-scaled (already correct, for reference)

`claude` (chat/complete), `elevenlabs` (text-to-speech), `deepl`,
`tavily` (depth-based) — all scale with input. These are the model.

## Why no live exposure (and why this still matters)

- All three Class-B adapters are slated for BYOK-required gating in
  Lane 6.5-impl. Until that ships, master-pool routing for them is
  contingent on Justin having provisioned `tool_providers` rows. Per
  the anon probe `tool_providers` is admin-locked (Lane 4.12), so I
  can't enumerate rows from here. Treat as latent.
- Class A is structural smell, not a live leak — the four ops are
  legitimately free upstream today.

## Fix proposed

### 1. Defense-in-depth drift guard (this PR)

Vitest in `tests/unit/estimate-cost-no-zero.test.ts` walks
`src/lib/adapters/`, parses each `estimateCost` body, and fails if any
literal `return 0;` (or `return 0.0;`) appears. Allowlist for known
free-tier ops with explicit justification.

This blocks the structural-smell class regardless of provider gating —
ensures every adapter charges *at least* a free-tier ping cost so the
balance gate always fires.

### 2. Class B remediation (NOT in this PR)

Each Class-B finding's right fix is a per-adapter scaler, mirroring
`claude-adapter.ts:138` pattern. Deferred:

- If Lane 6.5-impl ships first, the leak class closes structurally.
  Class B becomes "user balance UX" rather than "our COGS leak", and
  the urgency drops.
- If Justin opens master-pool routing on any of the three after Lane
  6.5-impl (signed waiver from provider), per-adapter scaler must ship
  same-deploy.

Filed as Lane 4.52 follow-up in tasks if Justin elects to keep any of
these on master pool.

## Drift guard test contents

```ts
// tests/unit/estimate-cost-no-zero.test.ts
// Walks every src/lib/adapters/*-adapter.ts and rejects literal
// `return 0` in estimateCost bodies. Allowlist for legitimately-free
// upstream ops (catalog reads, moderation).
```

Allowlist:
- `higgsfield` op `list-models` — Higgsfield ToS confirms list ops are free.
- `openai` op `moderation` — OpenAI omni-moderation officially free.
- `replicate` op `list-models` — public catalog.
- `textbelt` op `check-status` — Textbelt status endpoint is free.

Adding any `return 0` outside the allowlist fails CI and forces author
to either (a) use `return 0.0001` (free-tier ping cost) or (b) extend
the allowlist with a justification line.

## Currently exploitable?

No. Class A is real free-tier ops. Class B requires `tool_providers`
rows for openai/deepgram/firecrawl — admin-only. Lane 6.5-impl will
close Class B structurally before any master-pool funding decision.
This PR ships only the structural-smell guard.
