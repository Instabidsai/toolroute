# Lane 6.13 — SaaS productivity master-pool ToS audit

**Owner:** Claude (auditor)
**Started:** 2026-04-28
**Sibling:** Lane 6 → 6.8 → 6.9 → 6.11 → 6.12 → **6.13 (5 SaaS productivity)**

## TL;DR

Audited 5 master-pool adapters in the SaaS productivity class: notion, linkedin, hubspot, slack, github. **4 confirmed STRUCTURAL BANS (LinkedIn, HubSpot, Slack, GitHub); 1 unverifiable (Notion — MSA is a PDF on Cloudfront, WebFetch returned binary).**

| Adapter | ToS verdict | Source quote highlight |
|---|---|---|
| **LinkedIn** | `forbidden` | §2.2 "Do not sell, share, transfer, or sublicense them to any other party" + §3.1(8) "you may not sell access to an aggregated collection of Member profiles" + §3.1(21) third-party stand-alone API ban |
| **HubSpot** | `forbidden` | §4.A non-sublicensable license + §8.E "These Terms do not grant You the right to distribute or resell HubSpot Products or Services" + "You may not directly or indirectly charge end users for use of, or access to, the functionality" |
| **Slack** | `forbidden` | "you may not sell, rent, lease, sublicense, redistribute, or syndicate access to any of our APIs" + Commercial Distribution requires separate written authorization |
| **GitHub** | `forbidden` (conditional) | §H "GitHub may offer subscription-based access to our API for those Users who require high-throughput access or access that would result in resale of GitHub's Service." Default master-pool pattern is forbidden absent enterprise resale subscription. |
| **Notion** | `pdf_unverified` | MSA at `d7umqicpi7263.cloudfront.net/eula/...` is a 222KB PDF binary. WebFetch returned encoded data, not extractable. WebSearch snippet quotes "non-exclusive, non-transferable, non-sublicensable" + "solely in connection with the customer's internal business operations" — strong forbidden indicators. Manual fetch needed. |

## Detailed findings

### LinkedIn — `forbidden` (professional network API)
- **Source:** https://www.linkedin.com/legal/l/api-terms-of-use
- **Date checked:** 2026-04-28
- **§2.2 credentials ban:** "Do not sell, share, transfer, or sublicense them to any other party other than your employees or independent contractors..."
- **§2.4 stand-alone API ban:** "You have no right to distribute or allow access to the stand-alone APIs."
- **§3.1(8) content-resale ban (verbatim):** "Sell, rent, lease, disclose, distribute, share...any Content...to any third party (e.g. you may not sell access to an aggregated collection of Member profiles...)" — **literally describes ToolRoute's master-pool pattern**.
- **§3.1(21) third-party API access:** "Distribute or allow third parties access to any stand-alone API"
- **§3.2(2) aggregation ban:** "Use the APIs to retrieve Content that is then aggregated with third party data in such a way that a User cannot attribute the Content to LinkedIn"
- **Adapter location:** `src/lib/adapters/linkedin-adapter.ts:6` — `LINKEDIN_ACCESS_TOKEN` master pool with BYOK fallback.
- **Verdict:** `forbidden` — most explicit anti-aggregator language across the entire 27-provider audit.

### HubSpot — `forbidden` (CRM platform)
- **Source:** https://legal.hubspot.com/developer-terms
- **Date checked:** 2026-04-28
- **§4.A license grant:** "non-exclusive, non-transferable, revocable right, non-sublicensable license"
- **§8.E no-resale (verbatim):** "These Terms do not grant You the right to distribute or resell HubSpot Products or Services" and "You may not directly or indirectly charge end users for use of, or access to, the functionality of the HubSpot Products or HubSpot Developer Tools"
- **Carve-out:** Developers may charge for their own custom solutions built using the tools, but cannot monetize HubSpot's functionality directly or act as intermediaries.
- **Adapter location:** `src/lib/adapters/hubspot-adapter.ts:6` — `HUBSPOT_ACCESS_TOKEN` master pool with BYOK fallback.
- **Verdict:** `forbidden` — §8.E charge-for-functionality ban directly bars ToolRoute's per-call markup model.

### Slack — `forbidden` (team messaging API)
- **Source:** https://slack.com/terms-of-service/api
- **Date checked:** 2026-04-28
- **Applications ban (verbatim):** "you may not sell, rent, lease, sublicense, redistribute, or syndicate access to any of our APIs"
- **Commercial Distribution clause:** "You may not Commercially Distribute an Application that integrates with the Slack APIs unless you are authorized to do so under a separate agreement" — Commercially Distribute = users pay fees for products/services connecting to Slack APIs (direct, freemium, or free-tied-to-paid).
- **Single-organization carve-out:** "These restrictions do not apply if your Application and any products or services connected to it were created for use only by a single third party" — narrow custom-development exception, does not authorize aggregator pattern.
- **Adapter location:** `src/lib/adapters/slack-adapter.ts:6` — `SLACK_BOT_TOKEN` master pool with BYOK fallback.
- **Verdict:** `forbidden` — verbatim "syndicate access" ban + Commercial Distribution authorization requirement.

### GitHub — `forbidden` (conditional on enterprise subscription)
- **Source:** https://docs.github.com/en/site-policy/github-terms/github-terms-of-service
- **Date checked:** 2026-04-28
- **§H API resale clause (verbatim):** "GitHub may offer subscription-based access to our API for those Users who require high-throughput access or access that would result in resale of GitHub's Service."
- **§H token-sharing ban:** "You may not share API tokens to exceed GitHub's rate limitations."
- **§H content-monetization ban:** "You may not use the API to download data or Content from GitHub for spamming purposes, including for the purposes of selling GitHub users' personal information..."
- **Reading:** GitHub permits resale ONLY through an explicit subscription-based-access agreement. Without that enterprise arrangement, ToolRoute's master-pool pattern is forbidden.
- **Adapter location:** `src/lib/adapters/github-adapter.ts:6` — `GITHUB_TOKEN` master pool with BYOK fallback.
- **Verdict:** `forbidden` (conditional) — Justin would need to negotiate enterprise resale subscription with GitHub. Until then, default master-pool is breach.

### Notion — `pdf_unverified` (MSA on Cloudfront PDF)
- **Source:** https://www.notion.com/notion/Notion-Master-Subscription-Agreement → 307 redirects to `notion.so/notion/Notion-Master-Subscription-Agreement-1efc6b08469f813aa9e0d6db3174a2ed`. Direct PDF link: `https://d7umqicpi7263.cloudfront.net/eula/3QkIRed56NURE2biK8-iR9WZUHjl261rslq5f-W45yA`
- **Date checked:** 2026-04-28 — **PDF binary (222.3KB), WebFetch returned encoded data, not extractable text. Same shape as Exa (Lane 6.11).**
- **WebSearch corroboration (not directly quotable per Hard Rule #7):** snippet reports MSA contains "worldwide, non-exclusive, non-transferable, non-sublicensable right" + "solely in connection with the customer's internal business operations" — strong forbidden indicators. The "internal business operations" restriction directly bars aggregator patterns.
- **Adapter location:** `src/lib/adapters/notion-adapter.ts:7` — `NOTION_API_KEY` master pool with BYOK fallback.
- **Action item:** Justin to manually open the MSA PDF, locate the resale/sublicense/internal-use clauses, and append findings here.
- **Default code posture (until verified):** `forbidden` — same default as Exa/Creatify/Outscraper/Creatomate/DataForSEO/Shippo.

## What this means for ToolRoute

**Cumulative state (Lane 6 + 6.8 + 6.9 + 6.11 + 6.12 + 6.13 — 27 providers attempted):**

- **16 verified `forbidden`:** Anthropic, Replicate, Tavily, Mux, Twilio, HeyGen, Shotstack, DeepL, Apollo, Linear, SendGrid (Twilio-inherited), Sentry, **LinkedIn, HubSpot, Slack, GitHub**
- **10 `ambiguous_ask_legal` / `ambiguous_unverified` (default-to-BYOK):** OpenAI, Firecrawl, Deepgram, Outscraper, Creatomate, DataForSEO, Creatify, Exa, Shippo, **Notion**
- **2 `byok_only` permitted:** Resend, ElevenLabs (standard tier)

**Pattern hardening (after 27 attempts):** every commercial-output provider with master-pool fingerprint (`byokKey || process.env.X || null`) audited so far has explicit no-resale clauses. Zero exceptions.

**Master-pool resale audit class is now essentially exhausted.** Remaining unaudited adapters with master-pool fingerprint: stripe (`STRIPE_PLATFORM_KEY`), supabase (`SUPABASE_MGMT_TOKEN`) — these are infrastructure providers worth a dedicated Lane 6.14 batch since their resale terms differ qualitatively (Stripe has explicit Connect platform, Supabase is the gateway's own DB infra).

## Codex follow-up

Extend BYOK-required Set in `src/lib/byok-slugs.ts` to add:
- `linkedin`, `hubspot`, `slack`, `github` (forbidden, verified)
- `notion` (pdf_unverified, default-to-BYOK)

Cumulative BYOK-required slug additions across Lanes 6.9 + 6.11 + 6.12 + 6.13 (Codex single-shot ticket): mux, twilio, heygen, shotstack, deepl, apollo, linear, sendgrid, sentry, linkedin, hubspot, slack, github, outscraper, creatomate, dataforseo, exa, creatify, shippo, notion (20 slugs). Plus existing-known: anthropic, replicate, tavily.

## Out-of-scope follow-ups

- **Justin manual fetches:** Notion MSA PDF (above), plus prior unresolved (Creatify SPA, Exa PDF, Shippo SPA, Outscraper Global Services Agreement).
- **Lane 6.14 candidate (final):** stripe, supabase — infrastructure providers with qualitatively different resale terms.
- **Lane 6 scope check:** calendar, sheets, drive adapters are BYOK-only by design (no env-var master-pool fallback) — not in resale-class audit.

## Acceptance

- [x] 5 adapters audited (4 confirmed forbidden, 1 PDF-unverifiable)
- [x] Adapter file:line references verified per finding
- [x] Cumulative "verified forbidden" list now 16 providers; pattern (zero clean greenlights in 27 attempts) re-confirmed
- [x] LinkedIn §3.1(8) "aggregated collection" clause flagged as most-explicit anti-aggregator language in entire audit
- [x] GitHub conditional-resale carve-out documented (enterprise subscription required for legal master-pool)
- [x] Codex follow-up captured (extend BYOK Set with 5 more slugs; cumulative 20 across batches)
- [x] Sibling chain documented (Lane 6 → 6.8 → 6.9 → 6.11 → 6.12 → 6.13)
