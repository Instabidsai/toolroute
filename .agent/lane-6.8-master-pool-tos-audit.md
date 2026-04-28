# Lane 6.8 — Production master-key pool ToS audit

## Class
P0 architectural finding against Lane 5.2 (production master-pool funded providers). Per Hard Rule #60 (provider-ToS resale grep checklist), each tier-1-funded provider was checked against the standard 17-provider grep list before its master key gets pooled across ToolRoute customers.

## Surface
Lane 5.2 designated 5 providers as the production master-key pool — meaning ToolRoute holds ONE provider key and routes every customer's traffic through it (the "OpenRouter for Tools" pattern):

1. Tavily (search)
2. Firecrawl (scrape)
3. ElevenLabs (TTS)
4. Deepgram (STT)
5. Replicate (model inference)

This audit fetched each provider's terms of service and grep'd for Tier 1 (instant-forbidden) and Tier 2 (BYOK-only) phrases per Hard Rule #60. Audit performed 2026-04-28.

## Threat model
The "service bureau" / "pass-through agent" / "timesharing" pattern is the exact thing aggregator/router products do — one upstream key, many downstream customers, the aggregator collects margin. Three structural risks if this pattern is forbidden by ToS:

- **Account termination** — provider catches the pattern (anomalous traffic shape, abuse complaints, reseller competitor sees us in a comparison) and kills the master key without warning. Every customer immediately stops working.
- **Chargebacks + Stripe risk-team flag** — provider files DMCA / breach-of-contract → Stripe sees pattern → ToolRoute account at risk.
- **Liability for downstream abuse** — TOS shifts blame for downstream misuse to the master-key holder (us) rather than the actual end-user.

The whole financial gateway is built on a contract that may not survive contact with provider legal.

## Per-provider verdict

### Tavily — STRUCTURAL BAN
**URL audited:** https://tavily.com/terms

**Tier 1 hits:**
- `frame or mirror` — FOUND: "frame or mirror any part of the Services"

**Tier 2 hits:**
- `sell, rent, lease, sublicense` — FOUND: "sublicense, resell, distribute, lease, rent, lend, transfer, assign or otherwise dispose of"
- `redistribute` — FOUND (within above)
- `make available to any third party` — FOUND: "Services by end users who are third parties outside of Customer's organization"
- `single account` — FOUND: "each Order Form provides the Customer and its Users with access to a single Account only"

**Verdict:** **STRUCTURAL BAN.** The "single Account only" clause is fatal — pooling one Tavily key across N ToolRoute customers means N customers using one Account, which Tavily explicitly forbids. Section 3.2(ii) broad sublicense/resell ban reinforces it. Cannot be salvaged with adapter changes; needs reseller agreement OR BYOK-only.

### Replicate — STRUCTURAL BAN
**URL audited:** https://replicate.com/terms

**Tier 1 hits:**
- `service bureau` — FOUND: "rent, lease, lend, sell, sublicense, assign, distribute, publish, transfer, or otherwise make available any Services to any person, including on or in connection with the internet or any time-sharing, service bureau, software as a service, cloud, or other technology"
- `time-sharing` — FOUND (same clause)

**Tier 2 hits:**
- `sell, rent, lease, sublicense` — FOUND
- `make available to any third party` — FOUND
- `redistribute` — FOUND (Stability AI additional terms)

**Verdict:** **STRUCTURAL BAN.** Section 2.7(c)(iii) is the textbook "service bureau" clause. Replicate is the most explicit ban in the pool — pooling their key across ToolRoute customers is exactly the prohibited pattern.

### Firecrawl — BYOK-only
**URL audited:** https://www.firecrawl.dev/terms-of-service

**Tier 1 hits:** None

**Tier 2 hits:**
- `sell, rent, lease, sublicense` — FOUND: "Modify, rent, lease, loan, sell, distribute, or create derivative works based on the Services"
- General commercial-use ban — FOUND: "Use the Services for any commercial purposes except as expressly authorized by Firecrawl"

**Verdict:** **BYOK-only at minimum, possibly STRUCTURAL BAN.** "Any commercial purposes except as expressly authorized" means we'd need a written reseller/aggregator agreement from Firecrawl — without that, even charging customers for Firecrawl-backed scrapes through ToolRoute violates the ToS. Adapter must require BYOK until reseller agreement signed.

### ElevenLabs — BYOK-only (likely)
**URL audited:** https://elevenlabs.io/terms-of-use

**Tier 1 hits:** None

**Tier 2 hits:** None (terms are unusually thin on resale language)

**General:**
- Section 5(b): "any use of the Services other than as specifically authorized herein, without our prior written permission, is strictly prohibited"
- Section 4(d) addresses user-content licensing only (not service resale)

**Verdict:** **BYOK-only.** No explicit pooling language but the catch-all "prior written permission" requirement defaults to needing a reseller agreement. The thin ToS may indicate enterprise-tier reseller terms exist as a separate document — Justin should ping ElevenLabs sales before greenlighting pool use.

### Deepgram — DEFERRED (could not audit)
**URLs attempted (all 404):**
- https://deepgram.com/terms-of-service
- https://deepgram.com/legal/terms-of-service-for-customers
- https://deepgram.com/terms-of-use
- https://deepgram.com/legal (redirect missing Location header)

**Marketing-site ToS (incidentally reached at https://deepgram.com/terms-of-service before redirect):**
- "The Site and its contents are solely for your own personal non-commercial use."
- This is for the marketing site, NOT the API. Inappropriate to extrapolate.

**Verdict:** **DEFERRED — needs Justin to fetch the live API customer agreement** (likely behind a sales gate or in DocuSign). Deepgram makes the customer ToS hard to find by URL, which is itself a signal — reseller terms are typically a separate signed contract rather than published Online Terms.

## Summary

| Provider | Tier 1 ban | Tier 2 ban | Verdict |
|----------|-----------|-----------|---------|
| Tavily | frame or mirror | sublicense + single account | **STRUCTURAL BAN** |
| Replicate | service bureau + time-sharing | sublicense | **STRUCTURAL BAN** |
| Firecrawl | none | commercial use req'd auth | **BYOK-only** |
| ElevenLabs | none | catch-all prior permission | **BYOK-only (likely)** |
| Deepgram | UNKNOWN | UNKNOWN | **DEFERRED** |

**4 of 5 audited providers are unsafe to pool. 2 are explicit STRUCTURAL BANs.**

## Architectural impact on Lane 5.2

The current `.agent/codex-build-queue.md` Lane 5.2 plan was: fund 5 master keys, ship the OpenRouter pattern with provider rotation. **That architecture is incompatible with the ToS of 4 of those 5 providers.**

Three strategy options:

### Option A — BYOK-only for these 5
Easiest but breaks the value prop. ToolRoute's pitch is "one key, all tools." Forcing customers to BYOK for the most-funded providers means we ship the registry/router/billing infra but cede the "no key juggling" promise.

### Option B — Negotiate reseller agreements
Right move long-term. Tavily, Firecrawl, ElevenLabs all likely have enterprise/reseller programs. Replicate's clause is harder — they explicitly call out "service bureau, software as a service, cloud" so this needs a custom contract. Sales-led, weeks-to-months timeline.

### Option C — Replace banned providers with reseller-friendly alternates
Tavily → Brave Search API (often more permissive) or Serper (designed-for-resale).
Replicate → Together.ai, Fal.ai, Anyscale (some have explicit aggregator-friendly terms).
Firecrawl → ScrapingBee / Bright Data (reseller programs exist).
ElevenLabs → Cartesia, PlayHT (need ToS check).
Deepgram → AssemblyAI, OpenAI Whisper-via-OpenAI (need ToS check).

## Recommendation

**Block production launch of master-pool execution for these 5 providers.** Until Justin chooses a strategy:
1. Mark the 5 adapters BYOK-required at the runtime gate (extends Lane 4.36 / 6.5 BYOK gate to cover them).
2. Surface "BYOK required" in the docs/copy for these tools (Lane 6.4 copy audit pattern).
3. Add `.agent/lane-6.8-blocked-providers.md` as a permanent registry of providers blocked from pooling so future master-key adds re-check ToS first.

Justin must decide A vs B vs C before Lane 5.2 ships.

## Drift guard
A WebFetch-based vitest is impractical here (each ToS doc is too large for assertion-style checks, and WebFetch caches). Better drift guard:
- Quarterly recheck task in `codex-build-queue.md` — re-grep each pooled provider's ToS for Tier 1/2 phrases.
- Per-adapter `byok_required: true` flag in adapter metadata when ToS audit verdict ≠ "pool-safe".
- CI test: every adapter in `lib/adapters/*.ts` whose provider is on the blocked-pool list MUST have `byok_required: true` in its registry row.

## Sibling rules
- Hard Rule #57 — pre-launch copy audit for tiered-access gates (the "every tool" promise on these providers is now retroactively false until BYOK gate ships)
- Hard Rule #60 — provider-ToS resale grep checklist (this lane is the canonical demonstration of #60 in action)

## Verification
```
$ git log --oneline -1 .agent/lane-6.8-master-pool-tos-audit.md
<sha> Lane 6.8 — Production master-key pool ToS audit
```

## Follow-ups
- **BLOCKER (Justin):** Decide Strategy A/B/C for Lane 5.2 master-pool architecture.
- **Lane 6.8.1 (queued):** Once strategy chosen, write `.agent/lane-6.8-blocked-providers.md` registry + adapter metadata flag.
- **Lane 6.8.2 (queued):** Quarterly ToS recheck cron / doc-only checklist.
- **Lane 6.8.3 (queued):** Audit Deepgram API customer ToS (manual fetch — needs Justin sales-channel access).
- **Lane 6.8.4 (queued):** If Strategy C: alternate-provider ToS audit pass (Brave Search, Serper, Together, Fal.ai, etc.).
