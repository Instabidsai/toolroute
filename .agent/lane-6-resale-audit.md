# Lane 6 — Provider ToS resale audit

**Owner:** Claude (auditor)
**Status:** in-progress
**Started:** 2026-04-27
**Last updated:** 2026-04-28 (Lane 6.13 added — LinkedIn/HubSpot/Slack/GitHub forbidden + Notion PDF unverified)

## Why this matters

ToolRoute's pricing model (Lane 0.3 — Justin to decide) hinges on whether each provider's Terms of Service permit ToolRoute to:

- **Master-pool model**: ToolRoute holds one provider account, marks up calls, and bills end-customers. (= reselling provider API access.)
- **BYOK model**: End-customer brings their own provider key; ToolRoute is a passthrough router. (= no resale; ToolRoute is a tool, not a reseller.)
- **Hybrid model**: Both supported per-tool. Some tools master-pool only, others BYOK only.

A clause that prohibits resale, sublicensing, or redistribution of API access forces BYOK for that provider. A clause that explicitly permits "building applications" or "offering services on top" is compatible with master-pool.

## Audit format per provider

For each provider:

1. **Source URL** — link to current ToS.
2. **Date checked** — when this row was last verified.
3. **Resale clause** — exact relevant quote (or "not addressed").
4. **Verdict** — `master_pool_ok` / `byok_only` / `ambiguous_ask_legal` / `forbidden`.
5. **Notes** — caveats, rate-limit / branding / disclosure requirements.

## Providers

### OpenAI
- **Source:** https://openai.com/policies/services-agreement/ (effective 2026-01-01) / https://openai.com/policies/service-terms/ (effective 2026-01-09) / https://openai.com/policies/business-terms/
- **Date checked:** 2026-04-27 — **WebFetch 403'd 4x, archive.org blocked. Manual verification required.**
- **Resale clause (historical, August 2023 Business Terms — likely retained verbatim or tightened):** "You may not make account access credentials available to third parties, share individual login credentials between multiple users on an account, or resell or lease access to your account or any End User Account."
- **Verdict:** `ambiguous_ask_legal` pending manual fetch. Historical "no resell or lease access to your account" reads as forbidding ToolRoute master-pool's literal pattern (one OpenAI account → many ToolRoute customers). HOWEVER, OpenAI broadly permits "building products that use the API" via the End User construct — the question is whether ToolRoute customers count as "End Users of ToolRoute's product" (master_pool_ok) or as "third parties resold OpenAI access" (forbidden).
- **Notes:**
  - Output ownership transfers to customer per ToS — ToolRoute middleman pass-through is fine.
  - Must not use output to train competing models — propagate to ToolRoute customers via ToS.
  - **Justin: open the OpenAI account dashboard or copy the rendered Business Terms HTML manually — WebFetch is blocked at the CDN layer.** Until verified, treat as `ambiguous` and BYOK for safety.

### Anthropic
- **Source:** https://www.anthropic.com/legal/commercial-terms (effective 2025-06-17)
- **Date checked:** 2026-04-27
- **Resale clause (D.4 Use Restrictions):** "Customer may not and must not attempt to (a) access the Services to build a competing product or service, including to train competing AI models or **resell the Services except as expressly approved by Anthropic**"
- **Verdict:** `forbidden` for master-pool absent written Anthropic approval. `master_pool_ok` ONLY with explicit enterprise contract permitting resale.
- **Notes:**
  - Customers' Users must comply with Usage Policy (D.2) — ToolRoute's ToS must propagate this downstream.
  - No mandatory end-user attribution required, but Anthropic may publicly identify ToolRoute as a customer (G).
  - Outputs are not used to train Anthropic models (B), but ToolRoute's own customers may not use Outputs to train competing models — ToolRoute should propagate this in its ToS.
  - **Implication:** Anthropic must default to BYOK in ToolRoute. Master-pool requires Justin to negotiate written resale rights with Anthropic enterprise team — otherwise ToolRoute is in breach the moment a non-Anthropic-approved customer hits the master pool.

### Resend
- **Source:** https://resend.com/legal/terms-of-service (last update 2025-12-31)
- **Date checked:** 2026-04-27
- **Resale clause:** Silent. ToS does not explicitly prohibit or permit resale.
- **Acceptable use:** Customer is responsible for all Message Content + recipient consent. Acceptable Use Policy (resend.com/legal/acceptable-use) applies transitively.
- **Verdict:** `byok_only` by default — not for legal reasons (silence is permissive) but for sender-domain mechanics: in master-pool the `from:` address is ToolRoute's verified domain, breaking transactional email semantics for the customer's own brand. Master-pool only viable for ToolRoute's own internal email (welcome emails, alerts, invoices) — not customer transactional flows.
- **Notes:** ToolRoute's own welcome email at signup uses Resend in master-pool mode — that is fine because the relationship is `ToolRoute → ToolRoute customer`, not `ToolRoute → customer's customer`.

### Firecrawl
- **Source:** https://www.firecrawl.dev/terms-of-service (effective 2024-11-05)
- **Date checked:** 2026-04-27
- **Restrictive clauses:**
  - "Modify, rent, lease, loan, sell, distribute, or create derivative works based on the Services" — prohibited.
  - "Use the Services for any commercial purposes except as expressly authorized by Firecrawl" — commercial use itself requires authorization.
- **Interpretation:** Paid-tier subscription is presumed to be the "express authorization" for normal commercial use. **Resale-as-a-service** (master-pool) is materially different from normal commercial use and is NOT covered by paid-tier authorization absent specific enterprise approval.
- **Verdict:** `ambiguous_ask_legal` — leaning `byok_only` for safety. Justin should confirm with help@firecrawl.com whether master-pool routing is acceptable on their Hobby/Standard/Growth tiers, or whether enterprise contract is required.
- **Notes:** Compliance with target-site terms is the customer's responsibility (transitive — ToolRoute customers must comply with their scrape targets' ToS).

### Tavily
- **Source:** https://tavily.com/terms (effective 2026-01-13)
- **Date checked:** 2026-04-27
- **Resale clause:** "Customer will not...license, sublicense, resell, distribute, lease, rent, lend, transfer, assign or otherwise dispose of the Services" — explicit resale prohibition.
- **Carve-out:** "integration of the Services in Customer Applications in accordance with this Agreement will not constitute a violation."
- **Use scope:** "solely for Customer's internal business purposes and in accordance with the Services' documentation."
- **Verdict:** `ambiguous_ask_legal`. ToolRoute master-pool sits in the gray area: customers integrate Tavily INTO their AI-agent applications via ToolRoute (looks like permitted "integration"), but ToolRoute is also the billed-revenue layer in front (looks like prohibited "resale"). The "solely for internal business purposes" framing argues against ToolRoute's master-pool interpretation.
- **Implication:** Default to BYOK for Tavily at launch. Master-pool requires Justin to confirm with Tavily that "ToolRoute is a tool customers use to integrate Tavily into their applications" reading is acceptable, or to obtain enterprise-tier resale rights.

### ElevenLabs
- **Source:** https://elevenlabs.io/terms-of-use (non-EEA, effective 2026-03-31)
- **Date checked:** 2026-04-27
- **Tier-based commercial use:**
  - Free users: "non-commercial purposes" only.
  - Paid users: "commercial purposes" permitted, subject to Prohibited Use Policy.
- **Resale/sublicensing:** Default license is "non-transferable, non-sublicensable." Resale/bundling falls under separate **OEM Terms** ("bundling, making available and sublicensing of certain Services") — a distinct agreement, not standard paid-tier.
- **Verdict:** `byok_only` on standard paid tier. Master-pool requires OEM Terms / enterprise contract.
- **Voice cloning notes:** Cloned voice models grant ElevenLabs a "perpetual and irrevocable" license. End-customer consent flow not detailed in main ToS — likely in Service-Specific Terms.
- **Implication:** Justin needs an OEM agreement with ElevenLabs to master-pool. Without it, ElevenLabs is BYOK in ToolRoute.

### Deepgram
- **Source:** https://deepgram.com/terms (Site ToS, marketing-site only) / API-specific MSA is a separate document surfaced at console.deepgram.com signup
- **Date checked:** 2026-04-27 — **public ToS page covers website only; API/commercial terms not publicly indexable.**
- **Resale clause (Site ToS §5.1):** "The Site and its contents are solely for your own personal non-commercial use." (Applies to deepgram.com browsing — NOT to API usage. API has separate commercial terms.)
- **Verdict:** `ambiguous_ask_legal` — **Justin: pull the API MSA / commercial terms from console.deepgram.com after sign-in (they're presented at first API key creation).** Until then, treat as `ambiguous` and BYOK for safety.
- **Notes:** Deepgram is unusual among AI infra vendors for not publishing their commercial API terms publicly. This is a yellow flag for ToolRoute's master-pool resale claim — opaque terms = higher risk of Anthropic-style "no resell except as approved" boilerplate hiding inside.

### Replicate
- **Source:** https://replicate.com/terms (effective 2026-04-01)
- **Date checked:** 2026-04-27
- **Resale clause (Section 2.7(c)(iii)):** Customer may not "rent, lease, lend, sell, sublicense, assign, distribute, publish, transfer, or otherwise make available any Services to any person, including **on or in connection with the internet or any time-sharing, service bureau, software as a service, cloud, or other technology or service**"
- **Sublicense (Section 2.1):** Use rights are "non-transferable" and "non-sublicensable."
- **Per-model terms (Section 2.5):** Customer must comply with "Third-Party Terms applicable to your use of the Services, including all Additional Terms and licenses associated with the Models."
- **Verdict:** **`forbidden`** for master-pool. Master-pool = "service bureau" / "SaaS" / "cloud service" pattern explicitly enumerated in 2.7(c)(iii). ToolRoute as a paid passthrough router for Replicate access is a direct breach.
- **BYOK pattern:** Customer holds the Replicate account; ToolRoute is the customer's own client tool. ToolRoute must surface per-model Additional Terms (Flux example: customers must inform their end users of Flux ToS acceptance).
- **Implication:** Replicate is BYOK-only at launch. Master-pool is not negotiable like Anthropic might be — the clause language is structural ("service bureau, software as a service") not "except as approved."

## Cross-cutting concerns

1. **Branding** — most providers require attribution ("Powered by X") for resale. Master-pool means ToolRoute must surface this.
2. **AUP enforcement** — ToolRoute's ToS must propagate each provider's AUP to its customers. Otherwise ToolRoute is on the hook for downstream misuse.
3. **Rate limits per ToolRoute pool** — even if master-pool is legally OK, one rogue customer can exhaust ToolRoute's per-account rate limit and break service for all customers.
4. **Per-model license** (Replicate especially) — separate from provider ToS. Agent-resale of non-commercial-licensed model output is a violation regardless of Replicate's own terms.
5. **Model-output training** — OpenAI / Anthropic both ban using output to train competing models. ToolRoute is fine; ToolRoute's customers may not be. Disclose in ToolRoute ToS.
6. **Code/legal mismatch — adapter env matrix exposes structural over-reach.** Lane 5.1 (PR #12) shipped `.agent/adapter-env-matrix.md` enumerating every adapter's `process.env.*` references. Cross-referencing against this audit, the following adapters declare pooled (master-pool-shaped) env vars while their ToS classification is `byok_only` or `forbidden`:

    | Adapter | Required pooled env var | Lane 6 verdict | Action |
    |---|---|---|---|
    | claude (Anthropic) | `ANTHROPIC_API_KEY` | byok_only (D.4 forbids resale) | Either (a) confirm `ANTHROPIC_API_KEY` is used only for ToolRoute's *own* internal calls (classification, system prompts) and never to forward customer requests — and gate that in code; OR (b) remove the env var path and force BYOK at adapter level. |
    | replicate | `REPLICATE_API_TOKEN` | **forbidden** (§2.7(c)(iii)) | Remove pooled-key path. Replicate adapter must require BYOK token at execute-time. Structural breach if pooled key is used to forward customer calls. |
    | elevenlabs | `ELEVENLABS_API_KEY` | byok_only (standard tier) | Same as Anthropic — confirm internal-only use or remove pooled path. |
    | resend | `RESEND_API_KEY` | byok_only (sender-domain mechanic) | ToolRoute's own welcome email is fine. Customer-facing transactional email *must* use customer's own Resend domain — not ToolRoute's. Verify adapter routes accordingly. |

    Adapters classified `ambiguous_ask_legal` (OpenAI, Firecrawl, Tavily, Deepgram) all have pooled env vars too — not breaches, but exposed surface area until Justin's outreach (`.agent/lane-6-outreach-drafts.md`) returns written confirmations.

    **Why this matters at this layer, not just legal:** pooled env vars present + no runtime BYOK gate = a customer hitting `/api/v1/execute?tool=replicate.flux-schnell` today gets served from ToolRoute's master Replicate account. That is the breach. Removing the env var (or wrapping every byok_only adapter in a `requireByok()` guard) is the only hard fix. Marketing copy is downstream of this.

    **Verified empirically 2026-04-27 (loop iteration 2):**
    - All 4 byok_only adapters share the identical fallback pattern at line ~5-8 of each file:
      ```ts
      function getApiKey(byokKey?: string): string | null {
        return byokKey || process.env.ANTHROPIC_API_KEY || null;  // (or REPLICATE_API_TOKEN / ELEVENLABS_API_KEY / RESEND_API_KEY)
      }
      ```
      This is `byok-supported`, not `byok-required`.
    - `src/lib/gateway.ts::executeToolRequest` (lines 239–293) resolves keys in priority order **BYOK → master (`tool_providers` table) → env_var fallback (adapter `process.env.X`)** and passes the resolved key (or `undefined`) to `adapter.execute(operation, input, resolvedKey)`. There is **zero gate** between key-resolution and adapter dispatch — the function does not know nor care that some providers' ToS forbid the master/env_var paths.
    - `src/app/api/v1/execute/route.ts` calls `validateRequest` + `checkRateLimit` + `executeToolRequest` and does no BYOK enforcement of its own.
    - **Net result:** as of 2026-04-27 master, a customer with a ToolRoute API key but no row in `user_provider_keys` calling `claude.messages.create` (or `replicate.run` / `elevenlabs.tts` / `resend.send`) is served from ToolRoute's master pooled key. Verdict cross-cutting #6 graduates from speculative to **verified structural breach**.

    **Smallest fix (proposed Lane 6.2):**
    1. Add `BYOK_ONLY_ADAPTERS = new Set(["claude", "replicate", "elevenlabs", "resend"])` to `src/lib/adapter-availability.ts`.
    2. In `executeToolRequest`, after the BYOK lookup but before the master lookup, insert: `if (!byokRow && BYOK_ONLY_ADAPTERS.has(adapter.slug)) throw new GatewayError("This provider requires BYOK. Add your key at /dashboard/byok", 402, "byok_required")`.
    3. Test asserting a fresh user with no BYOK row gets a 402 with code `byok_required` for each of the 4 providers.

    Holding the code change out of this docs PR. Lane 6.2 implementation needs Justin's explicit OK given the change is in the gateway critical path and the auditor self-merge question is still open.

## Recommendation framework (preliminary)

| Provider | Verdict | Confidence | Source |
|---|---|---|---|
| OpenAI | `ambiguous_ask_legal` — historical "no resell or lease access" but unclear if ToolRoute customers count as "End Users" | **low** — WebFetch 403'd 4x, archive.org blocked, Justin manual verify required | https://openai.com/policies/services-agreement/ unfetchable |
| Anthropic | **BYOK only** unless written enterprise approval | **high** | clause D.4, verified 2026-04-27 |
| Resend | BYOK only (sender-domain mechanics) — ToolRoute's own welcome email OK | high | ToS silent; mechanic-driven |
| Firecrawl | `ambiguous_ask_legal` — paid tiers permit commercial use, but resale-as-a-service may need enterprise approval | medium | clause verified 2026-04-27 |
| Tavily | `ambiguous_ask_legal` — resale forbidden, "integration" carve-out gray-area for ToolRoute's pattern | medium | clause verified 2026-04-27 |
| ElevenLabs | OEM Terms required for master-pool; standard paid tier = `byok_only` | high | clause verified 2026-04-27 |
| Deepgram | `ambiguous_ask_legal` — public Site ToS doesn't cover API; commercial terms only at console signup | low | site ToS §5.1 (irrelevant); API MSA needs Justin manual fetch |
| Replicate | **BYOK ONLY — master-pool is a structural breach** | **high** | clause 2.7(c)(iii), verified 2026-04-27 |

**Implication for Lane 0.3 — UPDATED:** Two of eight providers explicitly BLOCK master-pool resale at the ToS layer:

1. **Anthropic** — clause D.4 says "resell except as expressly approved by Anthropic." Negotiable through enterprise.
2. **Replicate** — clause 2.7(c)(iii) enumerates "service bureau, software as a service, cloud, or other technology or service" as prohibited reuse patterns. NOT negotiable in standard terms; explicit carve-out language is structural to Replicate's per-model licensing model. ToolRoute reselling Replicate = direct breach.

Combined with Resend's mechanical incompatibility, the **hybrid** model is not just preferable — it is **required**. Master-pool is contractually open only for: OpenAI (pending verify), Firecrawl, Tavily, Deepgram, ElevenLabs (only on enterprise tier).

**Concrete launch posture:**
- **Master-pool candidates (NEEDS MANUAL VERIFY)**: OpenAI, Firecrawl, Tavily, Deepgram are all `ambiguous_ask_legal` — none have a clean greenlight. **Zero providers in the audit have unambiguous master-pool ToS authorization yet.**
- **BYOK only — confirmed contractually forced**: Anthropic, Replicate, Resend, ElevenLabs.
- **Pricing page** should NOT advertise "one credit balance for all tools" — the credit balance applies to master-pool tools only. BYOK tools route to customer's provider with no credit deduction (or minimal routing fee per ToolRoute's pricing model).
- **Marketing copy** must avoid implying ToolRoute resells Anthropic/Replicate access. "Use your Anthropic key through ToolRoute" is the safe framing.
- **CRITICAL FINDING**: After 6 of 8 ToS verified, **the launch master-pool surface may be empty** unless OpenAI / Firecrawl / Tavily / Deepgram come back with clear authorizations. Justin must email each of those providers (help@firecrawl.com, sales@tavily.com, sales@deepgram.com, OpenAI enterprise) before claiming "credits work for X" on the pricing page.

## Sibling lanes (continued audit)

- **Lane 6.8** — `.agent/lane-6.8-master-pool-tos-audit.md` — re-classified Tavily + Replicate as **STRUCTURAL BAN** after deeper read. Audited 5 funded master-pool providers.
- **Lane 6.9** — `.agent/lane-6.9-video-sms-tos-audit.md` — **4 NEW STRUCTURAL BANS confirmed:** Mux, Twilio, HeyGen, Shotstack. All have explicit "no resale", "non-sublicensable", "service bureau forbidden", or "no API white-label" clauses. Creatify flagged `ambiguous_unverified` (JS-rendered SPA, manual browser fetch needed).
- **Lane 6.11** — `.agent/lane-6.11-search-translation-tos-audit.md` — **1 NEW STRUCTURAL BAN confirmed: DeepL** (§8.1.4 verbatim "Customer is not entitled to repackage or resell access credentials..."). 3 ambiguous (Outscraper, Creatomate, DataForSEO — silent or behind signup gate). 1 PDF-unverifiable (Exa — binary PDF, manual fetch needed). *Note: Lane 6.10 number is taken by an unrelated tier-copy drift task #74; numbered 6.11 to avoid collision.*
- **Lane 6.12** — `.agent/lane-6.12-productivity-crm-tos-audit.md` — **4 NEW STRUCTURAL BANS confirmed:** Apollo (§3(g)(1) "may not access the APIs via a third party's API credentials or integrate the Apollo APIs with your own product or service"), Linear (§2.2(c) commercial-exploitation ban), SendGrid (Twilio-inherited via Feb 2026 merger consolidation — `api.sendgrid.com/tos.html` 301→`twilio.com/legal/tos`), Sentry (§2.3(a)+(b)+(c) sublicense + service-bureau + competing-services bans). Shippo flagged `ambiguous_unverified` (JS-rendered SPA, manual browser fetch needed).
- **Lane 6.13** — `.agent/lane-6.13-saas-productivity-tos-audit.md` — **4 NEW STRUCTURAL BANS confirmed:** LinkedIn (§3.1(8) "you may not sell access to an aggregated collection of Member profiles" + §2.4 + §3.1(21)), HubSpot (§4.A non-sublicensable + §8.E "no right to distribute or resell HubSpot Products or Services" + charge-for-functionality ban), Slack ("you may not sell, rent, lease, sublicense, redistribute, or syndicate access to any of our APIs"), GitHub (§H conditional — resale only via enterprise subscription tier). Notion flagged `pdf_unverified` (MSA is Cloudfront PDF binary).

**Cumulative master-pool-incompatible list (Lanes 6 + 6.8 + 6.9 + 6.11 + 6.12 + 6.13 — 27 providers attempted):**
1. Anthropic — `forbidden` (D.4, negotiable via enterprise)
2. Replicate — `forbidden` STRUCTURAL (2.7(c)(iii), service-bureau enumerated)
3. Tavily — `forbidden` STRUCTURAL (re-classified 6.8)
4. Mux — `forbidden` (§3.2 + non-sublicensable license)
5. Twilio — `forbidden` (§2.2(b))
6. HeyGen — `forbidden` (anti-API-white-label clause + service bureau)
7. Shotstack — `forbidden` (§4.4 "in any manner whatsoever")
8. DeepL — `forbidden` (§8.1.4 + §7.1 + §8.1.1.f + §8.1.9)
9. Apollo — `forbidden` (§3(g)(1) + §3(g)(3)(ii) + §3(d))
10. Linear — `forbidden` (§2.2(c) + §2.2(g))
11. SendGrid — `forbidden` (Twilio-inherited via 301 redirect)
12. Sentry — `forbidden` (§2.3(a)+(b)+(c))
13. LinkedIn — `forbidden` (§2.2 + §2.4 + §3.1(8) + §3.1(21) + §3.2(2))
14. HubSpot — `forbidden` (§4.A + §8.E)
15. Slack — `forbidden` (Applications + Commercial Distribution clauses)
16. GitHub — `forbidden` conditional (§H — enterprise resale subscription required)

**Pattern (after 27 providers attempted):** **zero providers have unambiguous master-pool ToS authorization**. Every commercial-output provider audited so far has explicit no-resale clauses. Master-pool fallback for these is a contractual breach the moment a non-Justin user calls them. Default-to-BYOK posture is forced, not optional. Launch master-pool surface is empty unless Justin negotiates enterprise resale rights individually.

## Next steps

1. ✅ WebFetch each ToS URL and pull the actual resale/sublicense clause. (Lanes 6, 6.8, 6.9, 6.11, 6.12, 6.13 — 24/27 verified; Creatify SPA + Exa PDF + Shippo SPA + Notion PDF pending manual; Outscraper Global Services Agreement pending.)
2. Codex ticket: extend BYOK-required Set in `src/lib/byok-slugs.ts` to add 16 forbidden slugs (mux, twilio, heygen, shotstack, deepl, apollo, linear, sendgrid, sentry, linkedin, hubspot, slack, github + already-known anthropic/replicate/tavily) plus default-to-BYOK ambiguous: outscraper, creatomate, dataforseo, exa, creatify, shippo, notion (Lane 6.5-impl picks this up).
3. Surface `forbidden` results to Justin for adapter-removal vs BYOK-only-gating decision (Lane 0.3).
4. Lane 6.14 candidate (final): stripe, supabase — infrastructure providers with qualitatively different resale terms (Stripe Connect platform, Supabase being our own DB).
