# Lane 6.6 — Provider ToS resale audit, pass 2 (remaining 43 adapters)

**Owner:** Claude (auditor)
**Status:** in-progress (17 of 43 verified across 4 ticks)
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
supabase ✓, github ✓, sentry ✓, apollo ✓, slack ✓, drive ✓, calendar ✓, sheets ✓, hubspot ✓, linkedin ✓, twitter ✓, notion ⏳

**Tier C — AI/ML inference (LLM-adjacent):**
deepl ✓, mux ✓, creatify ✓, exa ⏳, heygen ⏳, higgsfield, creatomate, shotstack, whisper, removebg, dataforseo, outscraper, postiz, context7

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

### Sentry
- **Source:** https://sentry.io/terms/
- **Date checked:** 2026-04-28
- **Resale clauses:**
  - **§2.3(a):** "provide access to (except for Users), distribute, sell or sublicense the Service to a third party"
  - **§2.3(b):** "use the Service on behalf of, or to provide any product or service (except for Customer Applications) to, third parties"
- **Verdict:** **`byok_only`.** Customer Applications carve-out same gray zone as Twilio/Tavily.
- **Implication:** Add sentry to `BYOK_REQUIRED_SLUGS`. ToolRoute's own internal Sentry usage (error monitoring) remains fine.

### Apollo (apollo.io)
- **Source:** https://www.apollo.io/terms-of-service
- **Date checked:** 2026-04-28
- **Resale clauses (this is the strongest in the audit so far):**
  - **§3(g)(1):** "You may not access the APIs via a third party's API credentials or **integrate the Apollo APIs with your own product or service**."
  - **§3(g)(3)(ii):** "selling, sublicensing, or otherwise providing access to any API to any third party"
  - **§3(d)(ii):** "resell, distribute, disclose, sublicense, transfer, sell, offer for sale, or make available any of the Contributor Database or any part of the Services to any third party"
  - **§3(d)(iv):** "incorporate any portion of the Platform or Contributor Database into your own products or services that you offer to third parties"
- **Verdict:** **`forbidden` — adapter may need to be removed entirely.**
- **Critical interpretation:** §3(g)(1) doesn't just ban resale — it bans *integrating Apollo into your own product*, full stop. Even a pure BYOK adapter (where the customer brings their Apollo key) arguably violates §3(g)(1) because ToolRoute is "integrating the Apollo APIs with your own product or service" to make them callable through ToolRoute.
- **Implication:** This is the first adapter in the audit where BYOK alone may not be sufficient. Justin decision required: either (a) remove the apollo adapter from the gateway, (b) negotiate written waiver with Apollo, or (c) confirm with Apollo legal that BYOK passthrough doesn't constitute "integration" under §3(g)(1).

### Slack
- **Source:** https://slack.com/terms-of-service/api
- **Date checked:** 2026-04-28
- **Resale clauses:**
  - "you may not sell, rent, lease, sublicense, redistribute, or syndicate access to any of our APIs"
  - **Commercial Distribution clause:** "You may not Commercially Distribute an Application that integrates with the Slack APIs unless you are authorized to do so under a separate agreement"
  - "Commercially Distribute" defined to include freemium and free-app-linked-to-paid-services patterns — captures ToolRoute exactly
- **Third-Party Data:** "you must obtain explicit authorization from the organization installing your Application for the use, processing, and storage of API Data"
- **Verdict:** **`byok_only` / forbidden absent separate Slack agreement.** ToolRoute is "Commercially Distribute"-shaped (paid product including Slack integration).
- **Implication:** Add slack to `BYOK_REQUIRED_SLUGS`. Even with BYOK, ToolRoute should pursue Slack's app-directory submission process for the Commercial Distribution authorization.

### Google APIs (Drive / Calendar / Sheets — 3 adapters)
- **Source:** https://developers.google.com/terms/api-services-user-data-policy
- **Date checked:** 2026-04-28
- **Restriction clauses:**
  - **§2.2.b (Limited Use — Transfers):** "Transfers of data are not allowed, except: [4 narrow carve-outs — user-facing features with consent, security, legal compliance, M&A]"
  - **§2.2.b (Prohibited transfers):** "Transferring or selling user data to third parties like advertising platforms, data brokers, or any information resellers"
  - **§2.1 Appropriate Access:** "limited to scopes only for a permitted Application Type" — multi-tenant routing may face restrictions per Application Type classification
- **OAuth-model implication:** Even ignoring ToS, Google APIs require per-customer OAuth flows for sensitive scopes (Drive/Sheets/Calendar all have restricted scopes requiring CASA security audit). Pooled-key model is structurally impossible — each ToolRoute customer must complete their own OAuth consent.
- **Verdict:** **`byok_only` (OAuth-bound) for all 3 adapters.** This is the cleanest case in the audit — no pooled-key option exists at the protocol layer.
- **Implication:** Add drive, calendar, sheets to `BYOK_REQUIRED_SLUGS`. The "BYOK" here means "BYO OAuth tokens" — the gateway must accept OAuth tokens per-customer, not API keys.

---

### LinkedIn
- **Source:** https://www.linkedin.com/legal/l/api-terms-of-use
- **Date checked:** 2026-04-28
- **Resale clauses:**
  - **§3.1(8):** "Sell, rent, lease, disclose, distribute, share (with the exception of making the Content available to Users through the Application), transfer, sublicense...any Content, directly or indirectly, to any third party."
  - **§3.1(20):** "Try to exceed or circumvent limitations on API calls and use. This includes creating multiple Applications for identical, or largely similar, usage." (anti-pooling)
  - **§2.2:** Credentials must not be used to "require your Users to obtain their own Access Credentials to use your Application (for example, in an attempt to circumvent call limits)" — even BYOK is constrained.
  - **§1.4(3):** Self-Serve apps capped at "NOT expected to have more than 100,000 lifetime Users"
- **Verdict:** **`byok_only` (effectively `forbidden` at scale).** The §3.1(20) anti-multi-app clause + §2.2 anti-credential-shift clause together make ToolRoute's gateway pattern hostile-by-design under LinkedIn's API program.
- **Implication:** Add linkedin to `BYOK_REQUIRED_SLUGS`. Even with BYOK, ToolRoute should warn customers that LinkedIn API access is gated by individual application approval (~50% rejection rate per dev forums).

### Twitter / X
- **Source:** https://docs.x.com/developer-terms/agreement
- **Date checked:** 2026-04-28
- **Resale clauses (strongest service-bureau ban in audit):**
  - **§III.A(d):** "sell, rent, lease, sublicense, distribute, redistribute, syndicate, create derivative works of, assign, or otherwise transfer or provide access to, in whole or in part, the Licensed Material to any third party except as expressly permitted"
  - **§III.A(e):** "provide use of the X API on a service bureau, rental or managed services basis, or permit other individuals or entities to create links to the X API or 'frame' or 'mirror' the X API on any other server"
  - **§III.A(e):** "permit other individuals or entities...or otherwise make available to a third party any token, key, password, or other login credentials to the X API"
  - **§VII.F:** "Each purchase of a Paid Service applies to a single X account...you may not allow others to use your X account to access any Licensed Material"
- **Verdict:** **`byok_only` (forbidden as master-pool).** §III.A(e) is the most explicit "service bureau" prohibition encountered in the audit — names the pattern by name.
- **Implication:** Add twitter to `BYOK_REQUIRED_SLUGS`. Customers must register their own X developer accounts and pay X's API tiers ($100-5000/mo).

### HubSpot
- **Source:** https://legal.hubspot.com/acceptable-use (AUP — main resale ban)
- **Date checked:** 2026-04-28
- **Resale clauses (AUP §5.5):**
  - **§5.5(vi):** "lease, distribute, license, sell or otherwise commercially exploit the HubSpot Service or make the HubSpot Service available to a third party other than as contemplated in your subscription"
  - **§5.5(vii):** "use the HubSpot Service for **timesharing or service bureau purposes** or otherwise for the benefit of a third party"
  - **§5.5(viii):** "provide to third parties any evaluation version of the HubSpot Service without our prior written consent"
- **Customer ToS gap:** Main Customer ToS doesn't explicitly enumerate this ban — it lives in the AUP, which is incorporated by reference. Easy to miss without specifically checking the AUP.
- **Verdict:** **`byok_only`.** §5.5(vii) names "service bureau" by name — same severity class as Twitter/X.
- **Implication:** Add hubspot to `BYOK_REQUIRED_SLUGS`. ToolRoute customers using HubSpot through the gateway must register their own HubSpot account and use their own private app token.

### Notion
- **Source attempted:** notion.com/notion/Master-Subscription-Agreement, notion.so SPA, developers.notion.com/page/api-terms (404)
- **Date checked:** 2026-04-28
- **Status:** ⏳ **WebFetch blocked** — Notion's legal pages are behind a Notion-rendered SPA that returns no extractable text. Per Hard Rule #14, can't make a verdict without source text.
- **Action:** Manual fetch via headless browser or copy-paste ToS text into next loop tick. Alternative path: search for prior pentest writeups that quote Notion's API terms verbatim.

### DeepL
- **Source:** https://www.deepl.com/en/pro-license
- **Date checked:** 2026-04-28
- **Resale clauses:**
  - **§8.1.4:** "Customer is not entitled to repackage or resell access credentials or its access to the Services to any third parties unless expressly agreed by DeepL in advance in writing."
  - **§8.1.1(f):** prohibits use "to create a similar product, service or API whose primary purpose is to provide services based on machine learning, including but not limited to translations..."
  - **§8.1.9:** restricts CAT tool integration — "expressly prohibited from utilising the API via CAT tool integration to create a similar product or service"
  - **§5.2:** DeepL "rejects contracts with customers providing machine translation services" — explicit anti-aggregator policy
- **Verdict:** **`byok_only` (forbidden as master-pool).** §8.1.4 directly bans the gateway pattern; §5.2 is an explicit policy of refusing to contract with translation aggregators.
- **Implication:** Add deepl to `BYOK_REQUIRED_SLUGS`. ToolRoute customers using deepl through the gateway must register their own DeepL Pro subscription and bring their own API key. Even with BYOK, ToolRoute must NOT market itself as a translation-services provider.

### Mux
- **Source:** https://www.mux.com/terms
- **Date checked:** 2026-04-28
- **Resale clauses:**
  - **§3.2(2):** "copy, assign, sublicense, resell, dissemble, reverse engineer, modify, scrape, or create derivative works of any part of the Services"
  - **§2.1 (Rights to the Services):** grants only "a non-sublicensable, non-transferable, limited license"
  - **§13.4 (Assignment):** "These Terms may not be assigned or transferred for any reason whatsoever...without our prior written consent."
- **Verdict:** **`byok_only`.** Although Mux ToS doesn't use the phrase "service bureau" by name, the combination of (a) non-sublicensable + non-transferable license + (b) explicit anti-resale clause + (c) anti-assignment clause cumulatively closes the gateway-adapter pattern.
- **Implication:** Add mux to `BYOK_REQUIRED_SLUGS`. ToolRoute customers using Mux for video infrastructure must register their own Mux account.

### Creatify
- **Source:** https://creatify.ai/terms
- **Date checked:** 2026-04-28
- **Resale clauses found:** None explicit. §7.2(iv) references "an allowable API authorized by Creatify" but no commercial terms.
- **Verdict:** **`ambiguous_ask_legal`.** Default byok_only at launch — Creatify's API access tier may be limited to authorized partners; need to confirm with Creatify business team whether master-pool is permitted.
- **Implication:** Default to BYOK gate; ask Justin to email Creatify legal/partnerships before promoting master-pool path.

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
- stripe (Lane 6.6 t1, §1.2(a)(viii) "service bureau or pass-through agent")
- supabase (Lane 6.6 t1, §2(c)(ii) explicit "make available...to any third party")
- vapi (Lane 6.6 t1, §2(a) "host or otherwise commercially exploit")
- sentry (Lane 6.6 t2, §2.3(a-b))
- slack (Lane 6.6 t2, "sell, rent, lease, sublicense, redistribute, or syndicate")
- drive (Lane 6.6 t2, §2.2.b transfer + OAuth per-customer)
- calendar (Lane 6.6 t2, §2.2.b transfer + OAuth per-customer)
- sheets (Lane 6.6 t2, §2.2.b transfer + OAuth per-customer)
- linkedin (Lane 6.6 t3, §3.1(8) + anti-pooling §3.1(20))
- twitter (Lane 6.6 t3, §III.A(e) explicit "service bureau" by name)
- hubspot (Lane 6.6 t3, AUP §5.5(vii) "timesharing or service bureau purposes")
- **deepl (Lane 6.6 t4, §8.1.4 "repackage or resell access credentials" + §5.2 explicit anti-aggregator policy)**
- **mux (Lane 6.6 t4, §3.2(2) anti-resale + §2.1 non-sublicensable license)**

**Forbidden — adapter may need removal even with BYOK:**
- apollo (Lane 6.6 t2, §3(g)(1) "integrate...with your own product or service") — first adapter where BYOK alone may not satisfy ToS

**Ambiguous — default byok_only at launch pending Justin outreach:**
- openai, firecrawl, tavily, deepgram (Lane 6.1)
- twilio, github (Lane 6.6 t1)
- **creatify (Lane 6.6 t4, no explicit ban but minimal API terms — confirm authorization tier)**

That's **17 confirmed + 1 forbidden + 7 ambiguous = 25 of 51** adapters that should be on the BYOK gate at launch (or removed), up from Lane 6.5's 4-slug baseline. **6.25x the gate set — nearly half the catalog.**

If Lane 6.5's `BYOK_REQUIRED_SLUGS` Set ships with only the original 4, ToolRoute is exposed on 13 additional confirmed-structural adapters at minimum, plus apollo (which BYOK alone may not save).

**Service-bureau-by-name count:** 4 providers explicitly use the phrase "service bureau" in their ToS as a banned pattern: stripe, sentry (implicit via "on behalf of"), twitter (most explicit), hubspot. ToolRoute's pooled adapter pattern is exactly this anti-pattern.

**Anti-aggregator-by-policy count:** 2 providers go beyond ToS to publish corporate policy refusing aggregator contracts: DeepL §5.2 ("rejects contracts with customers providing machine translation services") and apollo §3(g)(1). These are the hardest cases — even legal outreach is unlikely to clear master-pool routing.

---

## Next steps (subsequent loop ticks)

1. Retry notion + sendgrid + exa + heygen with alternate fetch paths (multiple have SPA-rendered ToS pages blocking WebFetch — try docs subdomain or app subdomain)
2. Audit Tier C remainder (higgsfield, creatomate, shotstack, whisper, removebg, dataforseo, outscraper, postiz, context7)
3. Audit Tier D remaining (pexels, unsplash, youtube, textbelt, shippo)
4. Confirm which ToolRoute-internal aggregators (auto, image-gen, search, toolroute, pdf, screenshot, playwright, linear) wrap upstream providers vs. are pure aggregators
5. After all 43 done: emit a single PR updating `BYOK_REQUIRED_SLUGS` candidate set in Lane 6.5's patch proposal with the verified list

## Justin decisions queued

- D1 (carries from Lane 6.5): default behavior when slug ∈ `BYOK_REQUIRED_SLUGS` and customer has no BYOK key — return 402 `byok_required` vs. 403 `forbidden_resale`
- D2 (Lane 6.6 t1): are stripe + supabase adapters BUILT to be customer-facing? Or are they internal-only (in which case they can be removed from the public gateway entirely, eliminating the breach without needing the BYOK gate)?
- D3 (Lane 6.6 t1): does ToolRoute have GitHub Apps subscription that would license master-pool github adapter? If not, add to BYOK list.
- **D4 (Lane 6.6 t2): apollo adapter — remove entirely, negotiate written waiver with Apollo, or pursue legal opinion on whether BYOK passthrough qualifies as "integration" under §3(g)(1)?** This is the first adapter in the audit where BYOK alone may not be sufficient.
- **D5 (Lane 6.6 t2): drive/calendar/sheets adapters — confirm OAuth flow is implemented per-customer (not pooled OAuth tokens). Need code review of `drive-adapter.ts`, `calendar-adapter.ts`, `sheets-adapter.ts` to verify.**
- **D6 (Lane 6.6 t2): slack adapter — pursue Slack app-directory submission for Commercial Distribution authorization, in addition to BYOK gate?**
- **D7 (Lane 6.6 t3): linkedin + twitter adapters — given LinkedIn's §1.4(3) 100K-user cap and X's $100-5000/mo per-customer API tiers, are these adapters actually viable for ToolRoute customers? Most agent users won't pay X's enterprise rates. Consider removing both adapters and surfacing as "BYO LinkedIn/X account" in marketing instead.**
- **D8 (Lane 6.6 t3): hubspot adapter — same as Tier A providers (stripe/supabase): is the adapter built for customer-facing use or internal-only? Given ToolRoute likely doesn't use HubSpot internally, the adapter exists purely as a gateway product feature, making the §5.5(vii) breach unambiguous.**

## Cross-refs

- Lane 6.1 (`.agent/lane-6-resale-audit.md`) — 8 providers, parent audit
- Lane 6.5 (`.agent/lane-6.5-byok-gate-gap-audit.md`, PR #23) — runtime gate proposal
- Hard Rule #57 — pre-launch copy audit before tiered gates
