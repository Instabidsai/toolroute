# Lane 6.6 — Provider ToS resale audit, pass 2 (remaining 43 adapters)

**Owner:** Claude (auditor)
**Status:** in-progress (28 of 43 verified across 8 ticks; classification expanded — internal-aggregator slugs reclassified as third-party wrappers)
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
stripe ✓, twilio ✓, vapi ✓, sendgrid ✓, textbelt ✓, shippo ⏳

**Tier B — data infra + auth-gated business APIs:**
supabase ✓, github ✓, sentry ✓, apollo ✓, slack ✓, drive ✓, calendar ✓, sheets ✓, hubspot ✓, linkedin ✓, twitter ✓, notion ⏳

**Tier C — AI/ML inference (LLM-adjacent):**
deepl ✓, mux ✓, creatify ✓, exa ⏳, heygen ⏳, higgsfield, creatomate, shotstack, whisper ✓, removebg, dataforseo, outscraper ✓, postiz, context7 ⏳

**Tier D — stock media (lower risk, often permissive):**
pexels ✓, unsplash ✓, youtube ✓, linear ✓, image-gen ✓ (Fal.ai), pdf ✓ (Html2PDF), screenshot ✓ (ScreenshotOne), search ✓ (Brave), playwright ⏳ (Thum.io), auto (internal ✓), toolroute (internal ✓)

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

That's **23 confirmed + 1 forbidden + 13 ambiguous = 37 of 51** adapters that should be on the BYOK gate at launch (or removed), up from Lane 6.5's 4-slug baseline. **9.25x the gate set — 73% of the catalog.**

If Lane 6.5's `BYOK_REQUIRED_SLUGS` Set ships with only the original 4, ToolRoute is exposed on 19 additional confirmed-structural adapters at minimum, plus apollo (BYOK alone may not save) and unsplash (BYOK may require per-customer dev app registration).

**Service-bureau-by-name count:** 4 providers explicitly use the phrase "service bureau" in their ToS as a banned pattern: stripe, sentry (implicit via "on behalf of"), twitter (most explicit), hubspot. ToolRoute's pooled adapter pattern is exactly this anti-pattern.

**Anti-aggregator-by-policy count:** 2 providers go beyond ToS to publish corporate policy refusing aggregator contracts: DeepL §5.2 ("rejects contracts with customers providing machine translation services") and apollo §3(g)(1). These are the hardest cases — even legal outreach is unlikely to clear master-pool routing.

**Protocol-level OAuth-per-customer count:** 4 Google-family adapters (drive, calendar, sheets, youtube) plus likely linkedin (anti-pooling §3.1(20)). For these, the OAuth flow itself blocks pooling — different adapter shape entirely (per-customer tokens, not a single API key).

**Slug-name-hides-provider count:** 5 adapters where the slug name doesn't match the upstream provider — `image-gen` (Fal.ai), `pdf` (Html2PDF), `screenshot` (ScreenshotOne), `search` (Brave), `playwright` (Thum.io). This is a separate Hard Rule #57 (pre-launch copy audit) issue: the `playwright` slug is actively misleading because customers expect headless-browser automation but get Thum.io screenshot URLs. Marketing copy and `BYOK_REQUIRED_SLUGS` documentation must surface the upstream provider names so customers know what they're being asked to BYOK.

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
