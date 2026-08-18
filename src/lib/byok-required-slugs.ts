/**
 * Lane 6.8.1 — BYOK slug data module
 *
 * Source of truth: .agent/lane-6.7-verified-byok-slug-list.md (lines 41-134)
 * Audit basis:    .agent/lane-6.6-byok-audit-pass-2.md (per-provider ToS quotes)
 * Pool risk doc:  .agent/lane-6.8-master-pool-tos-audit.md
 *
 * Three tiers — gate behavior differs per Justin decisions D9-D12 in Lane 6.7:
 *
 *   1. BYOK_REQUIRED_SLUGS         — master-pool routing = direct ToS breach.
 *                                    Behavior: 402 byok_required.
 *
 *   2. BYOK_INSUFFICIENT_SLUGS     — even BYOK passthrough may not satisfy ToS
 *                                    (e.g. apollo §3(g)(1) "integrate...with your
 *                                    own product or service"). Behavior:
 *                                    403 forbidden_resale.
 *
 *   3. AMBIGUOUS_DEFAULT_BYOK_SLUGS — silent/no-ToS or End User carve-out.
 *                                     Default 402 byok_required; flip to
 *                                     master-pool only after written authorization
 *                                     from provider.
 *
 *   4. TOOLROUTE_INTERNAL_SLUGS    — internal aggregators (auto + toolroute);
 *                                    not third-party — passthrough only.
 *
 * Wired by Codex Lane 6.5-impl ticket #23.
 * Drift prevention: tests/unit/byok-slug-list-parity.test.ts asserts these Sets
 * match the Lane 6.7 markdown source-of-truth.
 */

export const BYOK_REQUIRED_SLUGS: ReadonlySet<string> = new Set([
  // Lane 6.1 (PR #19) — original 4
  "claude",       // Anthropic Usage Policy §3 — no resale
  "replicate",    // Replicate AUP §2.7(c)(iii) — "service bureau"
  "elevenlabs",   // ElevenLabs OEM Terms required for resale
  "resend",       // Resend §6 — sender-domain mechanic forbids pooling

  // Lane 6.6 t1 — payments + voice + critical infra
  "stripe",       // Stripe SSA §1.2(a)(viii) — "service bureau or pass-through agent"
  "supabase",     // Supabase ToS §2(c)(ii) — "make available...to any third party"
  "vapi",         // Vapi §2(a) — "host or otherwise commercially exploit"

  // Lane 6.6 t2 — auth-gated business APIs
  "sentry",       // Sentry §2.3(a-b) — "on behalf of...any third party"
  "slack",        // Slack — "sell, rent, lease, sublicense, redistribute, syndicate"
  "drive",        // Google APIs §2.2.b + protocol-level OAuth-per-customer
  "calendar",     // Google APIs §2.2.b + protocol-level OAuth-per-customer
  "sheets",       // Google APIs §2.2.b + protocol-level OAuth-per-customer

  // Lane 6.6 t3 — social / CRM
  "linkedin",     // LinkedIn §3.1(8) + anti-pooling §3.1(20)
  "twitter",      // Twitter §III.A(e) — explicit "service bureau"
  "hubspot",      // HubSpot AUP §5.5(vii) — "timesharing or service bureau"

  // Lane 6.6 t4 — translation + media + comms
  "translate",    // DeepL §8.1.4 + §5.2 (adapter slug = translate; provider is DeepL)
  "mux",          // Mux §3.2(2) — anti-resale + non-sublicensable
  "sendgrid",     // SendGrid (Twilio MSA) — "transfer, resell, lease, license"

  // Lane 6.6 t5 — stock media + protocol-level
  "unsplash",     // Unsplash §2 — credentials bound to "your Developer Apps"
  "youtube",      // YouTube §10.1 non-sublicensable + §3.1 OAuth-per-customer

  // Lane 6.6 t6
  "linear",       // Linear — single-sentence Tier 1+2+4 stack

  // Lane 6.6 t7 — slug-name-hides-provider reclassifications
  "image",        // Fal.ai — timesharing/service-bureau + API-exposure ban (adapter slug = image; provider is Fal.ai)
  "search",       // Brave Search API — Tier 2+3 stack (slug misleads)

  // Lane 6.6 t9-t11 — AI/ML inference
  "shotstack",    // Shotstack Tier 2+3 + multi-account anti-pooling clause
  "heygen",       // HeyGen §2 anti-API-interface (Tier 6)
  "higgsfield",   // Higgsfield §1.2 + §5.2(i) + §5.1(iii) three-tier stack
  "postiz",       // Postiz §7 — "resell, sublicense, white-label"
  "context7",     // Context7 (Upstash) §2.2 + credential-sharing ban

  // Lane 6.6 t12
  "notion",       // Notion MSA — "service bureau" by name + ties to "API"
  "exa",          // Exa — double non-sublicensable + declared audit-rights
]);

/**
 * Adapter may need REMOVAL or written waiver — BYOK alone insufficient.
 */
export const BYOK_INSUFFICIENT_SLUGS: ReadonlySet<string> = new Set([
  "apollo",       // Apollo §3(g)(1) — "integrate...with your own product or
                  // service" bans even non-resale integration. Pending Justin
                  // decision D4: remove adapter, pursue waiver, or get legal
                  // opinion on whether transparent BYOK passthrough qualifies.
]);

/**
 * Silent ToS / End User carve-out / no-public-ToS — default conservative.
 */
export const AMBIGUOUS_DEFAULT_BYOK_SLUGS: ReadonlySet<string> = new Set([
  // Lane 6.1 (PR #19)
  "openai",       // GPT/Whisper inference
  "firecrawl",    // confirmed permissive — pending opt-in hardening
  "tavily",       // confirmed permissive — pending opt-in hardening
  "deepgram",     // ambiguous

  // Lane 6.6
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
  "playwright",   // Thum.io — NO PUBLIC TOS FOUND. Slug misleads.
  "dataforseo",   // §7.1 anti-search-engine-competition only
  "shippo",       // 4×404 unfetchable + Software Providers partner program

  // Lane 6.9 — new adapter, no ToS resale audit yet
  "novita",       // AI/ML inference, silent ToS — same default posture as openai
]);

/**
 * Internal aggregators (not third-party) — passthrough only.
 * Confirmed by source-grep on src/lib/adapters/*-adapter.ts:
 *   - auto-adapter.ts: lazy-import dispatch only
 *   - toolroute-adapter.ts: internal Supabase routing only
 */
export const TOOLROUTE_INTERNAL_SLUGS: ReadonlySet<string> = new Set([
  "auto",
  "toolroute",
]);

/**
 * Convenience: any slug in any of the gated tiers.
 * Used by gateway runtime to decide whether to skip lookup entirely.
 */
export function isByokGatedSlug(slug: string): boolean {
  return (
    BYOK_REQUIRED_SLUGS.has(slug) ||
    BYOK_INSUFFICIENT_SLUGS.has(slug) ||
    AMBIGUOUS_DEFAULT_BYOK_SLUGS.has(slug)
  );
}

/**
 * Convenience: tier classifier for the runtime gate.
 * Returns null for internal slugs (auto/toolroute) and untracked slugs.
 */
export type ByokTier = "required" | "insufficient" | "ambiguous" | "internal";

export function classifyByokTier(slug: string): ByokTier | null {
  if (BYOK_REQUIRED_SLUGS.has(slug)) return "required";
  if (BYOK_INSUFFICIENT_SLUGS.has(slug)) return "insufficient";
  if (AMBIGUOUS_DEFAULT_BYOK_SLUGS.has(slug)) return "ambiguous";
  if (TOOLROUTE_INTERNAL_SLUGS.has(slug)) return "internal";
  return null;
}
