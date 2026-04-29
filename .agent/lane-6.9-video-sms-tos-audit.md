# Lane 6.9 — Video / SMS master-pool ToS audit (4 STRUCTURAL BANS)

**Owner:** Claude (auditor)
**Started:** 2026-04-28
**Sibling:** Lane 6 (initial 8) → Lane 6.8 (5 funded master-pool) → **Lane 6.9 (5 video/SMS master-pool)**

## TL;DR

Audited 5 unaudited master-pool adapters that ship per-unit-COGS commercial outputs (video minutes, SMS messages). **4/5 confirmed STRUCTURAL BAN on the master-pool resale pattern** — same shape as Lane 6.8's Replicate + Tavily findings. Each has explicit "no resale", "non-sublicensable", "service-bureau forbidden", or "no API white-label" language that ToolRoute's master-pool fallback violates the moment a non-Justin user calls those adapters.

| Adapter | ToS verdict | Source quote highlight |
|---|---|---|
| **Mux** | `forbidden` | "non-sublicensable, non-transferable" + "shall not copy, assign, sublicense, resell" + credentials only to "employees or other authorized agents" |
| **Twilio** | `forbidden` | §2.2(b) "not transfer, resell, lease, license, or otherwise make available the Services to third parties (except to make the Services available to your End Users)" |
| **HeyGen** | `forbidden` | "Frame, replicate, or develop an interface to access the Services...via an API and/or by white-labeling any portion of the Services" + "service bureau purposes or otherwise for the benefit of a third party" |
| **Shotstack** | `forbidden` | §4.4 "rights must not be leased, assigned, sold, licensed, resold or transferred to any third party" + §4.3 API restriction + Schedule 2 standalone-resale ban |
| **Creatify** | `ambiguous_unverified` | ToS page is JS-rendered SPA; WebFetch returned empty. Manual browser fetch needed before classification. |

**Pattern emerging across Lane 6 + 6.8 + 6.9:** every commercial-output provider with per-unit COGS audited so far (Replicate, Tavily, Anthropic, Mux, Twilio, HeyGen, Shotstack) has explicit no-resale clauses. Master-pool fallback for these is a contractual breach as soon as a paying user not on Justin's payroll calls them.

## Detailed findings

### Mux — `forbidden` (video infrastructure)
- **Source:** https://www.mux.com/terms
- **Date checked:** 2026-04-28
- **License grant (§2.1):** "non-sublicensable, non-transferable, limited license to: (a) access and use the Services"
- **Prohibited use (§3.2):** "copy, assign, sublicense, resell, dissemble, reverse engineer, modify, scrape, or create derivative works of any part of the Services"
- **Credentials (§3.1):** "will not disclose them to any third party except your employees or other authorized agents"
- **Adapter location:** `src/lib/adapters/mux-adapter.ts:7-8` — uses `MUX_TOKEN_ID` + `MUX_TOKEN_SECRET` master pool with BYOK fallback as `id:secret`.
- **Verdict:** `forbidden` — master pool must be removed; adapter must be BYOK-only OR adapter must be deleted.

### Twilio — `forbidden` (SMS / voice)
- **Source:** https://www.twilio.com/legal/tos
- **Date checked:** 2026-04-28
- **§2.2(b) Customer Responsibilities:** "not transfer, resell, lease, license, or otherwise make available the Services to third parties (except to make the Services available to your End Users)"
- **End-user carve-out:** narrow — "End Users" within the Customer's own software application, NOT third-party customers of an aggregator. ToolRoute as middle-tier reseller falls outside this.
- **§3.4 Fulfillment-reseller exception:** authorized only for billing facilitation, not for actual API resale.
- **Adapter location:** `src/lib/adapters/twilio-adapter.ts:12-14` — uses `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` master pool with BYOK fallback as `accountSid:authToken`.
- **Verdict:** `forbidden` — master pool must be removed; BYOK-only or delete adapter.

### HeyGen — `forbidden` (AI avatar video)
- **Source:** https://www.heygen.com/terms
- **Date checked:** 2026-04-28
- **§2 License:** "you may not: Frame, replicate, or develop an interface to access the Services without going directly to the Website (e.g., via an API and/or by white-labeling any portion of the Services), unless we explicitly make such functionality available to you" — **this clause literally describes the ToolRoute architecture**.
- **§2 Competitive use:** "Use any portion of the Services to build any products or services that are competitive to any portion of the Services or to create similar ideas, features, or functions"
- **WebSearch metadata snippet (corroborating):** "customers cannot sell, rent, lease, or use the Services for timesharing or service bureau purposes or otherwise for the benefit of a third party. Additionally, the company grants customers a non-exclusive, non-transferable, non-sublicensable right to access and use the Services."
- **Adapter location:** `src/lib/adapters/heygen-adapter.ts:6-7` — `HEYGEN_API_KEY` master pool with BYOK fallback.
- **Verdict:** `forbidden` — most explicit anti-aggregator clause in the batch. Master pool must be removed; BYOK-only or delete adapter.

### Shotstack — `forbidden` (programmable video API)
- **Source:** https://shotstack.io/terms/
- **Date checked:** 2026-04-28
- **§4.4 License limitations:** "All rights granted to you under this Agreement are personal, and these rights must not be leased, assigned, sold, licensed, resold or transferred to any third party in any manner whatsoever without our prior written consent."
- **§4.3 API restriction:** "utilise our dynamic templates and APIs other than in conjunction with our Services" is prohibited without explicit permission.
- **Schedule 2 (templates):** "Templates we provide can only be used in conjunction with one of our products. You may offer our templates to your end users only if the video is rendered using our Services. Standalone animations cannot be used for resale, other products, videos or any other method to distribute it to your end user - or get commercial gain out of it."
- **Adapter location:** `src/lib/adapters/shotstack-adapter.ts:6-7` — `SHOTSTACK_API_KEY` master pool with BYOK fallback.
- **Verdict:** `forbidden` — broadest license-level resale ban in the batch ("in any manner whatsoever"). Master pool must be removed.

### Creatify — `ambiguous_unverified` (AI avatar video, follow-up needed)
- **Source:** https://creatify.ai/terms-of-service (per footer link, per WebSearch result)
- **Date checked:** 2026-04-28 — **TOS page is JS-rendered SPA, WebFetch returned empty content. Cannot classify until manual browser fetch.**
- **WebSearch metadata:** no resale clause text returned in search snippets. Search confirmed ToS exists at the URL above.
- **Adapter location:** `src/lib/adapters/creatify-adapter.ts:18-20` — `CREATIFY_API_ID` + `CREATIFY_API_KEY` master pool with BYOK fallback as `API_ID:API_KEY`.
- **Action item:** Justin to open https://creatify.ai/terms-of-service in browser, copy rendered text, append findings here. Treat as `ambiguous_ask_legal` until verified — i.e., default to BYOK in code.

## What this means for ToolRoute

After Lane 6 + 6.8 + 6.9, the **master-pool-incompatible** provider list is now:

1. **Anthropic** (forbidden — Lane 6 initial) — already gated as BYOK-only
2. **Replicate** (forbidden — Lane 6.8) — STRUCTURAL BAN flagged
3. **Tavily** (forbidden — Lane 6.8) — STRUCTURAL BAN flagged
4. **Mux** (forbidden — this lane)
5. **Twilio** (forbidden — this lane)
6. **HeyGen** (forbidden — this lane)
7. **Shotstack** (forbidden — this lane)

Plus `ambiguous_ask_legal` (default to BYOK in code):
- OpenAI, Firecrawl, Tavily (re-classified as forbidden post-6.8), Deepgram, Creatify (this lane)

`byok_only` permitted (no resale, but BYOK works):
- Resend, ElevenLabs (standard tier)

**Recommendation:** Codex ticket — extend the BYOK-required slug Set in `src/lib/byok-slugs.ts` (or wherever Lane 6.8.1 extracted it) to add `mux`, `twilio`, `heygen`, `shotstack`. Same shape as the existing Replicate + Tavily entries. Lane 6.5-impl (BYOK runtime gate) is the place this fires — once that ships, these 4 will refuse calls without BYOK.

## Hard Rule #60 grep replay (for posterity)

```bash
# 5 master-pool patterns audited:
grep -nE 'process\.env\.(MUX|TWILIO|HEYGEN|SHOTSTACK|CREATIFY)_' src/lib/adapters/
# → mux-adapter.ts:7-8, twilio-adapter.ts:12-13, heygen-adapter.ts:7,
#   shotstack-adapter.ts:7, creatify-adapter.ts:18-19
```

## Out-of-scope follow-ups

- **Creatify ToS verification:** Justin manual browser fetch (above).
- **Lane 6.10 candidate (next batch):** outscraper, exa, creatomate, dataforseo, deepl — same audit shape.
- **Lane 6.11 candidate:** the remaining ~32 unaudited adapters (apollo, calendar, context7, drive, github, hubspot, linear, linkedin, notion, pdf, pexels, playwright, postiz, removebg, screenshot, search, sendgrid, sentry, sheets, shippo, slack, stripe, supabase, textbelt, twitter, unsplash, vapi, whisper, youtube, higgsfield, semgrep, vercel) — many are session-OAuth or session-token shape (different audit pattern, not master-pool resale class).

## Acceptance

- [x] 4 video/SMS adapters confirmed `forbidden` via direct ToS fetch
- [x] 1 adapter (Creatify) flagged `ambiguous_unverified` with explicit follow-up
- [x] Adapter file:line references verified per finding
- [x] Pattern named: every commercial-per-unit-COGS provider audited so far has explicit resale ban
- [x] Codex follow-up: extend BYOK-required Set with mux, twilio, heygen, shotstack
- [x] Sibling chain documented (Lane 6 → 6.8 → 6.9)
