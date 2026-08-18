# ToolRoute Cost Table Audit

Generated: 2026-04-27

Scope: every runtime adapter slug registered from `src/lib/adapters/*-adapter.ts`.

Method:
- Compared each adapter's `estimateCost()` to public provider pricing where a per-call, per-token, per-minute, per-character, per-email, or per-label price is published.
- Did not change pricing code. Per Lane 5.5, any cost change needs Justin approval.
- Providers with free APIs, SaaS-seat pricing, OAuth-only access, or custom credit systems are marked `unpriced` when no stable public per-call COGS could be mapped to the adapter operation.

## High-Confidence Findings

| Adapter | Code estimate | Public price basis | Finding | Recommendation |
|---|---:|---:|---|---|
| `elevenlabs` | `text.length * 0.0003` = $0.30 / 1k chars | ElevenLabs TTS API shows $0.05 / 1k chars for Flash/Turbo and $0.10 / 1k chars for Multilingual v2/v3 | **Flag: 3x-6x high** | Make TTS cost model-aware: $0.00005/char for Flash/Turbo and $0.00010/char for Multilingual unless ToolRoute wants explicit markup. |
| `translate` | `text.length * 0.00005` = $50 / 1M chars, min $0.001 | DeepL API is character-billed; public third-party trackers list API Pro around $25 / 1M chars plus base fee | **Flag: likely ~2x high** | Confirm exact DeepL dashboard rate, then adjust to account-level base fee + per-character COGS. |
| `exa` | search default $0.005; contents $0.003 | Exa Search is $7 / 1k requests; Contents is $1 / 1k pages | **Flag: search ~29% low, contents ~200% high** | Use operation-specific pricing: search $0.007, contents $0.001 per page/content type. |
| `tavily` | basic search $0.005; advanced $0.01; extract $0.003 | Tavily PAYG is $0.008 / credit; credit consumption depends on endpoint/depth | **Flag: basic likely low** | Map each Tavily operation/depth to official credit usage before changing. |
| `shippo` | create-label $0.05; track $0.001 | Shippo API PAYG lists $0.07 / label after 30 free labels; tracking can be $0.01 per unique tracking number outside Shippo | **Flag: labels low, tracking likely low** | Change label estimate to $0.07 and make tracking context-aware. |
| `vapi` | create-call $0.05 | Vapi platform fee is $0.05 / minute, excluding routed provider costs | **Partial: platform fee only** | Treat this as Vapi platform COGS only; actual all-in call cost needs call duration + STT/LLM/TTS/telephony. |
| `openai`, `claude`, `whisper` | flat/request estimates | OpenAI and Anthropic price by token; Whisper/OpenAI audio price is duration-based | **Flag: not usage-based enough** | Replace flat estimates with token/duration-aware estimates where input size is known. |

## Sources Checked

- OpenAI API pricing: https://openai.com/api/pricing/ and https://platform.openai.com/docs/pricing/
- Anthropic API pricing: https://docs.anthropic.com/en/docs/about-claude/pricing
- Tavily pricing: https://www.tavily.com/pricing and https://docs.tavily.com/guides/api-credits
- Firecrawl pricing/billing: https://www.firecrawl.dev/pricing and https://docs.firecrawl.dev/billing
- Exa pricing: https://exa.ai/pricing and https://exa.ai/docs/changelog/pricing-update
- ElevenLabs API pricing: https://elevenlabs.io/pricing/api/
- Deepgram pricing: https://deepgram.com/pricing
- Replicate pricing: https://replicate.com/pricing
- Resend pricing: https://resend.com/pricing/
- SendGrid pricing: https://sendgrid.com/en-us/pricing
- Twilio SMS pricing: https://www.twilio.com/en-us/sms/pricing/us
- Brave Search API: https://brave.com/search/api/
- fal pricing: https://fal.ai/pricing and https://fal.ai/docs/documentation/model-apis/pricing
- ScreenshotOne pricing: https://screenshotone.com/pricing/
- Exa/DataForSEO/Apollo/Outscraper pricing docs: https://dataforseo.com/apis/serp-api/pricing, https://docs.apollo.io/docs/api-pricing, https://outscraper.com/google-maps-api/
- HeyGen API pricing: https://www.heygen.com/api-pricing
- Shotstack pricing: https://shotstack.io/pricing/
- Shippo API pricing: https://goshippo.com/pricing/api
- Vapi pricing: https://vapi.mintlify.app/pricing
- Pexels API: https://www.pexels.com/api/ and https://help.pexels.com/hc/en-us/articles/360042327714-Does-Pexels-offer-an-API
- Textbelt: https://textbelt.com/
- remove.bg API: https://www.remove.bg/api
- Mux pricing: https://www.mux.com/pricing and https://www.mux.com/docs/pricing/video
- Creatomate pricing: https://creatomate.com/pricing
- Creatify billing/pricing: https://creatify.ai/pricing and https://docs.creatify.ai/billing
- DeepL API billing docs: https://support.deepl.com/hc/en-us/articles/360020685720-Character-count-and-billing-in-DeepL-API

## Full Adapter Matrix

| Adapter | Current estimate basis | Public price match | Audit status | Notes |
|---|---|---|---|---|
| `apollo` | $0.01 default, $0.03 enrich | Apollo API consumes plan credits; exact enrichment credit pricing requires account docs/login | unpriced | Do not change without Apollo account credit schedule. |
| `auto` | delegates to selected adapter or $0.005 default | N/A | ok | Must inherit selected adapter COGS after adapter fixes. |
| `calendar` | $0.001 | Google OAuth BYOK-only; no pooled API COGS | unpriced | Platform fee only. |
| `claude` | approx $0.003 minimum/request | Anthropic token pricing | flagged | Needs token/model-aware billing. |
| `context7` | $0.001 | Public docs API; no public per-call COGS found | unpriced | Platform fee only. |
| `creatify` | $2 create-ad, $0.001 reads | Credit-based plans/API wallet | unpriced | Needs dashboard credit burn mapping per asset type. |
| `creatomate` | $0.50 render, $0.001 reads | Credit-based; images and video minutes consume credits | unpriced | Needs credit-to-dollar mapping by plan. |
| `dataforseo` | $0.002 | SERP live mode can be $0.002/request; queue modes are lower | ok | For live SERP this is within range; keyword/backlink endpoints need operation-specific pricing. |
| `deepgram` | $0.005/request | Deepgram is duration/model-based | flagged | Needs duration-aware STT pricing. |
| `drive` | $0.001 | Google OAuth BYOK-only; no pooled API COGS | unpriced | Platform fee only. |
| `elevenlabs` | $0.30 / 1k chars for TTS | $0.05-$0.10 / 1k chars | flagged | High by 3x-6x. |
| `exa` | $0.005 search, $0.003 contents | $0.007/search request, $0.001/page contents | flagged | Search low; contents high. |
| `firecrawl` | $0.005 scrape, $0.01 crawl, $0.003 map | Credit/subscription based; public page does not expose simple per-operation COGS in static text | needs-dashboard | Verify with Firecrawl credit usage API/dashboard. |
| `github` | $0.001 | GitHub REST API included with account limits | unpriced | Platform fee only. |
| `heygen` | $0.50 create-video, $0.001 reads | API PAYG starts with wallet; older credits docs map 1 credit to video minutes | unpriced | Needs current API dashboard credit burn. |
| `higgsfield` | $0.15 image, $0.50 video, $2.50 character | Credit/model-based AI generation | unpriced | Needs model-by-model pricing. |
| `hubspot` | $0.003 | SaaS/API access plan based | unpriced | Platform fee only unless HubSpot API add-on has usage COGS. |
| `image` | $0.02 generate, $0.03 upscale | fal model-specific fixed price or GPU-second billing | flagged | Needs model-specific pricing from fal model pricing endpoint/page. |
| `linear` | $0.002 | SaaS/API included with Linear account | unpriced | Platform fee only. |
| `linkedin` | $0.002-$0.005 | OAuth/API access, no public per-call COGS found | unpriced | BYOK/social API fee only. |
| `mux` | $0.02 create asset, low read fees | Mux prices by video minutes/storage/delivery | flagged | Needs duration/resolution-aware pricing. |
| `notion` | $0.002 | SaaS/API included with Notion account | unpriced | Platform fee only. |
| `novita` | $0.003 chat | Novita AI prices by token, model-dependent | flagged | Needs model/token-aware pricing, same class as openai/claude. |
| `openai` | $0.005 chat, $0.04 image, $0.0001 embeddings | Token/image-model pricing | flagged | Needs model/token/image-size-aware pricing. |
| `outscraper` | $0.01 maps/reviews, $0.005 emails | Google Maps API by Outscraper starts $3 / 1k places after free tier | flagged | Maps estimate high vs $0.003/place if one returned place; may be ok if multi-place result. |
| `pdf` | $0.005 | html2pdf.app public price not confirmed in static crawl | needs-dashboard | Verify account plan/API unit price. |
| `pexels` | $0.001 | Pexels API is free with limits/attribution | flagged | Provider COGS is $0; keep only if intentional platform fee. |
| `playwright` | $0.002-$0.005 | thum.io/free fetch fallback, no stable paid COGS in adapter | unpriced | Platform fee only. |
| `postiz` | $0.002 create-post, $0.001 reads | Self-hosted/social posting gateway | unpriced | Platform fee only unless Postiz API plan COGS exists. |
| `removebg` | $0.10 | remove.bg credit/image pricing not exposed in static API crawl | needs-dashboard | Verify current credit pack rate. |
| `replicate` | $0.01 run | Hardware/model-second billing | flagged | Needs model/hardware duration-aware pricing. |
| `resend` | $0.001/email | Plan/volume email pricing | likely-ok | Needs plan-specific marginal email cost; $0.001 is plausible platform markup. |
| `screenshot` | $0.005 | ScreenshotOne plan-based screenshots | needs-dashboard | Verify account marginal screenshot price. |
| `search` | $0.003 | Brave Search API pricing page is plan-based; current public per-call amount not shown in static crawl | needs-dashboard | Verify dashboard plan; third-party chatter says $5/1k but not used as source. |
| `sendgrid` | $0.001/email | Plan/volume email pricing | likely-ok | Needs plan-specific marginal email cost. |
| `sentry` | $0.001 | SaaS/API access, no public per-call COGS | unpriced | Platform fee only. |
| `sheets` | $0.001 | Google OAuth BYOK-only; no pooled API COGS | unpriced | Platform fee only. |
| `shippo` | $0.05 labels, $0.001 tracking | $0.07/label PAYG; tracking can be $0.01 outside Shippo labels | flagged | Underpriced for labels/tracking. |
| `shotstack` | $0.30 render, $0.001-$0.005 reads/probe | Render/subscription pricing | needs-dashboard | Verify render unit from Shotstack account/pricing plan. |
| `slack` | $0.001-$0.002 | SaaS/API included with Slack plan limits | unpriced | Platform fee only. |
| `stripe` | $0.002 | Stripe API calls generally no separate API fee beyond payment processing | unpriced | Platform fee only; do not confuse with payment processing fees. |
| `supabase` | $0.001 | Management API included with Supabase plan | unpriced | Platform fee only. |
| `tavily` | $0.003-$0.01 | $0.008/credit PAYG; endpoint credit mapping needed | flagged | Basic search likely low. |
| `textbelt` | $0.005 SMS | Textbelt sells prepaid SMS quota; exact marginal depends on package | needs-dashboard | Verify purchased package effective per-SMS cost. |
| `toolroute` | $0.0005-$0.001 | Internal registry call | ok | Internal platform fee only. |
| `translate` | $50 / 1M chars | DeepL API is character-billed; external trackers report ~$25 / 1M chars plus base fee | flagged | Likely 2x high; confirm exact dashboard price. |
| `twilio` | $0.01 SMS, $0.02 calls | US SMS base outbound is $0.0083/segment plus carrier fees | likely-ok | SMS close after carrier fees; voice needs separate Twilio Voice pricing check. |
| `twitter` | $0.002-$0.005 | X API plan access, no stable per-call COGS found | unpriced | Platform fee only. |
| `unsplash` | $0.001 | Unsplash API is free with limits/terms | flagged | Provider COGS is $0; keep only if intentional platform fee. |
| `vapi` | $0.05 create-call | Vapi platform fee is $0.05/minute excluding routed provider costs | partial | Needs duration and routed provider COGS for all-in estimate. |
| `whisper` | $0.01/call | OpenAI audio transcription is duration-based | flagged | Needs audio duration; current comment assumes ~1 minute but estimate is above old Whisper COGS. |
| `youtube` | $0.002 default, $0.01 upload | YouTube Data API quota units, not direct dollars | unpriced | Needs quota-unit/value policy, not provider COGS. |

## Recommended Follow-Up

1. Convert `estimateCost()` for token/duration/character providers (`openai`, `claude`, `whisper`, `deepgram`, `elevenlabs`, `translate`, `mux`, `vapi`) to input-aware formulas.
2. Add account-dashboard checks for credit systems (`firecrawl`, `creatify`, `creatomate`, `heygen`, `higgsfield`, `removebg`, `shotstack`, `textbelt`, `search`) before changing code.
3. Decide whether free/SaaS APIs should keep a ToolRoute platform fee. If yes, document that `estimateCost()` is customer price, not provider COGS.
