# Lane 6.7 — Verified 49-slug BYOK list (extends Lane 6.5 patch)

**Status:** AUDIT-EXTENSION — code-ready Set replacing Lane 6.5's 4-slug placeholder.
**Owner:** Claude (Lane 6)
**Hard Rule cross-refs:** #13, #34, #57, #60
**Depends on:** Lane 6.5 (PR #23 — runtime patch shape) + Lane 6.6 (PR #27 — verified provider list)
**Feeds:** Codex's `[lane-6.5-impl]` ticket (PR #28, #23 in queue)

## Why this exists

Lane 6.5 (PR #23) proposed the **gate shape** with a placeholder 4-slug Set. Lane 6.6 (PR #27) **audited 51 adapters** and produced the verified list (30 forbidden + 1 stricter + 18 ambiguous = 49 of 51). This doc combines them so Codex's runtime patch ships with the right Set on first try, not on iteration N+1 after a follow-up audit.

Numbers:
- Lane 6.5 placeholder: **4 slugs**
- Lane 6.6 verified: **49 slugs** (96% of catalog)
- Gap if 6.5 ships unmodified: **45 adapters** silently allow ToS-breaching master-pool routing on first deploy.

## Code-ready Set (drop-in replacement for Lane 6.5 patch)

```ts
// src/lib/gateway.ts — at module top, near GatewayError:
//
// Verified by Lane 6.6 audit on 2026-04-28. Each slug carries the strongest
// ToS clause hit found in audit. See .agent/lane-6.6-byok-audit-pass-2.md
// for per-provider quotes and source links.
//
// Three tiers — gate behavior differs per Justin decisions D9-D12 below:
//
//   1. BYOK_REQUIRED_SLUGS    — master-pool routing = direct ToS breach.
//                               Behavior: 402 byok_required (Lane 6.5 patch).
//
//   2. BYOK_INSUFFICIENT_SLUGS — even BYOK passthrough may not satisfy ToS
//                               (apollo §3(g)(1) "integrate...with your own
//                               product or service"). Behavior: 403 with
//                               adapter-removal recommendation.
//
//   3. AMBIGUOUS_DEFAULT_BYOK  — silent/no-ToS or End User carve-out. Default
//                               402 byok_required; flip to master-pool only
//                               after written authorization from provider.

const BYOK_REQUIRED_SLUGS = new Set([
  // ───── Lane 6.1 (PR #19) — original 4 ─────
  "claude",       // Anthropic Usage Policy §3 — no resale
  "replicate",    // Replicate AUP §2.7(c)(iii) — "service bureau"
  "elevenlabs",   // ElevenLabs OEM Terms required for resale
  "resend",       // Resend §6 — sender-domain mechanic forbids pooling

  // ───── Lane 6.6 t1 — payments + voice + critical infra ─────
  "stripe",       // Stripe SSA §1.2(a)(viii) — "service bureau or pass-through agent"
  "supabase",     // Supabase ToS §2(c)(ii) — "make available...to any third party"
  "vapi",         // Vapi §2(a) — "host or otherwise commercially exploit"

  // ───── Lane 6.6 t2 — auth-gated business APIs ─────
  "sentry",       // Sentry §2.3(a-b) — "on behalf of...any third party"
  "slack",        // Slack — "sell, rent, lease, sublicense, redistribute, syndicate"
  "drive",        // Google APIs §2.2.b + protocol-level OAuth-per-customer
  "calendar",     // Google APIs §2.2.b + protocol-level OAuth-per-customer
  "sheets",       // Google APIs §2.2.b + protocol-level OAuth-per-customer

  // ───── Lane 6.6 t3 — social / CRM ─────
  "linkedin",     // LinkedIn §3.1(8) + anti-pooling §3.1(20)
  "twitter",      // Twitter §III.A(e) — explicit "service bureau"
  "hubspot",      // HubSpot AUP §5.5(vii) — "timesharing or service bureau"

  // ───── Lane 6.6 t4 — translation + media + comms ─────
  "deepl",        // DeepL §8.1.4 + §5.2 explicit anti-aggregator policy
  "mux",          // Mux §3.2(2) — anti-resale + non-sublicensable
  "sendgrid",     // SendGrid (Twilio MSA) — "transfer, resell, lease, license"

  // ───── Lane 6.6 t5 — stock media + protocol-level ─────
  "unsplash",     // Unsplash §2 — credentials bound to "your Developer Apps"
                  //   (BYOK may also require per-customer dev app — see D11)
  "youtube",      // YouTube §10.1 non-sublicensable + §3.1 OAuth-per-customer

  // ───── Lane 6.6 t6 ─────
  "linear",       // Linear — single-sentence Tier 1+2+4 stack

  // ───── Lane 6.6 t7 — slug-name-hides-provider reclassifications ─────
  "image-gen",    // Fal.ai — "timesharing, service bureau" + API-exposure ban
  "search",       // Brave Search API — Tier 2+3 stack
                  //   (slug actively misleads — does NOT match Microsoft Search)

  // ───── Lane 6.6 t9-t11 — AI/ML inference ─────
  "shotstack",    // Shotstack Tier 2+3 + multi-account anti-pooling clause
  "heygen",       // HeyGen §2 anti-API-interface (NEW finding class — Tier 6)
  "higgsfield",   // Higgsfield §1.2 + §5.2(i) + §5.1(iii) three-tier stack
  "postiz",       // Postiz §7 — "resell, sublicense, white-label"
  "context7",     // Context7 (Upstash) §2.2 + credential-sharing ban

  // ───── Lane 6.6 t12 ─────
  "notion",       // Notion MSA — "service bureau" by name + ties to "API"
  "exa",          // Exa — double non-sublicensable + declared audit-rights
]);

// Adapter may need REMOVAL or written waiver — BYOK alone insufficient.
const BYOK_INSUFFICIENT_SLUGS = new Set([
  "apollo",       // Apollo §3(g)(1) — "integrate...with your own product or
                  // service" bans even non-resale integration. Pending Justin
                  // decision D4: remove adapter, pursue waiver, or get legal
                  // opinion on whether transparent BYOK passthrough qualifies.
]);

// Silent ToS / End User carve-out / no-public-ToS — default conservative.
const AMBIGUOUS_DEFAULT_BYOK_SLUGS = new Set([
  // Lane 6.1 (PR #19):
  "openai",       // GPT/Whisper inference
  "firecrawl",    // confirmed permissive — pending opt-in hardening
  "tavily",       // confirmed permissive — pending opt-in hardening
  "deepgram",     // ambiguous

  // Lane 6.6:
  "twilio",       // §2.2(b) End User carve-out — multi-tenant fragile
  "github",       // likely needs GitHub Apps subscription for master-pool
  "creatify",     // silent ToS — confirm authorization tier
  "outscraper",   // silent ToS
  "textbelt",     // silent ToS — 10DLC carrier compliance overrides anyway
  "whisper",      // inherits openai verdict
  "pdf",          // Html2PDF — generic website ToS w/o API-specific clauses
  "screenshot",   // ScreenshotOne — Tier 2 isolated non-sublicensable
  "pexels",       // "competing service" clause concerns
  "removebg",     // §3 redistribute/sublicense + §6 "build competing products"
  "creatomate",   // silent ToS
  "playwright",   // Thum.io — NO PUBLIC TOS FOUND. NEW finding class — Tier 7.
                  //   Slug actively misleads (NOT Microsoft Playwright).
  "dataforseo",   // §7.1 anti-search-engine-competition only
  "shippo",       // 4×404 unfetchable + Software Providers partner program
                  //   exists (Tier 8 implicit signal — defensive byok_only)
]);

// Internal aggregators (not third-party) — passthrough only.
// Confirmed by source-grep on src/lib/adapters/*-adapter.ts:
//   - auto-adapter.ts: lazy-import dispatch only
//   - toolroute-adapter.ts: internal Supabase routing only
const TOOLROUTE_INTERNAL_SLUGS = new Set(["auto", "toolroute"]);
```

## Updated patch — extends Lane 6.5 with tier-aware gate

The Lane 6.5 patch checks one Set. With 3 tiers, the runtime check becomes:

```ts
// Inserted at gateway.ts:~238 (after credit check, before key resolution):

if (BYOK_INSUFFICIENT_SLUGS.has(adapter.slug)) {
  // apollo etc — adapter exists but ToS doesn't permit even BYOK passthrough.
  // Per Justin decision D4: this should ideally be removed. Until then, hard-block.
  throw new GatewayError(
    `Provider ${adapter.slug} cannot be routed through ToolRoute under any ` +
    `arrangement (provider terms forbid integration with third-party products). ` +
    `Contact support if you need direct access.`,
    403,
    "forbidden_resale"
  );
}

if (BYOK_REQUIRED_SLUGS.has(adapter.slug) ||
    AMBIGUOUS_DEFAULT_BYOK_SLUGS.has(adapter.slug)) {
  const sbCheck = supabaseAdmin();
  const { data: byokCheck } = await sbCheck
    .from("user_provider_keys")
    .select("id")
    .eq("user_id", ctx.userId)
    .eq("tool_slug", adapter.slug)
    .eq("is_active", true)
    .eq("prefer_own_key", true)
    .single();
  if (!byokCheck) {
    const reason = BYOK_REQUIRED_SLUGS.has(adapter.slug)
      ? "provider terms-of-service forbid resale"
      : "provider terms are ambiguous; ToolRoute requires BYOK pending written authorization";
    throw new GatewayError(
      `Provider ${adapter.slug} requires your own API key (${reason}). ` +
      `Register a key at /dashboard/byok before calling this tool.`,
      402,
      "byok_required"
    );
  }
}
```

## Test plan (extends Lane 6.5)

Lane 6.5 had 4 tests covering the original 4-slug Set. Lane 6.7 adds:

5. **Forbidden-with-caveat path:** free-tier user calling `apollo/search-people` (no BYOK) → expect **403** code `forbidden_resale` (NOT 402).
6. **Ambiguous-default path:** free-tier user calling `tavily/search` without BYOK → expect **402** code `byok_required` with reason="ambiguous". Confirms even confirmed-permissive providers default to BYOK pending written authorization.
7. **Slug-aware error reason:** free-tier user calling `notion/create-page` → assert error message contains "service bureau" or links to `/legal/byok-required-providers` so customers see *why*.
8. **Internal-passthrough path:** free-tier user calling `auto/route` → expect **200** (auto + toolroute not gated).
9. **Set-parity test:** vitest reads `BYOK_REQUIRED_SLUGS` Set + parses `.agent/lane-6.6-byok-audit-pass-2.md` "Confirmed structural ban" section + asserts the two are identical. Prevents drift when Lane 6.6 v3 audit adds providers.

## Decisions raised by Lane 6.6 (extend Lane 6.5 Q1-Q3)

### Q1-Q3 (carried from Lane 6.5)
- Q1. Default for BYOK-required without BYOK key → **A. 402** (recommended)
- Q2. Existing customers calling these slugs → **A. email + 7-day grace** (recommended)
- Q3. Master pool keys in Vercel env → **A. remove after gate ships** (recommended)

### Q4 (Lane 6.6 t1 — D2)
**Stripe + Supabase + HubSpot adapters: customer-facing or internal-only?** If ToolRoute uses these as internal infrastructure (which it does — Supabase is the primary DB; Stripe is the billing surface), the **customer-facing** adapter that lets gateway customers route their own Stripe/Supabase calls through ToolRoute's pooled account is what triggers the breach. Two paths:
- **A.** Remove these 3 adapters from the public gateway entirely (eliminates breach without needing BYOK gate).
- **B.** Keep adapters + enforce BYOK gate. Note: even with BYOK, ToolRoute's Stripe Connect / Supabase Multi-tenant migration is the cleaner long-term shape.

### Q5 (Lane 6.6 t2 — D5)
**Drive/Calendar/Sheets: confirm OAuth-per-customer is implemented.** Code review of `drive-adapter.ts`, `calendar-adapter.ts`, `sheets-adapter.ts` to verify these don't pool a single OAuth token across users. Likely already correct (Google's OAuth flow makes pooling structurally hard) but needs grep confirmation.

### Q6 (Lane 6.6 t2 — D6)
**Slack adapter: pursue Slack App Directory submission?** "Commercial Distribution" authorization is the only path that licenses ToolRoute to redistribute Slack capabilities. BYOK alone is the floor — App Directory listing is the proper shape.

### Q7 (Lane 6.6 t3 — D7)
**LinkedIn + Twitter adapters: viable for ToolRoute customers?** LinkedIn's §1.4(3) 100K-user cap and X's $100-5000/mo Enterprise tier mean most ToolRoute customers can't BYOK these economically. Consider:
- **A.** Remove both adapters; surface as "BYO LinkedIn/X account" in marketing.
- **B.** Keep adapters with the BYOK gate; let customers self-disqualify.

### Q8 (Lane 6.6 t3 — D8)
**HubSpot adapter: same as Q4.** ToolRoute likely doesn't use HubSpot internally → adapter is purely a gateway-product feature → §5.5(vii) breach is unambiguous. Remove or BYOK-gate.

### Q9 (Lane 6.6 t10 — NEW)
**HeyGen + Creatomate adapters: Tier 6 anti-API-interface clauses.** HeyGen §2 contains language **drafted specifically against API gateways** ("Frame, replicate, or develop an interface to access the Services...via an API"). Even BYOK passthrough may be argued as "an interface to access the Services." Two paths:
- **A.** Remove HeyGen adapter; require customers to call HeyGen directly.
- **B.** Verify with HeyGen legal whether transparent BYOK passthrough qualifies as "an interface" — written confirmation only.

### Q10 (Lane 6.6 t10 — NEW, Tier 7)
**Thum.io (slug `playwright`): NO PUBLIC TOS FOUND.** Three issues compound: (1) no enforceable contract, (2) vendor unilateral termination/modification rights, (3) slug name actively misleads customers re: Microsoft Playwright. Three paths:
- **A.** Remove `playwright` adapter entirely.
- **B.** Rename slug to `thumio` (Hard Rule #57 — pre-launch copy audit) AND require written API agreement before production routing.
- **C.** Replace with actual Microsoft Playwright (open-source MIT, structurally permissive) — different adapter shape entirely.

### Q11 (Lane 6.6 t5 — NEW)
**Unsplash BYOK structure:** §2 binds credentials to "your Developer Apps". Strict reading: each ToolRoute customer must register their own Unsplash dev app, not just bring an API key inside ToolRoute's app. Two paths:
- **A.** Document this in BYOK onboarding as a per-customer step.
- **B.** Email Unsplash to confirm whether ToolRoute can register one dev app per BYOK customer programmatically (likely no; this is what dev-app registration UIs are for).

### Q12 (Lane 6.6 t11 — NEW, Tier 8)
**Shippo + similar partner-program providers: pursue partner-tier enrollment?** Shippo's "Software Providers" tier likely permits aggregator routing under different commercial terms. Same pattern likely applies to:
- LinkedIn Marketing Developer Program
- X Enterprise tier
- Stripe Connect Platforms
- HubSpot App Partner Program
- Twilio ISV partners

Per-provider partner-tier evaluation is its own multi-week project and likely needs Justin's commercial bandwidth. Default for now: keep on AMBIGUOUS_DEFAULT_BYOK list.

## Rollout sequencing

This doc is **purely additive** to Lane 6.5. Implementation sequence:

1. **Justin reviews Q1-Q12** and answers (binary in most cases).
2. **Codex picks up `[lane-6.5-impl]` ticket** with Q1-Q3 + Q4-Q12 answers in hand.
3. **Codex implements gate** using the 3-Set structure from this doc, applying Justin's per-question answers.
4. **Codex ships behind a feature flag** (`BYOK_GATE_ENABLED=false` initially in production).
5. **Justin reviews on staging** with vitest tests passing.
6. **Email warning + 7-day grace** to existing master-pool callers (Q2.A path).
7. **Flip flag in production.**
8. **Vercel env cleanup** (Q3.A path) — remove `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, etc. from production env after 14-day stabilization.

## Cross-references

- Lane 6.1 (`.agent/lane-6-resale-audit.md`) — original 4-slug audit
- Lane 6.5 (`.agent/lane-6.5-byok-gate-gap-audit.md`, PR #23) — runtime patch shape
- Lane 6.6 (`.agent/lane-6.6-byok-audit-pass-2.md`, PR #27) — verified 49-slug list
- Hard Rule #57 — pre-launch copy audit before tiered gates
- Hard Rule #60 — provider-ToS resale-clause grep checklist
- `src/lib/gateway.ts:239-286` — current 3-step key-resolution chain
- `src/lib/adapters/*-adapter.ts` — env-var fallback pattern (51 files)
