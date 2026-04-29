---
name: Lane 4.115 — AMBIGUOUS_DEFAULT_BYOK_SLUGS catalog vs design-header drift
description: AMBIGUOUS slugs (openai, firecrawl, deepgram, etc.) appear as byok_required=false in /api/v1/tools — consistent with current pool-allowed implementation, but contradicts Lane 6.7 module-header design intent ("Default 402 byok_required"). Surfaces the open Justin call.
type: project
---

# Lane 4.115 — AMBIGUOUS tier: catalog/runtime drift vs Lane 6.7 design header

**Owner:** Claude (auditor)
**Started:** 2026-04-29
**Severity:** LOW (alignment / documentation drift, not a leak)
**Status:** OPEN — needs Justin call on AMBIGUOUS tier default behavior
**Sibling:** Lane 4.103 (catalog-listing env-var-only gate), Lane 4.100 (P0 ACTIVE LEAK), Lane 6.7 (verified BYOK slug list), Lane 6.14 (infra ToS audit), Codex #23 (BYOK runtime gate, PENDING)

## TL;DR — retraction of iter-21 "leak" claim

The /loop iter-21 investigation flagged `openai` as a Class-A leak in `/api/v1/tools` because the live response shows `byok_required: false` while Lane 4.100 (P0 ACTIVE LEAK audit) classified OpenAI as a master-pool risk. **That framing was wrong.** OpenAI is correctly classified as `AMBIGUOUS_DEFAULT_BYOK_SLUGS` per:

- `src/lib/byok-required-slugs.ts:96-118` — explicit AMBIGUOUS Set, includes openai, firecrawl, twilio, deepgram, creatify, shippo, whisper, removebg, outscraper, deeppdf, screenshot, pexels, creatomate, playwright, dataforseo, github, textbelt, tavily.
- `.agent/lane-4.100-master-pool-active-leak-audit.md:120` — "Ambiguous default-to-BYOK (10): openai, firecrawl, deepgram, outscraper, creatomate, dataforseo, creatify, exa, shippo, notion"
- `src/app/dashboard/providers/page.tsx:85` — `{ slug: "openai", name: "OpenAI", type: "pool", category: "AI" }`. Dashboard explicitly labels these as `type: "pool"` (master-pool routing currently allowed).

The catalog gate `byokRequired()` at `src/app/api/v1/tools/route.ts:19-22` reads:

```ts
function byokRequired(slug: string | null): boolean {
  if (!slug) return false;
  return BYOK_REQUIRED_SLUGS.has(slug) || BYOK_INSUFFICIENT_SLUGS.has(slug);
}
```

This deliberately excludes AMBIGUOUS — matching the dashboard's `type: "pool"` posture and the runtime's "no gate yet" reality (Codex #23 PENDING). So catalog ↔ dashboard ↔ runtime are internally consistent **today**: AMBIGUOUS = pool-allowed.

Apologies for the false-positive escalation — this is the same class-confusion error documented in Hard Rule #61 (artifact-presence check vs reading the source-of-truth Set membership).

## What IS drifty — and worth Justin's call

The Lane 6.7 module-header documentation contradicts the implementation:

`src/lib/byok-required-slugs.ts:18-21`:
> 3. AMBIGUOUS_DEFAULT_BYOK_SLUGS — silent/no-ToS or End User carve-out.
>    Default 402 byok_required; flip to master-pool only after written authorization
>    from provider.

The header says AMBIGUOUS **defaults to 402 byok_required**. The implementation (catalog + dashboard) says AMBIGUOUS **defaults to pool-allowed**. These are opposite.

Lane 4.100 line 78 also leans toward forbidden-by-default:
> Same shape as above with `tool:"openai"`. Lane 6 audit classified OpenAI as `ambiguous_ask_legal` — by Hard Rule #7 default, treat as forbidden until clarified. Currently active at Lane 6 default-to-BYOK posture but no runtime gate.

So we have three sources nominally agreeing on "default to forbidden" (Lane 6.7 header, Lane 4.100 line 78, Hard Rule #7) and three implementations agreeing on "pool-allowed today" (catalog `byokRequired()`, dashboard `type:"pool"`, runtime no-gate).

The decision the implementation reflects: **AMBIGUOUS = today's pool-allowed list, hardens to BYOK_REQUIRED only after each individual provider's ToS is re-audited**. This is more conservative on user-experience (don't gate things you're not sure are forbidden) but less conservative on ToS compliance (we accept ambiguous-aggregator-pattern exposure for OpenAI today).

## The Justin call

**Q:** Should AMBIGUOUS_DEFAULT_BYOK_SLUGS be treated as:

**(A) Pool-allowed today, opt-in to BYOK_REQUIRED per-provider as ToS reviews complete** — current implementation. Pro: minimum disruption. Con: keeps Lane 4.100 P0 ACTIVE LEAK posture for OpenAI live until each is reviewed.

**(B) Forbidden today by default, opt-in to pool only after written provider authorization** — Lane 6.7 header design intent. Pro: matches Hard Rule #7 (forbidden until clarified). Con: forces immediate BYOK setup for 18 slugs, breaks current free-tier UX for openai/whisper/firecrawl/deepgram/etc.

**(C) Hybrid — flip OpenAI specifically to REQUIRED per Lane 4.100 P0 finding, leave other ambiguous as pool-allowed pending individual ToS review.** Pro: closes the highest-volume leak. Con: ad-hoc.

If (A) is the intent, fix the Lane 6.7 module-header comment to match — say "pool-allowed today, harden per-provider" so future readers don't think the gate is broken.

If (B) is the intent, extend `byokRequired()` to include AMBIGUOUS, update dashboard `type:"pool"` → `type:"byok"` for the 18 ambiguous slugs, and ship comm to existing free-tier users.

If (C), promote `openai` (and `whisper`, which inherits openai per byok-required-slugs.ts:109) from AMBIGUOUS to BYOK_REQUIRED today. Update Lane 6.7 source-of-truth + parity test will catch it.

## Where the bytes flow today

For an `openai` call from a `tr_live_` key without BYOK:
1. `/api/v1/execute` → `executeToolRequest()` in `gateway.ts:238`.
2. `resolveAdapter("openai/chat")` returns the openai adapter.
3. **No BYOK gate fires** (Codex #23 PENDING). BYOK lookup at `gateway.ts:282-283` returns null. Adapter falls back to `OPENAI_API_KEY` env var (master pool).
4. ToolRoute eats the per-call cost, no per-customer pool-COGS deduction (Lane 4.100 / Lane 4.10 leak class).

After Codex #23 ships:
- If gate uses `BYOK_REQUIRED_SLUGS.has(slug)` only → still leaks.
- If gate uses `classifyByokTier(slug) === "required"` → still leaks (returns "ambiguous").
- If gate uses `classifyByokTier(slug) !== null && tier !== "internal"` (or `isByokGatedSlug`) → AMBIGUOUS gets 402, **matches the Lane 6.7 module header design intent** but breaks current pool-allowed UX.

So Codex #23's gate-key choice is the implicit answer to the (A)/(B)/(C) question above. Worth pinning down before #23 ships.

## Recommendation for Justin

Pick (C) as a stopgap, then make a deliberate (A)-or-(B) call later:

1. **Today (5 min SQL/code):** Move `openai` and `whisper` from AMBIGUOUS to BYOK_REQUIRED in `byok-required-slugs.ts`. Lane 6.7 source-of-truth markdown gets the same swap. Drift test (`tests/unit/byok-slug-list-parity.test.ts`) will pass post-edit. This closes the Lane 4.100 P0 OpenAI half (Anthropic was already in REQUIRED via slug `claude`).

2. **Before Codex #23 ships:** Pick (A) or (B). If (A), update the Lane 6.7 module header comment to say "pool-allowed today, harden per-provider after individual ToS review." If (B), extend `byokRequired()` to use `isByokGatedSlug()` and accept the UX disruption.

## Acceptance for THIS audit memo

- [x] Confirm openai is in AMBIGUOUS_DEFAULT_BYOK_SLUGS (line 98) — NOT a leak per Lane 6.7 D9
- [x] Confirm catalog `byokRequired()` deliberately excludes AMBIGUOUS — internally consistent with dashboard + runtime today
- [x] Surface design-intent-vs-implementation drift between Lane 6.7 header and catalog/dashboard/runtime
- [x] Document three resolution options (A/B/C) for Justin
- [ ] **JUSTIN:** decide (A)/(B)/(C); the choice is upstream of Codex #23's gate-key
- [ ] **CLAUDE follow-up:** if (C) chosen, ship 2-line edit + Lane 6.7 markdown sync; otherwise update the module-header comment to match the chosen posture

## Process note — iter-21 self-correction

The iter-21 finding "openai byok_required=false is a Class-A leak" was a regex/grep-style class-misclassification — comparing the catalog response field against an external "Class-A" mental model without first reading the BYOK_REQUIRED_SLUGS Set to confirm the classification. Always read the source-of-truth Set membership BEFORE labeling something as a leak. Sibling to Hard Rule #61 (table row counts beat artifact existence as execution proof) — this is the analogous "Set membership beats inferred classification".
