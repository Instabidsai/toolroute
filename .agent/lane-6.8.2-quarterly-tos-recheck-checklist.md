# Lane 6.8.2 — Quarterly ToS recheck checklist (doc-only)

**Created:** 2026-04-28
**Author:** Claude (lane-6.8.2)
**Cadence:** Quarterly (Jan 1, Apr 1, Jul 1, Oct 1)
**Owner:** Whoever runs the quarterly compliance pass — typically Claude with Justin sign-off
**Sister rule:** Hard Rule #60 — provider-ToS resale grep checklist

## Why quarterly

Provider ToS changes are silent — there is no "ToS changelog" feed for any of the providers in our pool/BYOK registry. Industry norm is 30-day notice for material changes, but observed practice is much shorter and most changes ship under the catch-all "we may modify these terms" clause. A quarterly recheck strikes the right balance:

- More frequent than the typical 30-day notice = we catch changes within window
- Less frequent than monthly = doesn't burn cycles for providers whose terms rarely move
- Aligned with calendar-quarter compliance reporting if/when Stripe risk-team or legal asks

The audit itself is fast (~5 min per provider via WebFetch + Tier 1/2 grep) so the whole pass takes ~90 min for 17 providers.

## Trigger conditions (recheck OUT-OF-CYCLE)

Run this checklist immediately, not at next quarter, when ANY of these fire:

1. **A provider sends a ToS update notification email** to support@toolroute.ai or justin@automatedaisolutions.ai
2. **A provider acquires or is acquired by another company** (M&A typically rewrites the ToS within 90 days — Stripe acquired ones notably tighten resale)
3. **A new master-pool provider is added** in Lane 5.x — first audit must be in this same checklist before going live
4. **A customer reports being denied service** by an upstream provider (signal that provider's risk team is now flagging the pattern)
5. **Stripe risk-team flags ToolRoute** for "service-bureau / aggregator" risk — push out the recheck and freeze that provider's master pool

## Provider list

The 5 master-pool providers from Lane 6.8 audit:
1. Tavily — STRUCTURAL BAN (reaudit to confirm still banned, in case enterprise/reseller program launches)
2. Replicate — STRUCTURAL BAN (same)
3. Firecrawl — BYOK-only (watch for reseller program announcement)
4. ElevenLabs — BYOK-only likely (sales-channel terms could change posture)
5. Deepgram — DEFERRED (re-attempt fetching customer ToS each quarter)

The 17 providers from Hard Rule #60 grep checklist (cross-reference Lane 6.6 audit):
- Stripe, Twitter, HubSpot, Sentry, OpenAI, Anthropic, Google, Mistral, AssemblyAI, AWS, GCP, Azure, Cohere, Hugging Face, Pinecone, Weaviate, Qdrant
- Plus any provider added since the most recent quarterly pass

## Per-provider checklist (run for each)

For each provider:

1. **Fetch live ToS URL** — known stable URLs in `.agent/lane-6.8-master-pool-tos-audit.md`. If 404, log under "deferred" and surface to Justin.
2. **Tier 1 grep** (instant-forbidden phrases): `service bureau`, `time-sharing`, `pass-through agent`, `commercially exploit`, `frame or mirror`
3. **Tier 2 grep** (BYOK-only signals): `sell, rent, lease, sublicense`, `redistribute`, `syndicate`, `make available...to third party`
4. **Tier 3 grep** (anti-pooling signals): `share API tokens`, `multiple Applications`, `single account`, `single Account only`
5. **Diff against last quarter** — was Tier 1/2 hit last quarter? Has the clause text changed? Is there a new/removed clause?
6. **Verdict update** — STRUCTURAL BAN / BYOK-only / pool-safe / DEFERRED
7. **If verdict changed**: open a Lane 6.x ticket to update the BYOK gate registry + dashboard copy + adapter metadata.

## Output deliverable

Each quarterly pass writes:
- `.agent/quarterly-tos-audit-YYYY-Q[1-4].md` — fresh audit doc with per-provider verdicts
- Diff vs previous quarter as a section at top
- Any verdict changes get a separate `lane-6.x` follow-up ticket in `codex-build-queue.md`
- If any STRUCTURAL BAN newly applies → page Justin immediately, freeze that provider's master pool same-day

## Failure modes

Things that cause the quarterly pass to be incomplete or wrong:

1. **WebFetch caching** — Cloudflare or Anthropic-side caches can return stale ToS content. Mitigation: append `?ts=<timestamp>` cache-buster, or compare fetch headers (`Last-Modified`, `ETag`) to last-quarter values.
2. **Provider hides ToS behind sales gate** — Deepgram pattern. Mitigation: log under DEFERRED, surface to Justin so sales channel can fetch.
3. **Different ToS for different tiers** — Free, Pro, Enterprise sometimes have different resale clauses (Enterprise often has reseller addenda). Audit tier-relevant copy. Mitigation: explicitly note which tier's ToS was audited; if our pool uses Pro, audit Pro ToS.
4. **Multi-document ToS** — Main ToS + AUP + DPA + Reseller Addendum. Mitigation: enumerate all linked documents, audit each.
5. **Jurisdictional variants** — EU/US/UK ToS can differ. Mitigation: audit US version (our jurisdiction) unless we operate cross-border.

## Drift guard for the checklist itself

This file should be updated whenever:
- A new provider is added to the master pool or BYOK registry
- Hard Rule #60's grep list expands (new failure-backed phrase observed)
- A new failure mode is observed during a quarterly pass

## Status

- [x] Checklist authored (this doc)
- [ ] First scheduled run: 2026-07-01 (Q3)
- [ ] Calendar reminder set: out-of-band, Justin to set
- [ ] Codex-build-queue.md updated with `lane-6.8.2-q3-2026` task

## Sibling rules

- Hard Rule #60 — provider-ToS resale grep checklist (the canonical taxonomy this pass uses)
- Hard Rule #57 — pre-launch copy audit for tiered-access gates (verdict changes require copy updates)
- Lane 6.8 — original master-pool ToS audit (this checklist generalizes that pass)
