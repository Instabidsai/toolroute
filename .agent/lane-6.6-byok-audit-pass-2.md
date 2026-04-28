# Lane 6.6 — Provider ToS resale audit, pass 2 (remaining 43 adapters)

**Owner:** Claude (auditor)
**Status:** in-progress (6 of 43 verified this tick)
**Started:** 2026-04-28
**Sibling:** `.agent/lane-6-resale-audit.md` (Lane 6.1 — 8 of 51 audited)
**Feeds:** `.agent/lane-6.5-byok-gate-gap-audit.md` (PR #23) — `BYOK_REQUIRED_SLUGS` Set

## Scope

Lane 6.1 covered 8 high-traffic LLM/AI providers. ToolRoute now ships **51 adapters** total. This lane closes the audit gap on the remaining 43, with priority on payment / communications / business-data adapters whose ToS most likely forbid service-bureau patterns.

## Adapter inventory (51 total)

```
apollo, auto, calendar, claude, context7, creatify, creatomate, dataforseo,
deepgram, deepl, drive, elevenlabs, exa, firecrawl, github, heygen, higgsfield,
hubspot, image-gen, linear, linkedin, mux, notion, openai, outscraper, pdf,
pexels, playwright, postiz, removebg, replicate, resend, screenshot, search,
sendgrid, sentry, sheets, shippo, shotstack, slack, stripe, supabase, tavily,
textbelt, toolroute, twilio, twitter, unsplash, vapi, whisper, youtube
```

### Already audited in Lane 6.1 (8)
claude, deepgram, elevenlabs, firecrawl, openai, replicate, resend, tavily

### ToolRoute-internal aggregators (skip — not third-party)
**Likely:** auto, image-gen, search, toolroute (need to verify each is purely an aggregator with no upstream provider — `pdf`, `screenshot` could go either way)

### Pass-2 audit queue (43, prioritized by structural-resale risk)

**Tier A — payments + voice/comms (highest enforcement risk):**
stripe ✓, twilio ✓, vapi ✓, sendgrid ⏳, textbelt, shippo

**Tier B — data infra + auth-gated business APIs:**
supabase ✓, github ✓, sentry, hubspot ⏳, apollo, notion, slack, linkedin, drive, calendar, sheets, twitter

**Tier C — AI/ML inference (LLM-adjacent):**
deepl, exa ⏳, heygen, higgsfield, mux, creatify, creatomate, shotstack, whisper, removebg, dataforseo, outscraper, postiz, context7

**Tier D — stock media (lower risk, often permissive):**
pexels, unsplash, youtube, playwright, linear, pdf, screenshot, image-gen, search, auto, toolroute

✓ = verified this tick · ⏳ = WebFetch failed, retry next tick

---

## Per-provider verdicts (6 verified this tick)

### Stripe
- **Source:** https://stripe.com/legal/ssa
- **Date checked:** 2026-04-28
- **Resale clauses:**
  - **§1.2(a)(viii):** "act as service bureau or pass-through agent for the Services with no added value"
  - **§2.5:** "User must not rent, lease, lend, sell, share, redistribute, or sublicense the Stripe Technology"
  - **§1.2(a)(v):** "rent, lease, or otherwise transfer User's rights granted under Section 1.1"
- **Verdict:** **`byok_only` for the gateway adapter. `master_pool_ok` for ToolRoute's own billing.**
- **Critical distinction:**
  - ToolRoute's *own* Stripe account, used to bill ToolRoute customers for ToolRoute credits, is **normal commercial use** — fine.
  - The `stripe` adapter in the gateway, which lets ToolRoute customers run `gateway.execute({tool: "stripe/create-payment-link", ...})` via ToolRoute's pooled Stripe account, is **service bureau** under §1.2(a)(viii) — direct breach.
- **Implication:** stripe adapter must be added to `BYOK_REQUIRED_SLUGS`.
- **Connect carve-out:** Stripe Connect exists for marketplace platforms but is a separate product framework with its own onboarding flow per end-customer. ToolRoute would need to onboard each customer to Connect, not pool through one account.

### Twilio
- **Source:** https://www.twilio.com/en-us/legal/tos
- **Date checked:** 2026-04-28
- **Resale clause (§2.2(b)):** "not transfer, resell, lease, license, or otherwise make available the Services to third parties (except to make the Services available to your End Users)"
- **End User carve-out:** Permits "Customer Services" defined as "software application or other products and services provided by you" routing Twilio to End Users.
- **Verdict:** **`ambiguous_ask_legal` leaning byok_only.** Same gray zone as Tavily — ToolRoute customers using Twilio could be either End Users (ok) or unrelated third-party businesses (forbidden).
- **Multi-tenant friction:** §2.2(a-d) puts End User compliance burden on Customer — single account serving 100+ unrelated businesses is operationally fragile even if technically defensible.
- **Implication:** Default byok_only at launch. Justin emails twilio-legal for written confirmation if pursuing master-pool.

### Vapi
- **Source:** https://vapi.ai/terms-of-service
- **Date checked:** 2026-04-28
- **Resale clause (§2(a)):** "do anything with the Services other than use them for your own use as intended under these Terms, including not to license, sell, rent, lease, transfer, assign, reproduce, distribute, host or otherwise commercially exploit the Services" + non-sublicensable.
- **Verdict:** **`byok_only` (Replicate-class structural ban).** "Host or otherwise commercially exploit" closes the gateway-adapter pattern firmly.
- **Implication:** Add to `BYOK_REQUIRED_SLUGS`. This is the 5th confirmed structural ban (joining claude, replicate, resend, elevenlabs).

### Supabase
- **Source:** https://supabase.com/terms
- **Date checked:** 2026-04-28
- **Resale clause (§2(c)(ii)):** "Customer shall not...rent, lease, lend, sell, license, sublicense, assign, distribute, publish, transfer, or otherwise make available the Services or Documentation to any third party"
- **Sublicense (§2(a)):** "non-exclusive, non-transferable...non-sublicensable basis"
- **Verdict:** **`byok_only` for the gateway adapter. `master_pool_ok` for ToolRoute's own database.**
- **Critical distinction (same as Stripe):**
  - ToolRoute *uses* Supabase as its primary database — that is normal SaaS consumption, not resale.
  - The `supabase` adapter that lets ToolRoute customers `gateway.execute({tool: "supabase/execute-sql", ...})` against ToolRoute's pooled Supabase account routes a third-party customer's SQL through ToolRoute's Supabase = §2(c)(ii) breach.
- **Implication:** supabase adapter must be added to `BYOK_REQUIRED_SLUGS`. ToolRoute's own data layer is unaffected.

### GitHub
- **Source:** https://docs.github.com/en/site-policy/github-terms/github-terms-of-service
- **Date checked:** 2026-04-28
- **Relevant clauses:**
  - "You may not share API tokens to exceed GitHub's rate limitations."
  - "GitHub may offer subscription-based access to our API for those Users who require high-throughput access or access that would result in resale of GitHub's Service." (= reseller path EXISTS but requires explicit subscription)
  - "Your login may only be used by one person — i.e., a single login may not be shared by multiple people."
- **Verdict:** **`ambiguous_ask_legal` — leaning master_pool_ok ONLY with GitHub-issued subscription.** Without that, single-PAT-many-customers risks the rate-limit-share clause and arguably the resale clause.
- **Implication:** Default byok at launch. Justin to confirm with GitHub whether ToolRoute qualifies for the resale subscription tier; absent confirmation, add to `BYOK_REQUIRED_SLUGS`.

---

## Cross-cutting finding — ToolRoute-as-customer vs. adapter-as-gateway

**Pattern surfaced this tick (stripe + supabase):**
ToolRoute *uses* both Stripe (for its own billing) and Supabase (as its primary DB). Neither is resale — that's normal commercial consumption.

But ToolRoute *also ships gateway adapters* for both, allowing third-party ToolRoute customers to make Stripe/Supabase API calls through ToolRoute's pooled accounts. **That second layer is the structural breach.**

This dual-role pattern likely repeats for any provider where ToolRoute is itself a paying customer. Adapters whose underlying provider ToolRoute also uses internally need a second-pass review specifically on the gateway-adapter pattern, regardless of whether the underlying ToS is otherwise compatible.

Provider candidates with likely ToolRoute-internal usage (Justin to confirm):
- **stripe** — billing
- **supabase** — primary DB
- **resend** — own welcome emails (Lane 6.1 confirmed)
- **vapi** — likely no internal use
- **openai / claude** — likely internal classification + system-prompts (Lane 6.1 noted)
- **sentry** — possibly internal error monitoring
- **github** — possibly source-of-truth (Instabidsai/toolroute repo)

---

## Updated `BYOK_REQUIRED_SLUGS` candidate list

**Confirmed structural ban (master-pool = direct breach):**
- claude (Lane 6.1, Anthropic D.4)
- replicate (Lane 6.1, §2.7(c)(iii) "service bureau" enumeration)
- elevenlabs (Lane 6.1, OEM Terms required)
- resend (Lane 6.1, sender-domain mechanic)
- **stripe (Lane 6.6, §1.2(a)(viii) "service bureau or pass-through agent")**
- **supabase (Lane 6.6, §2(c)(ii) explicit "make available...to any third party")**
- **vapi (Lane 6.6, §2(a) "host or otherwise commercially exploit")**

**Ambiguous — default byok_only at launch pending Justin outreach:**
- openai, firecrawl, tavily, deepgram (Lane 6.1)
- twilio, github (Lane 6.6)

That's **7 confirmed + 6 ambiguous = 13 of 51** adapters that should be on the BYOK gate at launch, up from Lane 6.5's 4-slug baseline. **Tripling the gate set.**

If Lane 6.5's `BYOK_REQUIRED_SLUGS` Set ships with only the original 4, ToolRoute is still exposed on stripe + supabase + vapi at minimum.

---

## Next steps (subsequent loop ticks)

1. Retry sendgrid + hubspot + exa with corrected URLs
2. Audit Tier B remainder (sentry, apollo, notion, slack, linkedin, drive, calendar, sheets, twitter)
3. Audit Tier C remainder (heygen, higgsfield, mux, creatify, creatomate, shotstack, whisper, deepl, removebg, dataforseo, outscraper, postiz, context7)
4. Confirm which ToolRoute-internal aggregators (auto, image-gen, search, toolroute, pdf, screenshot, playwright) wrap upstream providers vs. are pure aggregators
5. After all 43 done: emit a single PR updating `BYOK_REQUIRED_SLUGS` candidate set in Lane 6.5's patch proposal with the verified list

## Justin decisions queued

- D1 (carries from Lane 6.5): default behavior when slug ∈ `BYOK_REQUIRED_SLUGS` and customer has no BYOK key — return 402 `byok_required` vs. 403 `forbidden_resale`
- D2 (new): are stripe + supabase adapters BUILT to be customer-facing? Or are they internal-only (in which case they can be removed from the public gateway entirely, eliminating the breach without needing the BYOK gate)?
- D3 (new): does ToolRoute have GitHub Apps subscription that would license master-pool github adapter? If not, add to BYOK list.

## Cross-refs

- Lane 6.1 (`.agent/lane-6-resale-audit.md`) — 8 providers, parent audit
- Lane 6.5 (`.agent/lane-6.5-byok-gate-gap-audit.md`, PR #23) — runtime gate proposal
- Hard Rule #57 — pre-launch copy audit before tiered gates
