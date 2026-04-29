# Lane 4.111 — Homepage + positioning-v2.md Class-A drift, pricing page Class-A subset (MEDIUM / Hard Rule #57)

**Owner:** Claude (auditor)
**Started:** 2026-04-29
**Severity:** MEDIUM (sweeping copy on hero surfaces; pricing page's Class-A list is a SUBSET, not the full Class-A class)
**Action:** Codex ticket — patch 3 surfaces in one PR. Sibling to Lanes 4.103/4.109/4.110.

## TL;DR

Depth-audit follow-up to Lane 4.110. Lane 4.110 covered the AES-256 deception class. This lane covers the **Class-A BYOK-required disclosure drift** on the highest-traffic public surfaces (homepage, positioning-v2 source doc) and a **subset-not-full-set** issue on `/pricing`.

Three findings:

1. **Homepage hero contradicts pricing page disclosure.** `src/app/page.tsx:53` says "No more managing dozens of API keys, accounts, and integrations." Meanwhile `src/app/pricing/page.tsx:100` correctly says "Anthropic, Replicate, ElevenLabs, Resend require BYOK — their terms-of-service forbid resale." A buyer reads hero → believes one key works → reads pricing → discovers BYOK required → bounces or files complaint.
2. **`src/content/positioning-v2.md` predates the Class-A discovery.** 432-line positioning doc lists OpenAI, Anthropic, Stripe, GitHub adapters as if pool-routable, frames BYOK as "optional optimization to bypass markup," and states "We pass through provider cost + 10% gateway fee" — implying pool routing on the full set.
3. **`src/app/pricing/page.tsx:100,269` Class-A list is a SUBSET.** Discloses Anthropic, Replicate, ElevenLabs, Resend as BYOK-required. **Missing**: OpenAI (Lane 4.100), Stripe (Lane 6.14), GitHub (Lane 4.104), Supabase (Lane 6.14). Subset-not-full-set is its own deception class — it primes buyers to think the list is exhaustive.

## File:line evidence

### Finding 1 — Homepage hero Class-A drift

`src/app/page.tsx:46-54`:
```tsx
<h1>One API key. Every tool.</h1>
<p>
  ToolRoute is the OpenRouter for tools. One unified API to access 70+
  best-in-class tools for AI agents. No more managing dozens of API keys,
  accounts, and integrations.
</p>
```

`src/app/page.tsx:583` (footer): "One API key. Every tool." (repeats hero).

`src/app/page.tsx:95` (terminal example): the curl example uses `elevenlabs/text-to-speech` with **only** the `tr_live_xxx` bearer — no BYOK header. ElevenLabs is on the pricing page's BYOK-required list (line 269). The example is the literal opposite of the disclosure.

`src/app/page.tsx:139`: "One API call. We handle auth, routing, billing, and fallbacks." Accurate for non-Class-A but misleading for Class-A.

`src/app/page.tsx:316`: "All tools access" (Pro tier list-item). Correct in catalog sense, but a buyer expects routability across "all tools."

### Finding 2 — positioning-v2.md (432 lines, source doc for marketing collateral)

`src/content/positioning-v2.md:36`:
```
1. **87 tools, 152 operations, 5 protocols.** REST, MCP Streamable HTTP, A2A, OpenAI Functions, SDKs. One auth, one bill, one spec.
```

`src/content/positioning-v2.md:68`:
```
**One auth, 87 tools.** You present one bearer token. We handle Stripe,
OpenAI, Anthropic, Firecrawl, Resend, ElevenLabs, Apollo, Composio,
Semgrep, Playwright — the full 87.
```
This is the cleanest single-line drift: enumerates Class-A providers (Stripe, OpenAI, Anthropic, ElevenLabs, Resend, Apollo per Lane 4.102 audit) inside a "We handle" master-pool framing.

`src/content/positioning-v2.md:70`:
```
**Transparent pricing.** Credit cost per call is published on `GET /api/v1/tools`
alongside the tool schema. ... we pass through provider cost + 10% gateway fee.
If a call costs us 4 credits, you pay 4 credits.
```
"Pass through provider cost" implies ToolRoute pays the provider; for Class-A this is ToS-forbidden resale.

`src/content/positioning-v2.md:153-154,189,201`:
```
- openai/chat, openai/embed, openai/image, openai/transcribe
- anthropic/messages
- stripe/charge, stripe/customer, stripe/subscription
- github/pr, github/issue, github/actions
```
Each Class-A adapter listed without a BYOK-REQUIRED marker.

`src/content/positioning-v2.md:227,231`: "openai/chat (gpt-4o, 1K tokens in/out): 15 credits", "stripe/charge: 2 credits" — credit pricing for Class-A as if pool-routable.

`src/content/positioning-v2.md:236,239-240`:
```
- Pro ($29/mo): 10K req/mo, 60 RPM, BYOK on 36 adapters, all tools
...
BYOK (bring-your-own-key) supported on 36 adapters to bypass gateway
markup when you already have provider contracts.
```
"BYOK on 36 adapters" frames BYOK as optional optimization. For Class-A it is REQUIRED, not optional. "When you already have provider contracts" implies pool-routing is the default and BYOK is the alternative — inverted reality for Class-A.

### Finding 3 — `/pricing` Class-A subset (correct content, incomplete enumeration)

`src/app/pricing/page.tsx:100`:
```
"... Premium providers (Anthropic, Replicate, ElevenLabs, Resend) require BYOK
— their terms-of-service forbid resale, so we route those calls through your
own provider account at zero markup."
```

`src/app/pricing/page.tsx:269`:
```
* Anthropic, Replicate, ElevenLabs, and Resend require Bring-Your-Own-Key
```

**Missing from this list (per audit chain):**
- **OpenAI** — Lane 4.100 P0 ACTIVE LEAK memo (master-pool key live in prod, ToS-forbidden)
- **Stripe** — Lane 6.14 (infra provider, ToS forbids resale)
- **GitHub** — Lane 4.104 (master-pool token leaks private repos through "public" search)
- **Supabase** — Lane 6.14 (infra provider, ToS forbids resale)

Plus likely additions from Lane 4.102's broken-by-design master-pool class expansion (vapi, twilio, sendgrid, others — needs verify).

The 4-name list is a **subset deception**: it suggests these are the only BYOK-required providers when at minimum 4 more must be there.

## Why severity is MEDIUM (not HIGH like 4.110)

- **No specific false security claim** (4.110 had AES-256-GCM with KMS — load-bearing technical claim with smoking gun)
- **Sweeping copy** is the primary issue, not specific provable lies
- **Pricing page already has the right pattern** (just needs the list expanded)
- **Public discovery surfaces are correct in some places** (pricing line 100 is honest)

But MEDIUM-not-LOW because:
- Homepage is the highest-traffic public surface
- Sweeping claims trigger FTC §5 by themselves (not just specific claims)
- Subset enumeration is a recurring deception pattern (FTC has flagged "and more" disclosures before)

## Codex ticket (concrete)

```
Title: Lane 4.111 — Class-A BYOK-required disclosure on homepage + positioning + expanded pricing list

Files to change:
- src/app/page.tsx
  - Line 52-54 hero copy: replace "No more managing dozens of API keys, accounts, and integrations"
    with "One unified API for ToolRoute-managed tools. Premium providers (OpenAI, Anthropic,
    Stripe, GitHub, Supabase, ElevenLabs, and others) require BYOK — register your own key once,
    we route at zero markup."
  - Line 95 example: swap elevenlabs/text-to-speech (BYOK-required) for a non-Class-A tool like
    firecrawl/scrape or jina/reader so the no-BYOK-header example is honest.
  - Line 583 footer slogan: keep "One API key. Every tool." (slogan-level) but add a line below
    that links to /pricing#byok with "* BYOK required for some providers — see pricing".

- src/app/pricing/page.tsx
  - Line 100: expand list from "(Anthropic, Replicate, ElevenLabs, Resend)" to the full Class-A
    set verified against Lanes 4.100/4.102/4.104/6.14.
  - Line 269 footnote: same expansion. Treat the canonical list as the imported Set from
    src/lib/byok-required-slugs.ts (created in Lane 6.8.1) — single source of truth.

- src/content/positioning-v2.md
  - Line 68 "We handle Stripe, OpenAI, Anthropic..." → reword to "We route ToolRoute-managed tools
    via the gateway. Premium providers (OpenAI, Anthropic, Stripe, GitHub, Supabase, ElevenLabs,
    and others) route through your BYOK key at zero markup."
  - Line 70 "pass through provider cost + 10% gateway fee" → clarify scope: applies to
    ToolRoute-managed pool only. BYOK calls are zero markup; ToolRoute charges only the
    BYOK monthly seat fee (or whatever the actual model is).
  - Line 153-154, 189, 201: append "(BYOK required)" to each Class-A adapter slug.
  - Line 227, 231: clarify credits pricing applies to non-BYOK pool calls only.
  - Line 236: change "BYOK on 36 adapters, all tools" to "BYOK supported on 36 adapters
    (REQUIRED for premium providers, OPTIONAL for the rest)".
  - Line 239-240: invert framing — BYOK is REQUIRED for premium providers and optional
    optimization for the rest.

Acceptance:
- /pricing line 100 list matches imported Set from src/lib/byok-required-slugs.ts (Lane 6.8.1)
- Homepage hero no longer contradicts /pricing disclosure
- positioning-v2.md does not list any Class-A adapter without "(BYOK required)" marker

Drift test (vitest, gated env):
- Walk src/app/**/*.{tsx,md} for slug references in /^(claude|openai|anthropic|stripe|github|
  supabase|elevenlabs|resend|replicate|...)\//
- Within 200 chars of each match, require either: "BYOK required", "premium providers", or
  the adapter is inside a code-block tagged with example=non-pool
- Fail on master if a future Class-A adapter is referenced without the marker
- Sibling to Lane 4.109's planned llms-full.txt drift test
```

## Sibling rules / lanes

- **Lane 4.100** — P0 ACTIVE LEAK (Anthropic + OpenAI master-pool keys in prod)
- **Lane 4.102** — broken-by-design master-pool class audit
- **Lane 4.103** — catalog-listing env-var-only gate has no Class-A awareness
- **Lane 4.104** — github master-pool token leaks private repos
- **Lane 4.106** — `tool_providers.auth_key_encrypted` plaintext
- **Lane 4.109** — llms-full.txt 3 drifts (sibling — agent discovery surface)
- **Lane 4.110** — 12 false AES-256 claims (sibling — same "premature claim" pattern)
- **Lane 6.14** — final master-pool ToS audit batch (Stripe + Supabase)
- **Lane 6.8.1** — extracted BYOK slug Sets to shared TS module (the single source of truth this lane references)
- **Hard Rule #57** — pre-launch copy audit before any tiered-access gate ships. **This finding is the post-launch version**: the gate exists in code (BYOK runtime check pending Codex #23), the copy lags reality.
- **Hard Rule #28** — depth audit after PROVEN finding. Lane 4.110 was PROVEN (smoking-gun TODO); the depth chain probes other public-claim surfaces. This memo is one such probe.

## Acceptance for this audit memo

- [x] Read homepage `src/app/page.tsx` lines 40-160 + 300-400 for Class-A claims
- [x] Read `src/content/positioning-v2.md` line ranges for adapter mentions and BYOK framing
- [x] Read `src/app/pricing/page.tsx` lines 90-110 + 260-275 for current disclosure
- [x] Cross-referenced Class-A adapters against Lanes 4.100/4.102/4.104/6.14 final audit
- [x] Confirmed pricing page has correct *pattern* but incomplete *list*
- [ ] **CODEX:** strip Class-A drift on homepage + expand pricing list + correct positioning-v2
- [ ] **CLAUDE follow-up:** once Codex ships Lane 4.111-impl, write Lane 4.113 verifying every line struck

## Process-improvement note

This is the 4th sequential audit memo (4.108 → 4.109 → 4.110 → 4.111) extending the same depth-audit chain: every public-readable surface that mentions adapter slugs or security posture gets probed for drift against the post-Lane-4.100 Class-A reality and post-Lane-4.106 plaintext reality.

The shared shape of these findings is now clear:
1. A Codex ticket sat PENDING (Lane 6.5-impl BYOK runtime gate, Lane 4.36-impl BYOK Vault)
2. Public claims were written assuming the ticket had shipped
3. The ticket didn't ship; the claims drifted from reality

**Audit pattern crystallized: Pending Codex ticket → grep every public-readable surface for claims that depend on it.** Add to CLAUDE auditor SOP. Sibling to Hard Rule #59 (failing-snapshot test as drift TODO list) — same idea applied to Codex tickets instead of code.

The right end-state: drift-prevention vitest that walks `.tsx`/`.md`/`public/*.txt`/`src/content/*.md` for any of:
- Class-A adapter slug without "BYOK required" within 200 chars
- AES-256 claim without "Codex ticket #52" within 200 chars
Failing-on-master means the queue is real; passing means we've ground it down.
