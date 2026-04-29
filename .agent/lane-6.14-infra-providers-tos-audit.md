# Lane 6.14 — Infrastructure providers master-pool ToS audit (Stripe + Supabase)

**Owner:** Claude (auditor)
**Started:** 2026-04-28
**Sibling:** Lane 6 → 6.8 → 6.9 → 6.11 → 6.12 → 6.13 → **6.14 (final, infrastructure providers)**

## TL;DR

Final audit batch in the master-pool resale class. **Both Stripe and Supabase confirmed STRUCTURAL BANS** via verbatim ToS clauses. Stripe has a Connect-platform carve-out (multi-merchant authorized via OAuth-per-account, not master-pool). Supabase has no carve-out.

**Master-pool resale-class audit class is now CLOSED.** 29 providers attempted, 18 verified `forbidden`, 10 ambiguous-default-to-BYOK, 2 byok-permitted. Zero clean greenlights.

| Adapter | ToS verdict | Source quote highlight |
|---|---|---|
| **Stripe** | `forbidden` (with Connect carve-out) | SSA §1.2(a)(viii) "act as service bureau or pass-through agent for the Services with no added value to Customers" + §2.5 "User must not rent, lease, lend, sell, share, redistribute, or sublicense the Stripe Technology, or enable others to do so" + §1.2(a)(v) rights-transfer ban |
| **Supabase** | `forbidden` | §2(c) "rent, lease, lend, sell, license, sublicense, assign, distribute, publish, transfer, or otherwise make available the Services or Documentation to any third party" |

## Detailed findings

### Stripe — `forbidden` with Connect carve-out (payments API)
- **Source:** https://stripe.com/legal/ssa (Stripe Services Agreement)
- **Date checked:** 2026-04-28
- **§1.2(a)(viii) service-bureau ban (verbatim):** "act as service bureau or pass-through agent for the Services with no added value to Customers" — **literally describes ToolRoute's master-pool stripe adapter pattern**.
- **§1.2(a)(v) rights-transfer ban:** "rent, lease, or otherwise transfer User's rights granted under Section 1.1 (Services) to a third party"
- **§2.5 redistribution ban (verbatim):** "User must not rent, lease, lend, sell, share, redistribute, or sublicense the Stripe Technology, or enable others to do so"
- **§3 account security:** "User must ensure that its Stripe Account is not used or modified by anyone other than User and its authorized representatives" — implicit prohibition on master-key sharing.
- **Connect carve-out:** Stripe Connect IS the Stripe-authorized multi-merchant pattern. Each downstream merchant authorizes via OAuth (Standard/Express) and ToolRoute uses `Stripe-Account` header with the authorized account_id. Connect requires application review + signed Connect Platform Agreement (separate ToS). Not what ToolRoute's adapter does.
- **Adapter location:** `src/lib/adapters/stripe-adapter.ts:5-7` — `STRIPE_PLATFORM_KEY` master pool with BYOK fallback.
- **Architectural note (separate from ToS):** the four operations exposed (list-customers, create-payment-link, list-products, get-balance) are NONSENSICAL via a single master key — they would return ToolRoute's OWN customers/products/balance to every caller, NOT downstream user data. The adapter is broken-by-design even if Stripe authorized the pattern. Proper Stripe integration requires Connect OAuth-per-account, where the BYOK key IS the user's Connect account secret key and operations target their own data.
- **Verdict:** `forbidden` — three verbatim clauses (§1.2(a)(v), §1.2(a)(viii), §2.5) all directly bar the master-pool pattern. Connect is the authorized alternative. Master pool must be removed; Connect integration is a separate Lane / sales cycle.

### Supabase — `forbidden` (database / management API)
- **Source:** https://supabase.com/terms (Terms of Service) + https://supabase.com/aup (Acceptable Use Policy)
- **Date checked:** 2026-04-28
- **§2(c) Use Restrictions (verbatim):** "rent, lease, lend, sell, license, sublicense, assign, distribute, publish, transfer, or otherwise make available the Services or Documentation to any third party"
- **§3(c) credential security:** "Customer is responsible for the security and use of Customer's and its Authorized Users' access credentials" with all access "with or without Customer's knowledge or consent" — implicit prohibition on credential sharing/master-pooling.
- **AUP:** does NOT contain explicit anti-resale/anti-aggregator clauses (per direct WebFetch). The §2(c) ToS clause is the operative restriction.
- **Adapter location:** `src/lib/adapters/supabase-adapter.ts:5-7` — `SUPABASE_MGMT_TOKEN` master pool with BYOK fallback. Operations: execute-sql, list-tables, insert, select.
- **Architectural note:** Same shape as Stripe adapter — the four operations would target ToolRoute's OWN Supabase project (used for the gateway DB itself!), not a downstream user's. `SUPABASE_MGMT_TOKEN` IS the owner-DDL credential for `isbratmfnnzipzyoefbo` (the gateway DB). Master-pool exposure of this would let any `tr_live_` holder run arbitrary SQL against the gateway's own DB — including dropping tables, exfiltrating user data, granting themselves credits, etc. **CRITICAL exposure if env var is set in prod.**
- **Verdict:** `forbidden` — §2(c) verbatim covers it AND the operational shape is catastrophically wrong (master key = gateway DB owner credential).

## Vercel prod env-var verification (Lane 4.100 pattern — env-check-before-severity)

Per memory rule #63 ("ToS-audit severity requires deployment env check"), checked Vercel prod env-var inventory 2026-04-28:

- **`STRIPE_PLATFORM_KEY`** — NOT SET in production. Latent gate-gap.
- **`SUPABASE_MGMT_TOKEN`** — NOT SET in production via Vercel; lives in `~/.claude/secrets/` for local Mgmt-API operations only.
- **However:** `STRIPE_SECRET_KEY` IS set (production target). This is ToolRoute's OWN platform billing key (used by `/api/v1/checkout`, `/api/v1/subscriptions`, `/api/webhooks/stripe`). The stripe ADAPTER's `STRIPE_PLATFORM_KEY` is a DIFFERENT env var name and different code path. So no cross-contamination — Justin would have to explicitly set `STRIPE_PLATFORM_KEY` to activate the latent leak.
- **`SUPABASE_SERVICE_ROLE_KEY`** IS set (production target). This is the gateway's OWN service-role key (used by all `supabaseAdmin()` server-side reads/writes). Different from the supabase ADAPTER's `SUPABASE_MGMT_TOKEN` which is owner-DDL. No cross-contamination.

**Severity:** LATENT for both. Active leak path requires Justin to deliberately set `STRIPE_PLATFORM_KEY` or `SUPABASE_MGMT_TOKEN` env vars in Vercel prod — neither is currently set.

**Important caveat:** The Lane 4.100 finding (Anthropic + OpenAI active leak) sits at higher priority because those env vars ARE set. Stripe + Supabase are latent — but the ADAPTERS' code paths must be removed independently of env-var status (the master-pool fingerprint is the audit failure, regardless of whether the env var is currently set).

## Cumulative state across Lanes 6 + 6.8 + 6.9 + 6.11 + 6.12 + 6.13 + 6.14

**29 providers attempted, master-pool resale audit class is now CLOSED.**

- **18 verified `forbidden`:** Anthropic, Replicate, Tavily, Mux, Twilio, HeyGen, Shotstack, DeepL, Apollo, Linear, SendGrid (via Twilio), Sentry, LinkedIn, HubSpot, Slack, GitHub, **Stripe (with Connect carve-out)**, **Supabase**
- **10 `ambiguous_unverified` (default-to-BYOK):** OpenAI, Firecrawl, Deepgram, Outscraper, Creatomate, DataForSEO, Creatify, Exa, Shippo, Notion
- **2 `byok_only` permitted:** Resend, ElevenLabs (standard tier)

**Pattern (29-of-29 providers):** every commercial-output provider with master-pool fingerprint (`byokKey || process.env.X || null`) audited has explicit no-resale clauses or no-clear-clean-greenlight. **Zero exceptions across the entire audit.**

## What this means for ToolRoute

**Strategic implication (carry-forward from Lanes 6.11 + 6.13):**

The master-pool surface available for launch is empty. ToolRoute must ship as either:

1. **BYOK-only at launch** for all 26 commercial-output adapters (16 forbidden + 10 ambiguous). Pricing model = subscription + routing fee, not credits-against-pooled-COGS.
2. **Connect/enterprise-resale negotiation** with Stripe (Connect agreement), GitHub (subscription-based-access), and any other authorized resale partners individually. Each is a sales cycle.
3. **Hybrid:** BYOK-only for the 28 audited resale-class providers; reserve master pool for non-commercial-output adapters (memory, registry tools, internal utilities, the `resend` permitted-BYOK provider for transactional emails).

This is the Lane 0.3 decision Justin owns. Recommendation re-confirmed: option 3.

**Lane 4.100 escalation reminder:** the runtime gate (Codex ticket #23 Lane 6.5-impl) is the load-bearing fix. Without the gate, even BYOK-only intent is undermined by master-pool fall-through. Until the gate ships:
- Justin must yank `ANTHROPIC_API_KEY` + `OPENAI_API_KEY` from Vercel prod (Lane 4.100 P0 blocker).
- The 16 latent-but-not-set master-pool env vars (replicate, tavily, mux, twilio, heygen, shotstack, deepl, apollo, linear, sendgrid, sentry, linkedin, hubspot, slack, github, notion, **stripe-platform**, **supabase-mgmt**) must NEVER be set in prod until the gate ships.

## Codex follow-up (extends Lane 4.100 ticket #23)

Extend BYOK-required Set in `src/lib/byok-slugs.ts` (still pending creation per Codex ticket #23) to the **final cumulative 28-slug list**:

**Forbidden (18):** anthropic (slug=`claude`), replicate, tavily, mux, twilio, heygen, shotstack, deepl, apollo, linear, sendgrid, sentry, linkedin, hubspot, slack, github, **stripe**, **supabase**

**Ambiguous default-to-BYOK (10):** openai, firecrawl, deepgram, outscraper, creatomate, dataforseo, creatify, exa, shippo, notion

Plus the Stripe-specific architectural note: even with BYOK gate, the four operations (list-customers, create-payment-link, list-products, get-balance) are operationally meaningless on a per-user passthrough — they target the API caller's OWN account, which means BYOK = "user provides their own Stripe secret key" and the adapter is functional only via Connect OAuth integration. Either rework as Connect adapter (deferred sales cycle) or remove `stripe` slug entirely from the catalog (cleaner short-term).

**Recommendation:** delete `src/lib/adapters/stripe-adapter.ts` + `supabase-adapter.ts` outright in a follow-up Codex ticket. Both are operationally broken master-pool patterns. If Justin wants Stripe Connect or Supabase-on-behalf-of-user later, they should be rebuilt from scratch as proper integrations, not retrofit onto the master-pool fingerprint.

## Out-of-scope follow-ups

- Master-pool resale audit class is **CLOSED** with this lane. No more provider ToS to audit in this class.
- Justin manual fetches (deferred from prior lanes): Outscraper Global Services Agreement, Exa PDF, Creatify SPA, Shippo SPA, Notion MSA PDF.
- Lane 0.3 decision (BYOK-only vs Connect-negotiation vs hybrid) — Justin owns.
- Codex ticket #23 final scope (28-slug BYOK gate) — promote to P0 per Lane 4.100.
- Adapter deletion follow-up (Stripe + Supabase) — separate Codex ticket.

## Acceptance

- [x] 2 adapters audited (both confirmed forbidden via verbatim ToS quotes)
- [x] Adapter file:line references verified (stripe-adapter.ts:5-7, supabase-adapter.ts:5-7)
- [x] Vercel prod env-var status verified per Lane 4.100 pattern (both LATENT — not set)
- [x] Stripe Connect carve-out documented (parallel to GitHub §H carve-out)
- [x] Supabase architectural note: `SUPABASE_MGMT_TOKEN` master-pool would expose gateway DB owner DDL — catastrophic if ever set
- [x] Cumulative state finalized: 29 providers attempted, 18 forbidden, 10 ambiguous, 2 byok-permitted
- [x] Master-pool resale audit class CLOSED with this lane
- [x] Codex ticket #23 final scope expanded to 28-slug BYOK gate
- [x] Sibling chain documented (Lane 6 → 6.8 → 6.9 → 6.11 → 6.12 → 6.13 → 6.14)
