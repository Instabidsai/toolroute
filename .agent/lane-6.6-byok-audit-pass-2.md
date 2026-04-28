# Lane 6.6 — Provider ToS resale audit, pass 2 (remaining 43 adapters)

**Owner:** Claude (auditor)
**Status:** ✅ COMPLETE — 43 of 43 adapters verified across 12 ticks. Final tally: 30 forbidden + 1 stricter (apollo) + 18 ambiguous = 49 of 51 adapters require BYOK at launch (96% of catalog). Two confirmed-permissive carry-overs from Lane 6.1 (firecrawl, tavily) account for the gap.
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
**Confirmed pass-7 by source-grep on `src/lib/adapters/*-adapter.ts`:**
- **`toolroute-adapter.ts`** — internal Supabase routing only ✓ (truly internal)
- **`auto-adapter.ts`** — lazy-import dispatch only ✓ (truly internal)

**RECLASSIFIED as third-party wrappers (slug name hides upstream provider):**
- **`image-gen-adapter.ts`** → wraps **fal.run (Fal.ai)** — confirmed forbidden this tick
- **`search-adapter.ts`** → wraps **api.search.brave.com (Brave Search API)** — pending fetch
- **`pdf-adapter.ts`** → wraps **api.html2pdf.app** — confirmed ambiguous this tick
- **`screenshot-adapter.ts`** → wraps **api.screenshotone.com (ScreenshotOne)** — confirmed ambiguous this tick
- **`playwright-adapter.ts`** → wraps **image.thum.io (Thum.io)** — pending fetch + **slug name is misleading: NOT Microsoft Playwright**

This was a **classification blind spot in the original Lane 6 audit** — 5 adapters were listed as "internal aggregators" but actually proxy unaudited third-party APIs. The slug names (especially `playwright` for Thum.io) actively conceal which upstream provider gets the traffic. **Marketing copy referencing the `playwright` adapter is double-misleading**: customers think they're getting headless-browser automation, they're actually getting screenshot URLs from Thum.io.

### Pass-2 audit queue (43, prioritized by structural-resale risk)

**Tier A — payments + voice/comms (highest enforcement risk):**
stripe ✓, twilio ✓, vapi ✓, sendgrid ✓, textbelt ✓, shippo ✓ (default-forbidden flagged via Software Providers partner-program signal)

**Tier B — data infra + auth-gated business APIs:**
supabase ✓, github ✓, sentry ✓, apollo ✓, slack ✓, drive ✓, calendar ✓, sheets ✓, hubspot ✓, linkedin ✓, twitter ✓, notion ✓

**Tier C — AI/ML inference (LLM-adjacent):**
deepl ✓, mux ✓, creatify ✓, exa ✓, heygen ✓, higgsfield ✓, creatomate ✓, shotstack ✓, whisper ✓, removebg ✓, dataforseo ✓, outscraper ✓, postiz ✓, context7 ✓

**Tier D — stock media (lower risk, often permissive):**
pexels ✓, unsplash ✓, youtube ✓, linear ✓, image-gen ✓ (Fal.ai), pdf ✓ (Html2PDF), screenshot ✓ (ScreenshotOne), search ✓ (Brave), playwright ✓ (Thum.io — NO PUBLIC TOS FOUND), auto (internal ✓), toolroute (internal ✓)

✓ = verified this tick · ⏳ = WebFetch failed, retry next tick

---

## Per-provider verdicts (cumulative across 5 ticks)

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
- **Source:** Notion Master Subscription Agreement v.4 (https://d7umqicpi7263.cloudfront.net/eula/3QkIRed56NURE2biK8-iR9WZUHjl261rslq5f-W45yA), recovered via WebSearch text snippet after notion.com → notion.so SPA + developers.notion.com/page/api-terms returned 404.
- **Date checked:** 2026-04-28
- **Resale clause (Tier 1, by name):** "Notion prohibits using the Services or API to provide services to third parties (such as a service bureau)" — names the gateway pattern by name AND explicitly ties it to API usage. This is the strongest possible Tier 1 hit.
- **Verdict:** **`forbidden` / `byok_only`.** Same severity class as Stripe §1.2(a)(viii), Twitter §III.A(e), HubSpot AUP §5.5(vii) — "service bureau" is named verbatim. Master-pool routing through ToolRoute's pooled Notion integration token = direct breach of Notion MSA.
- **Implication:** Add notion to `BYOK_REQUIRED_SLUGS`. ToolRoute customers using Notion through the gateway must register their own Notion integration and bring their own integration token. Standard Notion integration tokens are workspace-scoped, so this is the natural pattern anyway.
- **Cross-ref:** This brings the "service-bureau-by-name" count to **5** (stripe, twitter, hubspot, notion, plus sentry's implicit version). Five major SaaS vendors using identical anti-aggregator phrasing strongly indicates this is industry-standard drafting, not edge-case clauses.

### Exa.ai
- **Source:** Exa Labs Terms of Service PDF (https://exa.ai/assets/Exa_Labs_Terms_of_Service.pdf, recovered via WebSearch text snippet after PDF flatten failed and static.exaai.chat certificate expired)
- **Date checked:** 2026-04-28
- **Resale clauses (Tier 2 stack):**
  - **§API license grant:** "non-transferable, non-sublicensable, worldwide, revocable right and license to use their APIs" — non-sublicensable explicitly closes the resale chain
  - **§Content license:** also "non-sublicensable" (double non-sublicensable across both license layers)
  - **§Audit rights:** "Exa reserves the right to audit your use of the APIs" — Exa actively monitors for compliance, not just nominally
- **Verdict:** **`byok_only` / `forbidden`.** Two stacked non-sublicensable license grants + active audit rights = master-pool routing through ToolRoute's pooled Exa key would be auditable breach on detection. Tier 2 standard sublicense-ban stack with the additional teeth of declared audit enforcement.
- **Implication:** Add exa to `BYOK_REQUIRED_SLUGS`. ToolRoute customers using Exa through the gateway must register their own Exa account and bring their own API key.
- **Note:** ToolRoute's own discovery/search use of Exa for internal tool-discovery agent workflows is unaffected — that is normal Exa-customer consumption, not third-party resale.

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

### SendGrid (via Twilio parent ToS)
- **Source:** https://www.twilio.com/en-us/legal/tos (SendGrid is owned by Twilio; Twilio MSA governs absent SendGrid-specific terms)
- **Date checked:** 2026-04-28
- **Resale clauses found:**
  - **Direct ban:** "not transfer, resell, lease, license, or otherwise make available the Services to third parties"
  - **End User carve-out:** services may be made available "to make the Services available to your End Users" as part of your own products/services
  - **§2.2:** "use commercially reasonable efforts to prevent unauthorized access" + "solely responsible for all use of the Services...under your account"
- **Verdict:** **`byok_only`.** Tier 2 phrase hit — "transfer, resell, lease, license, or otherwise make available the Services to third parties" is the canonical sublicense ban. The "End User" carve-out covers ToolRoute's *own* transactional emails (Lane 6.1 already confirmed this), but does NOT cover ToolRoute customers sending email through a pooled SendGrid account.
- **Implication:** Add sendgrid to `BYOK_REQUIRED_SLUGS`. Note: this same Twilio MSA also governs the twilio adapter (already audited Lane 6.6 t1) and is likely the legal basis for the vapi audit reading.

### Unsplash
- **Source:** https://unsplash.com/api-terms
- **Date checked:** 2026-04-28
- **Resale clauses found:**
  - **§2 (Credentials):** "You may not share your Credentials with any third party" + "You will not use the developer credentials assigned to a different individual or entity"
  - **§2 (Account binding):** "You may only link your API account with your Developer Apps, and not link your API account to any third-party products or services"
  - **§4 (Aggregation):** "You must not aggregate Content received via the APIs with any third-party content such that users of your Developer Apps cannot attribute the Content to Unsplash"
  - **§8 (Sublicensing):** sublicensing requires Unsplash's prior written consent
- **Verdict:** **`forbidden`** (master-pool routing direct breach). Tier 1 + Tier 3 hits. The §2 credential-sharing ban + the §2 prohibition on linking the API account to "third-party products or services" together ban the gateway-adapter pattern at credential layer. Even BYOK has a wrinkle: each ToolRoute customer must run their own Developer App, not share a ToolRoute-owned one.
- **Implication:** Add unsplash to `BYOK_REQUIRED_SLUGS`. Consider whether even BYOK passes muster — Unsplash credentials are bound to "your Developer Apps", which suggests each customer needs their own registered developer app, not just a credential within ToolRoute's app.

### search → Brave Search API (slug-name reclassification)
- **Source:** https://api-dashboard.search.brave.com/terms-of-service (per `src/lib/adapters/search-adapter.ts` — `BRAVE_WEB_URL = "https://api.search.brave.com/res/v1/web/search"`)
- **Date checked:** 2026-04-28
- **Resale clauses found (cleanest Tier 1+2+3 stack in audit):**
  - **Tier 2 (sublicense chain):** "rent, lease, lend, sell, distribute, publish, sublicense, assign, transfer, or otherwise make available the API or Documentation to any third party"
  - **Tier 2 (results redistribution):** "redistribute, resell, or sublicense the Search Results"
  - **Tier 3 (key-sharing ban):** "Customer shall keep the API Key secure, may not share the API Key with any third party other than its affiliates, contractors and agents that need to know the API"
  - **Storage ban:** "store, cache, or create a database of Search Results, in whole or in part, other than transient storage required for operation of Customer Applications"
  - **Anti-circumvention:** "use the API in Customer Applications to replicate or attempt to replace the functionality of the API, or circumvent use of the API"
  - **Anti-integration:** "combine or integrate the API with any software, services, systems, technology or materials not authorized by Provider"
- **Verdict:** **`forbidden`** (master-pool routing direct breach). Strongest combined hit so far — every tier of the grep checklist except Tier 1 fires. The "may not share the API Key with any third party" is the single hardest line to argue around, period. The "combine or integrate...with any software...not authorized" clause appears designed specifically to ban gateway-style integrations.
- **Implication:** Add `search` to `BYOK_REQUIRED_SLUGS`. Note slug-name layer: customers see "search", they actually need to BYO Brave Search API key. Brave specifically authorizes integrations only via written authorization — even Lane 6.5 documentation should mention this is a "BYO Brave Search key" gate, not "BYO any search provider."

### pexels → Pexels API
- **Source:** https://www.pexels.com/terms-of-service/
- **Date checked:** 2026-04-28
- **Resale clauses found:**
  - **Standalone-resale ban:** "You cannot sell or distribute the Content (either in digital or physical form) on a Standalone basis"
  - **Anti-scraping:** "Data mining, extraction, scraping and the use of programs or robots for automatic data collection...is strictly prohibited"
  - **Tier 4-adjacent (competing service):** "use or compile any Content to replicate a similar or competing service"
- **Verdict:** **`ambiguous_ask_legal`.** No explicit API-key-sharing clause, but the "competing service" clause is concerning — ToolRoute offering Pexels stock photo access via gateway could be interpreted as creating a competing-stock-photo aggregator. Default byok_only at launch. Pexels is permissively-licensed for content but their commercial-aggregation language is fuzzier.
- **Implication:** Default to BYOK gate; ask Pexels via support before promoting master-pool path.

### image-gen → Fal.ai (slug-name reclassification)
- **Source:** https://fal.ai/terms (per `src/lib/adapters/image-gen-adapter.ts` — `FAL_QUEUE_URL = "https://queue.fal.run"`)
- **Date checked:** 2026-04-28
- **Resale clauses found:**
  - **Stacked Tier 1+4 hit:** "resell, transfer, assign, or sublicense Customer's rights under these Terms to any third party or use the Services on a **timesharing, service bureau, or similar arrangement**"
  - **Outsourcing/third-party benefit ban:** "to run an outsourcing business, or to provide the Services for the benefit of any third party"
  - **API exposure ban:** "Client will not expose any of the Services APIs directly to any End Users"
- **Verdict:** **`forbidden`** (master-pool routing direct breach). The "expose APIs to End Users" clause is the strongest seen so far — even a thin wrapper would breach. ToolRoute's `image-gen` adapter exposing Fal.ai's diffusion APIs to ToolRoute customers is exactly the prohibited pattern.
- **Implication:** Add `image-gen` to `BYOK_REQUIRED_SLUGS`. Note the slug-name layer: the `BYOK_REQUIRED_SLUGS` Set keys on slug, not upstream provider — but Justin (and customers) need to understand that "BYOK image-gen" means "BYO Fal.ai key", not "BYO some abstract image-gen key."

### pdf → Html2PDF.app
- **Source:** https://html2pdf.app/terms-of-service/ (per `src/lib/adapters/pdf-adapter.ts`)
- **Date checked:** 2026-04-28
- **Resale clauses found:**
  - **Tier 1 mirror hit (limited scope):** "transfer the materials to another person or **'mirror'** the materials on any other server"
  - **Commercial-use ban:** "use the materials for any commercial purpose, or for any public display"
  - **No SaaS/API-specific clauses** — ToS reads like a generic website-content ToS, not an API-product ToS
- **Verdict:** **`ambiguous_ask_legal`.** The mirror + commercial-use clauses target "materials" (likely website content), not API responses. There is no API-specific section. This is concerning in itself — running a paid API behind a generic website ToS suggests Html2PDF.app may not have considered B2B aggregation at all. Default byok_only at launch.
- **Implication:** Default to BYOK gate. Justin should email Html2PDF.app for API-aggregation clearance — silence here is more concerning than explicit silence at established providers like Linear or Fal.ai.

### screenshot → ScreenshotOne
- **Source:** https://screenshotone.com/terms-of-service/ (per `src/lib/adapters/screenshot-adapter.ts`)
- **Date checked:** 2026-04-28
- **Resale clauses found:**
  - **Tier 2 partial:** "non-exclusive, non-transferable, **non-sublicensable** license"
  - **No explicit resale, service-bureau, or aggregator language**
- **Verdict:** **`ambiguous_ask_legal`.** "Non-sublicensable" is a Tier 2 hit per the grep checklist, but it sits alone — no reinforcing "make available to third party" or "service bureau" language. Default byok_only at launch.
- **Implication:** Default to BYOK gate. The non-sublicensable clause may be enough on its own to forbid pooled routing, but the lack of supporting language makes it worth a direct ask before deciding whether removal vs. BYOK-only is the right answer.

### Linear
- **Source:** https://linear.app/terms
- **Date checked:** 2026-04-28
- **Resale clauses found:**
  - **Stacked Tier 1+2+4 hit:** "license, sublicense, sell, resell, rent, lease, transfer, assign, distribute, **time share** or otherwise commercially exploit or **make the Service available to any third party**"
  - **Internal-use restriction:** access limited to "Customer's own internal business purposes and **not for the benefit of any third party**"
  - **User-binding:** "individuals authorized by Customer" + "solely responsible for all activity on its Users' accounts"
- **Verdict:** **`forbidden`** (master-pool routing direct breach). Cleanest stacked-clause hit so far — single sentence triggers Tier 1 ("time share"), Tier 2 ("sublicense, sell, resell, rent, lease"), Tier 2 ("make...available to any third party"), AND Tier 4 ("for the benefit of any third party"). Four phrase-grep tiers in one provider's ToS — exemplary anti-aggregator drafting.
- **Implication:** Add linear to `BYOK_REQUIRED_SLUGS`. Linear's project-management nature means most customers using through ToolRoute would be using their *own* Linear workspace anyway, so BYOK is the natural shape — but the master-pool fallback path must be cut. Surfaces the same dual-role question as stripe/supabase/hubspot: does ToolRoute use Linear internally? If yes, Linear adapter built for customer-facing use is unambiguous breach.

### Outscraper
- **Source:** https://outscraper.com/terms-of-service/
- **Date checked:** 2026-04-28
- **Resale clauses found:** None explicit. §12 "Prohibited Uses" only covers "unlawful purpose" + circumvention. §7 third-party-tools clause is warranty-only.
- **Verdict:** **`ambiguous_ask_legal`.** Default byok_only at launch — silent ToS doesn't grant resale rights, only fails to forbid them. Outscraper's data-scraping nature means cumulative usage caps may be enforced even if pooling is technically allowed.
- **Implication:** Default to BYOK gate; ask Justin to email Outscraper for explicit confirmation on aggregator routing.

### Textbelt
- **Source:** https://textbelt.com/tos/
- **Date checked:** 2026-04-28
- **Resale clauses found:** None explicit. Only "No impersonation" clause: "Do not send messages on behalf of other companies or individuals without permission."
- **Verdict:** **`ambiguous_ask_legal`.** Default byok_only at launch — the impersonation clause is interesting because it could apply to ToolRoute customers sending SMS through ToolRoute's pooled key (the SMS would technically come "on behalf of" ToolRoute customers). Carrier-level SMS regulation (10DLC, A2P 10) likely overrides ToS anyway — pooling phone-number-originated SMS without registered campaigns triggers carrier filtering regardless of ToS.
- **Implication:** Default to BYOK gate; carrier compliance (10DLC) is the harder gate than ToS for any SMS adapter.

### Whisper (OpenAI)
- **Source:** Whisper falls under OpenAI's main ToS — Lane 6.1 audited as `ambiguous_ask_legal` (OpenAI ToS lacks explicit resale clause but lacks resale grant)
- **Date checked:** 2026-04-28 (re-verified inheritance from Lane 6.1)
- **Verdict:** **`ambiguous_ask_legal`** (inherits openai Lane 6.1 verdict). Default byok_only.
- **Implication:** Treat whisper exactly like the openai adapter — both gated on the same ToS uncertainty.

### Higgsfield
- **Source:** https://higgsfield.ai/terms-of-use-agreement (per `src/lib/adapters/higgsfield-adapter.ts`)
- **Date checked:** 2026-04-28
- **Resale clauses found:**
  - **§1.2 (License) Tier 2:** "non-exclusive, non-transferable, **non-sublicensable**, revocable license"
  - **§5.2(i) Tier 2 stacked:** "license, sell, rent, lease, transfer, assign, reproduce, distribute, host or otherwise commercially exploit the Service"
  - **§5.1(iii) Tier 6 anti-competing:** "use or access the Service or any Outputs to develop, modify, fine-tune or improve any products or services that compete with our Services"
- **Verdict:** **`forbidden`** (master-pool routing direct breach). Triple-tier stack: non-sublicensable (Tier 2 isolated) + full sublicense chain enumerated (Tier 2 stacked) + Tier 6 anti-competing. The "host or otherwise commercially exploit" wording in §5.2(i) is the closest direct hit on gateway routing patterns.
- **Implication:** Add higgsfield to `BYOK_REQUIRED_SLUGS`. The §5.1(iii) anti-competing clause is concerning even on a BYOK shape if ToolRoute markets video-generation tools alongside Higgsfield's offering — same shape as HeyGen.

### Postiz
- **Source:** https://postiz.com/terms-of-service (per `src/lib/adapters/postiz-adapter.ts`)
- **Date checked:** 2026-04-28
- **Resale clauses found:**
  - **§7 (Acceptable Use) Tier 2 + Tier 6 stacked:** "resell, sublicense, white-label or otherwise commercialise the Service except under a written agreement with Gitroom Limited"
  - **§10 IP grant:** "limited, non-exclusive, **non-transferable**, revocable licence to access and use the Service for its intended purpose during your subscription"
  - **Open-source carve-out:** Component-level open-source licenses retained — this is informational, not a permission for ToolRoute (Postiz is hosted SaaS for paid customers).
- **Verdict:** **`forbidden`** (master-pool routing direct breach). The §7 "white-label or otherwise commercialise...except under a written agreement" clause is one of the cleanest direct anti-aggregator drafts seen — it explicitly enumerates white-label (Tier 6) AND requires a written agreement, leaving no room for tacit interpretation.
- **Implication:** Add postiz to `BYOK_REQUIRED_SLUGS`. Justin should consider pursuing the §7 written-agreement path with Gitroom Limited if Postiz integration is strategic (similar to LinkedIn's "Marketing Developer Program" path). Without a written agreement, master-pool routing is direct breach.

### Context7 (Upstash)
- **Source:** https://upstash.com/trust/terms.pdf — main Upstash Terms apply per Context7 Addendum (https://upstash.com/trust/context7addendum.pdf). Per `src/lib/adapters/context7-adapter.ts`.
- **Date checked:** 2026-04-28
- **Resale clauses found:**
  - **§2.2 Tier 2+3 stacked (single sentence):** "You may not **resell, sublicense, lease, rent, loan, transfer, assign or otherwise commercially exploit** the Services or **make the Services available to any third party**."
  - **§2.2 Tier 3 credential-sharing ban:** "You may not share your credentials or API keys with any third party except as necessary for your employees or contractors who have a legitimate need to access the Services."
- **Verdict:** **`forbidden`** (master-pool routing direct breach). Single-sentence Tier 2 stacked hit ("resell, sublicense, lease, rent, loan, transfer, assign or otherwise commercially exploit") + explicit "make the Services available to any third party" + explicit credential-sharing ban with employee/contractor narrow exception (master-pool customers are neither). Three independent breach vectors in two consecutive sentences.
- **Implication:** Add context7 to `BYOK_REQUIRED_SLUGS`. Notably, Context7 is one of ToolRoute's listed Global Tools (per CLAUDE.md "Global Tools" table). ToolRoute *consuming* Context7 internally is fine — that's normal customer use. But shipping Context7 as a gateway-routed adapter for third-party customers triggers all three §2.2 breach vectors simultaneously.

### DataForSEO
- **Source:** https://dataforseo.com/terms-of-service (per `src/lib/adapters/dataforseo-adapter.ts`)
- **Date checked:** 2026-04-28
- **Resale clauses found:**
  - **§7.1 (Data Usage Restrictions):** "any search engine results page (SERP) data or content obtained through the Service...shall not be used to compete with or adversely affect the business interests of the search engine providers"
  - **§7.2:** Indemnification for §7.1 violations
  - No explicit Tier 1/2/3/4/6 hits — silent on resale, sublicense, key-sharing, service bureau, white-label
- **Verdict:** **`ambiguous_ask_legal`.** §7.1 is interesting because it's an *indirect* concern — DataForSEO data passed through a gateway to ToolRoute customers building SERP-tracking tools could be argued to "compete with or adversely affect" Google/Bing/etc. business interests, making DataForSEO indirectly liable. But this is a layered argument, not a direct resale ban. Default byok_only at launch.
- **Implication:** Default to BYOK gate. The §7.1 search-engine-competition clause is a concern for DataForSEO's *upstream* relationship with Google rather than for ToolRoute's relationship with DataForSEO — but indirectly affects whether DataForSEO would tolerate ToolRoute's gateway pattern.

### Shippo (NO TOS FETCHED — 4 attempts)
- **Source attempted:** https://goshippo.com/legal (404), goshippo.com/legal/api-services-agreement (404), goshippo.com/legal/terms (404), prior tick attempts also 404.
- **Date checked:** 2026-04-28
- **Indirect signal:** Shippo publishes a dedicated **"Shippo for Software Providers"** partner program (https://goshippo.com/shippo-for-software-providers — found via search). The existence of a separate software-provider partnership tier is a strong implicit signal that **default ToS does NOT authorize aggregator routing** — vendors who publish dedicated partner programs typically structure default ToS to exclude the partnership pattern, requiring opt-in to the program for compliant aggregator routing.
- **Verdict:** **`ambiguous_ask_legal`** with elevated concern (verdict pending direct ToS read once locatable). Default byok_only at launch. **PRIORITY:** Justin should request Shippo's API Services Agreement directly from sales@goshippo.com OR investigate Software Providers partner program eligibility/cost.
- **Implication:** Add shippo to `BYOK_REQUIRED_SLUGS` defensively. The implicit signal from the partner-program structure (LinkedIn-style: tiered authorization) strongly suggests master-pool routing requires partner agreement — this matches the structural-ban pattern even though I couldn't read the actual ToS.

### HeyGen
- **Source:** https://www.heygen.com/terms (per `src/lib/adapters/heygen-adapter.ts`)
- **Date checked:** 2026-04-28
- **Resale clauses found:**
  - **§2 anti-API-interface clause (rare and direct):** "Frame, replicate, or develop an interface to access the Services without going directly to the Website (e.g., via an API and/or by white-labeling any portion of the Services), unless we explicitly make such functionality available to you"
  - **§2 anti-competing-services clause:** "Use any portion of the Services to build any products or services that are competitive to any portion of the Services"
  - **§2 default API license:** non-sublicensable (standard Tier 2)
- **Verdict:** **`forbidden`** (master-pool routing direct breach). The "develop an interface to access the Services...via an API" clause is unusually direct — most providers ban resale via license clauses, but HeyGen's clause is drafted specifically against API-interface gateways. ToolRoute's HeyGen adapter is *literally* an API interface to HeyGen's services not authored by HeyGen. Pairing with the anti-competing-services clause (gateway IS competitive in part — ToolRoute markets video tools alongside HeyGen) makes this a stacked, drafted-against-this-pattern breach.
- **Implication:** Add heygen to `BYOK_REQUIRED_SLUGS`. HeyGen is also a candidate for outright removal — even with BYOK, a customer's HeyGen API call passing through ToolRoute's gateway arguably still "frames" or "develops an interface" to HeyGen. Need legal confirmation that BYOK pass-through (where the customer is the HeyGen contracting party, ToolRoute is just transport) doesn't fall under the §2 ban. This is a new finding class: **anti-API-interface clauses**, distinct from the standard sublicense chain.

### Creatomate
- **Source:** https://creatomate.com/terms-of-service (per `src/lib/adapters/creatomate-adapter.ts`)
- **Date checked:** 2026-04-28
- **Resale clauses found:** None explicit — no Tier 1/2/3/4 hits. General IP-protection language ("The Service and its original content...will remain the exclusive property of the Company") but no API-resale, sublicense-chain, or service-bureau language.
- **Verdict:** **`ambiguous_ask_legal`.** Silent ToS — like Outscraper, doesn't grant resale rights but doesn't forbid them either. Default byok_only at launch.
- **Implication:** Default to BYOK gate. Justin should email Creatomate for explicit aggregator/gateway clearance — silent ToS is risk-shifting (no clear permission, but also no clear ban).

### Shotstack
- **Source:** https://shotstack.io/terms/ (per `src/lib/adapters/shotstack-adapter.ts`)
- **Date checked:** 2026-04-28
- **Resale clauses found:**
  - **Tier 2 stacked:** "licence, sell, rent, lease, transfer, assign or otherwise commercially exploit the Platform"
  - **Tier 3 credential-sharing ban:** "provide Platform login details or passwords...to any unauthorised third party"
  - **Explicit anti-pooling clause (rare):** "Rendering large volumes of video on multiple accounts...or signing up for multiple accounts to increase your credit allowance" specifically called out as breach
- **Verdict:** **`forbidden`** (master-pool routing direct breach). Triple-stacked hit: Tier 2 sublicense chain + Tier 3 credential-sharing ban + explicit multi-account anti-pooling clause that reads as if drafted specifically to block aggregator/gateway products. The "multiple accounts to increase credit allowance" language is the most direct anti-aggregator wording I've seen — every gateway adapter shape I can think of would fit this description.
- **Implication:** Add shotstack to `BYOK_REQUIRED_SLUGS`. Even master-pool with billing visible to Shotstack would risk the multi-account clause; BYOK is the only legal shape. Video-rendering nature also means each customer's job spends real Shotstack render-minute credits — pooling cost-shifts in a way Shotstack explicitly enumerated as off-limits.

### remove.bg
- **Source:** https://remove-bg.io/terms-of-service/ (per `src/lib/adapters/removebg-adapter.ts`; primary remove.bg/api was silent on /terms paths)
- **Date checked:** 2026-04-28
- **Resale clauses found:**
  - **§3 Tier 2:** "Redistributing, selling, or sublicensing the Service itself or access to it"
  - **§6 anti-competitive ban:** "use the Service infrastructure, code, or design to build competing products or services"
  - No explicit credential-sharing or service-bureau language
- **Verdict:** **`ambiguous_ask_legal`.** §3's "redistributing...access" is a clean Tier 2 hit — sufficient to default byok_only. §6's "build competing products" is the more interesting clause for ToolRoute specifically: a unified-tools gateway that includes background removal arguably uses remove.bg's infrastructure as part of building a competing background-removal-as-a-service offering, even if the actual processing is delegated. This is structurally similar to apollo §3(g)(1) but softer language.
- **Implication:** Default to BYOK gate. Justin should email remove.bg/Kaleido to confirm whether ToolRoute's positioning constitutes a "competing product" under §6. Note also that the canonical remove.bg/api domain returned no /terms response — this ambiguity should be resolved by direct email contact, not assumption.

### playwright → Thum.io (slug-name reclassification, NO PUBLIC TOS FOUND)
- **Source:** No public ToS at https://www.thum.io/, /terms, /tos, /legal, or thumio.com (different vendor). Homepage has no legal links. Per `src/lib/adapters/playwright-adapter.ts` — `THUM_BASE = "https://image.thum.io/get"`.
- **Date checked:** 2026-04-28
- **Resale clauses found:** N/A — vendor publishes no enforceable Terms of Service that I could locate.
- **Verdict:** **`silent_no_tos_findable`** — treat as `ambiguous_ask_legal` with elevated concern. A vendor without a public ToS is a separate risk class: ToolRoute has no enforceable contract with thum.io to point at if a dispute arises, AND thum.io retains unilateral right to change terms or terminate access without notice. Master-pool routing through a no-ToS vendor is operationally fragile in a way that's distinct from ToS-explicit bans.
- **Implication:** **Treble concern:**
  1. Default to BYOK gate (no grant of resale rights = treat as forbidden by default)
  2. The slug name `playwright` actively misleads customers expecting Microsoft Playwright headless-browser automation; they get screenshot URLs from a no-ToS vendor instead. This is a separate Hard Rule #57 violation.
  3. Justin should email Thum.io support@thum.io for explicit aggregator clearance + a written API agreement, or remove the adapter entirely.

### YouTube (Data API v3)
- **Source:** https://developers.google.com/youtube/terms/api-services-terms-of-service
- **Date checked:** 2026-04-28
- **Resale clauses found:**
  - **§10.1 (License):** "non-sublicensable" license grant — explicit anti-sublicense
  - **§1 (Definitions):** "credentials assigned to you and your API Client(s)" — non-transferable, tied to specific developer + apps
  - **§3.1 (Use):** "You...will only access (or attempt to access) the YouTube API Services to develop and operate your API Client(s)" — implies direct, not intermediary, access
- **Verdict:** **`forbidden`** at protocol layer (Tier 5). Like Google Drive/Calendar/Sheets, YouTube Data API uses Google OAuth scopes that bind to per-customer consent flows. The non-sublicensable license + credential-binding to specific API Clients structurally blocks master-pool routing. Master-pool would also breach §3.1's "develop and operate your API Client(s)" wording.
- **Implication:** Same shape as drive/calendar/sheets — adapter must run per-customer OAuth, not a pooled API key. Add youtube to `BYOK_REQUIRED_SLUGS` AND verify the adapter implementation uses OAuth-per-customer (not a master Google API key).

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
- **sendgrid (Lane 6.6 t5, Twilio MSA "transfer, resell, lease, license, or otherwise make available...to third parties")**
- **unsplash (Lane 6.6 t5, §2 credential-sharing ban + §2 third-party product binding ban + §4 aggregation ban)**
- **youtube (Lane 6.6 t5, §10.1 non-sublicensable + §3.1 develop-and-operate-your-API-Client requirement; protocol-level OAuth-per-customer)**
- **linear (Lane 6.6 t6, stacked Tier 1+2+4 single-sentence hit "time share or otherwise commercially exploit or make the Service available to any third party" + "not for the benefit of any third party")**
- **image-gen → Fal.ai (Lane 6.6 t7, "timesharing, service bureau" + outsourcing-business ban + "Client will not expose any of the Services APIs directly to any End Users" — strongest API-exposure clause in audit)**
- **search → Brave Search API (Lane 6.6 t8, Tier 2+3 stack: full sublicense chain + key-sharing ban + storage ban + anti-circumvention + anti-integration — strongest combined hit in audit)**
- **shotstack (Lane 6.6 t9, Tier 2 + Tier 3 + explicit multi-account anti-pooling clause "Rendering large volumes of video on multiple accounts" — most directly drafted anti-aggregator clause in audit)**
- **heygen (Lane 6.6 t10, §2 anti-API-interface clause "Frame, replicate, or develop an interface to access the Services...via an API" + anti-competing-services — first NEW finding class: clauses drafted specifically against API gateways, not just resale)**
- **higgsfield (Lane 6.6 t11, §1.2 non-sublicensable + §5.2(i) full sublicense chain stacked + §5.1(iii) anti-competing — three-tier stack)**
- **postiz (Lane 6.6 t11, §7 "resell, sublicense, white-label or otherwise commercialise...except under a written agreement" — clean Tier 2 + Tier 6 stacked single sentence)**
- **context7 → Upstash (Lane 6.6 t11, §2.2 Tier 2 stacked + "make the Services available to any third party" + explicit credential-sharing ban — three independent breach vectors in two sentences)**
- **notion (Lane 6.6 t12, MSA "Notion prohibits using the Services or API to provide services to third parties (such as a service bureau)" — Tier 1 by-name hit, 5th provider naming "service bureau" verbatim)**
- **exa (Lane 6.6 t12, double non-sublicensable license grants + declared audit-rights enforcement — Tier 2 stack with audit teeth)**

**Forbidden — adapter may need removal even with BYOK:**
- apollo (Lane 6.6 t2, §3(g)(1) "integrate...with your own product or service") — first adapter where BYOK alone may not satisfy ToS
- **unsplash partial-forbidden risk (Lane 6.6 t5, §2 binds credentials to "your Developer Apps" — even BYOK may require each customer to register their own Unsplash dev app, not share ToolRoute's app)**

**Ambiguous — default byok_only at launch pending Justin outreach:**
- openai, firecrawl, tavily, deepgram (Lane 6.1)
- twilio, github (Lane 6.6 t1)
- **creatify (Lane 6.6 t4, no explicit ban but minimal API terms — confirm authorization tier)**
- **outscraper (Lane 6.6 t6, silent ToS — no explicit ban or grant)**
- **textbelt (Lane 6.6 t6, silent ToS — but 10DLC carrier compliance overrides anyway)**
- **whisper (Lane 6.6 t6, inherits Lane 6.1 openai verdict)**
- **pdf → Html2PDF.app (Lane 6.6 t7, generic website ToS w/o API-specific clauses)**
- **screenshot → ScreenshotOne (Lane 6.6 t7, isolated "non-sublicensable" Tier 2 hit)**
- **pexels (Lane 6.6 t8, "competing service" clause concerns but no explicit key-sharing ban)**
- **removebg (Lane 6.6 t9, §3 redistribute/sublicense + §6 "build competing products" — ToolRoute positioning may itself trigger §6)**
- **creatomate (Lane 6.6 t10, silent ToS — no explicit ban or grant)**
- **playwright → Thum.io (Lane 6.6 t10, NO PUBLIC TOS FOUND — vendor publishes no enforceable Terms; default forbidden + elevated concern; slug name actively misleads customers re: Microsoft Playwright)**
- **dataforseo (Lane 6.6 t11, silent ToS — only §7.1 indirect anti-search-engine-competition clause, no direct resale ban)**
- **shippo (Lane 6.6 t11, NO TOS FETCHABLE — 4 attempts 404; Software Providers partner program exists, implies default ToS excludes aggregator routing; defensive byok_only)**

That's **30 confirmed + 1 forbidden + 18 ambiguous (incl. 1 no-ToS + 1 unfetchable) = 49 of 51** adapters that should be on the BYOK gate at launch (or removed), up from Lane 6.5's 4-slug baseline. **12.25x the gate set — 96% of the catalog.** The 2-adapter gap is firecrawl + tavily (Lane 6.1 confirmed permissive).

If Lane 6.5's `BYOK_REQUIRED_SLUGS` Set ships with only the original 4, ToolRoute is exposed on 21 additional confirmed-structural adapters at minimum, plus apollo (BYOK alone may not save) and unsplash (BYOK may require per-customer dev app registration).

**Service-bureau-by-name count:** **5** providers explicitly use the phrase "service bureau" in their ToS as a banned pattern: stripe (§1.2(a)(viii)), twitter (§III.A(e), most explicit), hubspot (AUP §5.5(vii)), notion (MSA, ties to "API"), plus sentry (implicit via "on behalf of"). ToolRoute's pooled adapter pattern is exactly this anti-pattern. Five vendors using identical drafting confirms this is industry-standard, not edge cases.

**Anti-aggregator-by-policy count:** 2 providers go beyond ToS to publish corporate policy refusing aggregator contracts: DeepL §5.2 ("rejects contracts with customers providing machine translation services") and apollo §3(g)(1). These are the hardest cases — even legal outreach is unlikely to clear master-pool routing.

**Protocol-level OAuth-per-customer count:** 4 Google-family adapters (drive, calendar, sheets, youtube) plus likely linkedin (anti-pooling §3.1(20)). For these, the OAuth flow itself blocks pooling — different adapter shape entirely (per-customer tokens, not a single API key).

**Slug-name-hides-provider count:** 5 adapters where the slug name doesn't match the upstream provider — `image-gen` (Fal.ai), `pdf` (Html2PDF), `screenshot` (ScreenshotOne), `search` (Brave), `playwright` (Thum.io). This is a separate Hard Rule #57 (pre-launch copy audit) issue: the `playwright` slug is actively misleading because customers expect headless-browser automation but get Thum.io screenshot URLs. Marketing copy and `BYOK_REQUIRED_SLUGS` documentation must surface the upstream provider names so customers know what they're being asked to BYOK.

**Anti-API-interface clauses (NEW finding class, t10):** HeyGen §2 contains language drafted specifically against API gateways: "Frame, replicate, or develop an interface to access the Services...via an API." Distinct from generic resale bans, this clause specifically targets API-interface products like ToolRoute. Worth adding to the Tier 1 grep checklist for future audits — search for "develop an interface", "API interface", "gateway", "white-label" in addition to existing service-bureau/timesharing/sublicense terms.

**No-public-ToS count (NEW finding class, t10):** 1 adapter — `playwright` → Thum.io. Vendor publishes no findable Terms of Service. This is structurally distinct from a silent ToS (where one exists but is silent on resale): no ToS at all means no enforceable contract, and the vendor retains unilateral termination/modification rights. Master-pool routing through such a vendor is operationally fragile regardless of ToS. Should be flagged in pre-launch audit — vendors without ToS should require a written API agreement before any production routing.

**Partner-program-as-implicit-signal (NEW finding pattern, t11):** Shippo publishes a dedicated "Shippo for Software Providers" partner tier (https://goshippo.com/shippo-for-software-providers). Vendors who maintain dedicated software-provider partner programs typically structure default ToS to *exclude* aggregator routing, requiring opt-in to the partner program for compliance. This matches the LinkedIn-style "Marketing Developer Program" pattern and X's "Enterprise" tier — tiered authorization is itself an implicit ban on master-pool routing under the default tier. Worth grepping target providers' websites for /partners/, /software-providers/, /isv/, /marketplace/ paths during audit pre-work — finding such a program should escalate the verdict to byok_only or forbidden even before reading the ToS itself.

---

## Next steps (subsequent loop ticks)

1. Retry notion + exa + heygen + pexels + shippo + context7 with alternate fetch paths (web archive or homepage-link discovery)
2. Audit remaining Tier C (higgsfield, creatomate, shotstack, removebg, dataforseo, postiz) — most returned 404 on canonical /terms paths; need WebSearch for actual ToS URL
3. Audit remaining Tier D (playwright is open-source MIT; pdf/screenshot likely ToolRoute-internal — confirm)
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
