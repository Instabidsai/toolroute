# Lane 6.11 — Search/translation/scraping master-pool ToS audit

**Owner:** Claude (auditor)
**Started:** 2026-04-28
**Sibling:** Lane 6 (initial 8) → Lane 6.8 (5 funded master-pool) → Lane 6.9 (5 video/SMS) → **Lane 6.11 (5 search/translation/scraping)**
*Note: Lane 6.10 number is taken by an unrelated tier-copy drift task (#74). Numbered 6.11 to avoid collision.*

## TL;DR

Audited 5 unaudited master-pool adapters in the search / translation / scraping class: outscraper, exa, creatomate, dataforseo, deepl. **1 confirmed STRUCTURAL BAN (DeepL), 3 AMBIGUOUS (Outscraper, Creatomate, DataForSEO — ToS silent or behind signup gate), 1 UNVERIFIABLE (Exa — ToS is PDF-binary, WebFetch can't extract).**

| Adapter | ToS verdict | Why |
|---|---|---|
| **DeepL** | `forbidden` | §8.1.4 "Customer is not entitled to repackage or resell access credentials or its access to the Services to any third parties unless expressly agreed by DeepL in advance in writing." |
| **Outscraper** | `ambiguous_ask_legal` | Public ToS silent; references gated "Global Services Agreement" (legal@outscraper.com) for commercial terms. |
| **Creatomate** | `ambiguous_ask_legal` | ToS focuses on usage; explicit IP-ownership clause but no resale/aggregator language either way. |
| **DataForSEO** | `ambiguous_ask_legal` | §7.1-7.2 bars using SERP data to "compete with or adversely affect the business interests of the search engine providers" — affects downstream use, not direct API resale. Silent on aggregator pattern. |
| **Exa** | `pdf_unverified` | ToS is `https://exa.ai/assets/Exa_Labs_Terms_of_Service.pdf` (208.9KB binary). WebFetch returned encoded data, not extractable text. Manual fetch + read needed. |

## Detailed findings

### DeepL — `forbidden` (translation API)
- **Source:** https://www.deepl.com/en/pro-license
- **Date checked:** 2026-04-28
- **§8.1.4 Resale prohibition (verbatim):** "Customer is not entitled to repackage or resell access credentials or its access to the Services to any third parties unless expressly agreed by DeepL in advance in writing."
- **§7.1 License grant:** "DeepL grants Customer a non-exclusive, **non-transferable, non-sublicensable** worldwide right to use...the Services"
- **§8.1.1.f:** prohibits "create a similar product, service or API whose primary purpose is to provide services based on machine learning, including but not limited to translations"
- **§8.1.9 (CAT-tool integration):** "Customer is expressly prohibited from utilising the API via CAT tool integration to create a similar product or service"
- **Adapter location:** `src/lib/adapters/deepl-adapter.ts:7` — `DEEPL_API_KEY` master pool with BYOK fallback.
- **Verdict:** `forbidden` — same shape as Mux/HeyGen/Shotstack. Master pool must be removed; BYOK-only or delete adapter.

### Outscraper — `ambiguous_ask_legal` (Google Maps / business data scraping)
- **Source:** https://outscraper.com/terms-of-service/
- **Date checked:** 2026-04-28
- **Public ToS:** does not address API resale, redistribution, sublicensing, white-labeling, or service-bureau patterns directly.
- **Gated agreement:** "By using this service, you agree to: These Outscraper Terms [and] The Global Services Agreement" — Global agreement available "during signup via click-through" and on email request to legal@outscraper.com. The commercial terms relevant to ToolRoute's master-pool pattern likely live there.
- **Adapter location:** `src/lib/adapters/outscraper-adapter.ts:6` — `OUTSCRAPER_API_KEY` master pool with BYOK fallback.
- **Action item:** Justin — sign up for Outscraper account to read the Global Services Agreement, OR email legal@outscraper.com requesting the full agreement before relying on master pool.
- **Default code posture (until verified):** treat as `forbidden` and remove master pool — same default as Anthropic/Tavily before clarifying.

### Creatomate — `ambiguous_ask_legal` (programmable video API)
- **Source:** https://creatomate.com/terms-of-service
- **Date checked:** 2026-04-28
- **IP clause (verbatim):** "The Service and its original content...features and functionality are and will remain the exclusive property of the Company"
- **No resale/sublicense/aggregator language** found in either direction.
- **Comparable:** Shotstack's ToS (Lane 6.9) explicitly bars "in any manner whatsoever" — Creatomate is silent. Both serve programmable-video, both have per-render COGS. The fact that Creatomate is silent where Shotstack is explicit doesn't permit the master-pool pattern; it just means clarification is needed.
- **Adapter location:** `src/lib/adapters/creatomate-adapter.ts:6` — `CREATOMATE_API_KEY` master pool with BYOK fallback.
- **Action item:** email Creatomate sales/support for explicit aggregator authorization.
- **Default code posture (until verified):** `forbidden`.

### DataForSEO — `ambiguous_ask_legal` (SERP data API)
- **Source:** https://dataforseo.com/terms-of-service
- **Date checked:** 2026-04-28
- **§7.1-7.2 (downstream use restriction):** "any search engine results page (SERP) data or content obtained through the Service...shall not be used to compete with or adversely affect the business interests of the search engine providers"
- **Reading:** This restricts what ToolRoute customers can DO with the data, not whether ToolRoute can resell DataForSEO's API. It bars competing with Google/Bing, not bars reselling DataForSEO. ToS is silent on the aggregator pattern itself.
- **Indirect tail risk:** ToolRoute's downstream customers may do exactly the prohibited thing (rebuild a search engine with DataForSEO data). Liability indemnification clause: "You agree to indemnify, defend, and hold harmless DataForSEO from any and all claims, damages and losses arising from or relating to Your violation" — ToolRoute holds the bag if customers misuse SERP data.
- **Adapter location:** `src/lib/adapters/dataforseo-adapter.ts:5-6` — `DATAFORSEO_LOGIN` + `DATAFORSEO_PASSWORD` master pool with BYOK fallback.
- **Action item:** email support@dataforseo.com for aggregator-tier authorization. ALSO: add downstream-use-restriction to ToolRoute's own ToS for any DataForSEO output.
- **Default code posture (until verified):** `forbidden`.

### Exa — `pdf_unverified` (search API)
- **Source:** https://exa.ai/assets/Exa_Labs_Terms_of_Service.pdf (208.9KB PDF binary)
- **Date checked:** 2026-04-28 — WebFetch returned binary-encoded data, no extractable text. Saved to local artifact path; not available to parse here.
- **Adapter location:** `src/lib/adapters/exa-adapter.ts:6` — `EXA_API_KEY` master pool with BYOK fallback.
- **Action item:** Justin — open the PDF locally, scan for resale/sublicense/aggregator clauses, append findings here.
- **Default code posture (until verified):** `forbidden`.

## What this means for ToolRoute

**Pattern across Lane 6 + 6.8 + 6.9 + 6.11 (17 providers attempted):**

- Verified `forbidden`: 8 providers (Anthropic, Replicate, Tavily, Mux, Twilio, HeyGen, Shotstack, **DeepL**)
- `byok_only` permitted (no resale, BYOK works): Resend, ElevenLabs (standard tier)
- `ambiguous_ask_legal` (defaulting to BYOK): OpenAI, Firecrawl, Deepgram, Outscraper, Creatomate, DataForSEO, Creatify, Exa

**Zero providers in the entire audit have unambiguous master-pool ToS authorization.** The launch master-pool surface is empty. Justin's three options:

1. Drop master pool entirely; ToolRoute is BYOK-only routing/aggregator. Pricing model becomes subscription + routing fee, not credits-against-pooled-COGS.
2. Negotiate enterprise resale rights individually with OpenAI, Firecrawl, Deepgram, etc. before launch. Each adds a sales cycle.
3. Hybrid: ship BYOK-only at launch for the 8 confirmed-forbidden providers + 8 ambiguous; reserve master pool for non-commercial-output adapters (memory, registry tools, internal utilities).

This is the Lane 0.3 decision Justin owns. Recommend option 3 as MVP — it's the only one that ships without legal risk or stalled enterprise negotiations.

## Codex follow-up

Extend BYOK-required Set in `src/lib/byok-slugs.ts` to add (in addition to Lane 6.9's mux/twilio/heygen/shotstack):
- `deepl` (forbidden, verified)
- `outscraper`, `creatomate`, `dataforseo`, `exa`, `creatify` (ambiguous, default-to-BYOK)

Plus existing-known: anthropic, replicate, tavily.

## Out-of-scope follow-ups

- Justin manual fetches for: Outscraper Global Services Agreement, Exa PDF, Creatify SPA ToS (deferred from Lane 6.9).
- Lane 6.12 candidate (next batch): apollo, calendar, hubspot, linear, linkedin, notion, sendgrid, sentry, sheets, shippo — most of these are session-OAuth or session-token shape (different audit pattern, not master-pool resale class).

## Acceptance

- [x] 5 adapters audited (1 confirmed forbidden, 3 ambiguous, 1 unverifiable-PDF)
- [x] Adapter file:line references verified per finding
- [x] Cumulative "verified forbidden" list now 8 providers; "no clean greenlight" launch posture surfaced for Justin
- [x] Codex follow-up captured (extend BYOK Set with 5 more slugs)
- [x] Sibling chain documented (Lane 6 → 6.8 → 6.9 → 6.11)
