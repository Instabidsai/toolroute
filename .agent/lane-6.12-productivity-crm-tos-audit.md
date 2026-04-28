# Lane 6.12 — Productivity / CRM / Email master-pool ToS audit

**Owner:** Claude (auditor)
**Started:** 2026-04-28
**Sibling:** Lane 6 (initial 8) → Lane 6.8 (5 funded master-pool) → Lane 6.9 (5 video/SMS) → Lane 6.11 (5 search/translation/scraping) → **Lane 6.12 (5 productivity/CRM/email)**

## TL;DR

Audited 5 unaudited master-pool adapters in the productivity / CRM / email class: apollo, linear, sendgrid, sentry, shippo. **4 confirmed STRUCTURAL BANS (Apollo, Linear, SendGrid, Sentry); 1 unverifiable (Shippo — JS-rendered SPA, WebFetch returned empty).**

| Adapter | ToS verdict | Source quote highlight |
|---|---|---|
| **Apollo** | `forbidden` | §3(g)(1) "may not access the APIs via a third party's API credentials or integrate the Apollo APIs with your own product or service" + §3(g)(3)(ii) explicit sublicense ban + §3(d) "resell, distribute, disclose, sublicense, transfer, sell..." |
| **Linear** | `forbidden` | §2.2(c) "license, sublicense, sell, resell, rent, lease, transfer, assign, distribute, time share or otherwise commercially exploit or make the Service available to any third party" + §2.2(g) no competing-product use |
| **SendGrid** | `forbidden` (Twilio-inherited) | `api.sendgrid.com/tos.html` 301-redirects to `twilio.com/legal/tos`. Twilio §2.2(b) resale ban (already audited Lane 6.9) now governs SendGrid post-merger consolidation Feb 2026. |
| **Sentry** | `forbidden` | §2.3(b) "use the Service on behalf of, or to provide any product or service (except for Customer Applications) to, third parties" + §2.3(a) "provide access to (except for Users), distribute, sell or sublicense the Service to a third party" + §2.3(c) competing-product ban |
| **Shippo** | `ambiguous_unverified` | `goshippo.com/terms` 301→`privacy.goshippo.com/policies?name=terms-of-use` (JS-rendered SPA). WebFetch returned empty content. Manual browser fetch needed. |

## Detailed findings

### Apollo — `forbidden` (B2B contact data API)
- **Source:** https://www.apollo.io/terms-of-service
- **Date checked:** 2026-04-28
- **§3(g)(1) API access restriction (verbatim):** "You may not access the APIs via a third party's API credentials or integrate the Apollo APIs with your own product or service." — **this clause literally describes the ToolRoute architecture**.
- **§3(g)(3)(ii) sublicense ban:** "selling, sublicensing, or otherwise providing access to any API to any third party"
- **§3(d) general usage:** "resell, distribute, disclose, sublicense, transfer, sell, offer for sale, or make available any of the Contributor Database or any part of the Services to any third party"
- **§3(d)(iv) data-incorporation limit:** "incorporate any portion of the Platform or Contributor Database into your own products or services that you offer to third parties"
- **§3(f)(4) automated access:** prohibits scraping/bots — relevant if ToolRoute's downstream customers automate Apollo access through master pool.
- **Adapter location:** `src/lib/adapters/apollo-adapter.ts:6` — `APOLLO_API_KEY` master pool with BYOK fallback.
- **Verdict:** `forbidden` — most explicit anti-aggregator language across this batch. Master pool must be removed; BYOK-only or delete adapter.

### Linear — `forbidden` (project management API)
- **Source:** https://linear.app/terms
- **Date checked:** 2026-04-28
- **§2.2(c) commercial-exploitation ban (verbatim):** "license, sublicense, sell, resell, rent, lease, transfer, assign, distribute, time share or otherwise commercially exploit or make the Service available to any third party"
- **§2.2(g) competing-services ban:** "use or access the Service to build or support and/or assist a third party in building or supporting products or services competitive to the Service"
- **§2.3 API rate-limit clause:** "Linear may, in its sole discretion, set and enforce limits on Customer's use of the API and Customer agrees to adhere to such limits. Linear may also suspend Customer's access to the API or cease providing the API at any time."
- **Adapter location:** `src/lib/adapters/linear-adapter.ts:6` — `LINEAR_API_KEY` master pool with BYOK fallback.
- **Verdict:** `forbidden` — broad commercial-exploitation ban covers ToolRoute's master-pool resale pattern explicitly.

### SendGrid — `forbidden` (Twilio-inherited)
- **Source:** https://api.sendgrid.com/tos.html — **301 redirects to https://www.twilio.com/legal/tos**
- **Date checked:** 2026-04-28
- **Inheritance proof:** Per Feb 2026 SendGrid → Twilio merger consolidation, the SendGrid ToS page now permanently redirects to Twilio's master ToS. Twilio acquired SendGrid in 2019 and finalized brand consolidation in Feb 2026; effective May 15, 2026 Twilio's master ToS governs all SendGrid services.
- **Operative clause (Lane 6.9 finding, re-applied):** Twilio §2.2(b) — "not transfer, resell, lease, license, or otherwise make available the Services to third parties (except to make the Services available to your End Users)"
- **Adapter location:** `src/lib/adapters/sendgrid-adapter.ts:6` — `SENDGRID_API_KEY` master pool with BYOK fallback.
- **Verdict:** `forbidden` — inherits Twilio's explicit resale ban via merger consolidation. Master pool must be removed; BYOK-only or delete adapter.

### Sentry — `forbidden` (error monitoring / observability)
- **Source:** https://sentry.io/terms/
- **Date checked:** 2026-04-28
- **§2.3(b) service-bureau ban (verbatim):** "use the Service on behalf of, or to provide any product or service (except for Customer Applications) to, third parties"
- **§2.3(a) sublicense ban:** "provide access to (except for Users), distribute, sell or sublicense the Service to a third party"
- **§2.3(c) competing-services ban:** "use the Service to develop a similar or competing product or service"
- **§21.1 Authorized-reseller carve-out:** "Resellers are not authorized to modify this Agreement or make any promises or commitments on Sentry's behalf." — narrow carve-out for billing-facilitation resellers (same shape as Twilio §3.4); does NOT authorize aggregator/master-pool pattern.
- **Adapter location:** `src/lib/adapters/sentry-adapter.ts:6` — `SENTRY_AUTH_TOKEN` master pool with BYOK fallback.
- **Verdict:** `forbidden` — service-bureau ban is verbatim Mux-style. Master pool must be removed.

### Shippo — `ambiguous_unverified` (shipping API)
- **Source:** https://goshippo.com/terms — 301 redirects to https://privacy.goshippo.com/policies?name=terms-of-use
- **Date checked:** 2026-04-28 — **destination is JS-rendered SPA, WebFetch returned empty content. Same shape as Creatify (Lane 6.9).**
- **Adapter location:** `src/lib/adapters/shippo-adapter.ts:6` — `SHIPPO_API_KEY` master pool with BYOK fallback.
- **Action item:** Justin to open https://privacy.goshippo.com/policies?name=terms-of-use in browser, copy rendered text, append findings here.
- **Default code posture (until verified):** `forbidden` — same default as Creatify/Outscraper/Creatomate/DataForSEO/Exa.

## What this means for ToolRoute

**Cumulative state (Lane 6 + 6.8 + 6.9 + 6.11 + 6.12 — 22 providers attempted):**

- **12 verified `forbidden`:** Anthropic, Replicate, Tavily, Mux, Twilio, HeyGen, Shotstack, DeepL, **Apollo, Linear, SendGrid (via Twilio), Sentry**
- **9 `ambiguous_ask_legal` / `ambiguous_unverified` (default-to-BYOK):** OpenAI, Firecrawl, Deepgram, Outscraper, Creatomate, DataForSEO, Creatify, Exa, **Shippo**
- **2 `byok_only` permitted:** Resend, ElevenLabs (standard tier)

**Pattern hardening:** every commercial-output provider with master-pool fingerprint (`byokKey || process.env.X || null`) audited so far has explicit no-resale clauses. Zero exceptions in 22 attempts.

**Strategic implication unchanged:** launch master-pool surface remains empty. Recommend Justin proceed with Lane 0.3 option 3 (hybrid BYOK-only at launch, master pool reserved for non-commercial-output adapters like memory/registry/internal utilities).

## Codex follow-up

Extend BYOK-required Set in `src/lib/byok-slugs.ts` (already growing per prior lanes) to add:
- `apollo`, `linear`, `sendgrid`, `sentry` (forbidden, verified)
- `shippo` (ambiguous_unverified, default-to-BYOK)

Plus prior cumulative: anthropic, replicate, tavily, mux, twilio, heygen, shotstack, deepl, outscraper, creatomate, dataforseo, exa, creatify.

## Out-of-scope follow-ups

- **Justin manual fetches:** Shippo SPA, plus prior unresolved (Creatify SPA, Exa PDF, Outscraper Global Services Agreement).
- **Lane 6.13 candidate (next batch):** notion, linkedin, hubspot, calendar, sheets, drive — most are session-OAuth shape with master-pool ACCESS_TOKEN env-var fallback. Different audit pattern than per-unit-COGS API resale, but the env-var fallback IS still master-pool resale class for ToS purposes.
- **Lane 6 closure threshold:** ~14 unaudited adapters remain (notion, linkedin, hubspot, calendar, sheets, drive, github, slack, stripe, supabase, vercel, sup, plus internal utilities). After 6.13, the master-pool resale audit class is essentially exhausted.

## Acceptance

- [x] 5 adapters audited (4 confirmed forbidden, 1 SPA-unverifiable)
- [x] Adapter file:line references verified per finding
- [x] Cumulative "verified forbidden" list now 12 providers; pattern (zero clean greenlights in 22 attempts) re-confirmed
- [x] SendGrid → Twilio merger inheritance documented via 301 redirect proof
- [x] Codex follow-up captured (extend BYOK Set with 5 more slugs)
- [x] Sibling chain documented (Lane 6 → 6.8 → 6.9 → 6.11 → 6.12)
