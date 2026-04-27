# Lane 6.3 — Marketing Copy Audit (BYOK gate retroactive-falsity check)

**Date:** 2026-04-27
**Author:** Claude (auditor lane)
**Status:** findings only — copy edits remain Justin's call
**Depends on:** Lane 6.2 BYOK gate (4 providers: claude, replicate, elevenlabs, resend)

## Why this audit

If Lane 6.2 ships as designed, 4 providers (Anthropic, Replicate, ElevenLabs, Resend) will return HTTP 402 `byok_required` when called without a customer-supplied key. Any marketing copy that promises "all tools" or shows a code snippet using one of these providers without disclosing BYOK becomes retroactively misleading the moment Lane 6.2 lands.

This audit catalogs every customer-facing claim that needs adjustment. **It does not modify copy.** Edits are Justin's call (brand voice + legal review).

## Findings

### Finding 1 — Pricing page: "All tools access" Pro/Scale tier claim

**File:** `src/app/pricing/page.tsx`
**Severity:** HIGH (most direct contradiction)

The Pro tier feature bullet says "All tools access" and the comparison table row says `["Tools access", "Basic", "All", "All + custom"]`. After Lane 6.2, "all" is false for any user without their own Anthropic / Replicate / ElevenLabs / Resend key — those tools 402 unconditionally.

**Recommended language (Justin to approve):**
- Pro tier: `"All master-pool tools + BYOK for premium providers"`
- Comparison table: change row to `["Tools access", "Basic master-pool", "Full master-pool + BYOK", "Full + custom"]`
- Footnote anywhere "All tools" appears: `* Anthropic, Replicate, ElevenLabs, Resend require Bring-Your-Own-Key (provider terms forbid resale).`

### Finding 2 — Pricing page: FAQ "automatic routing and fallbacks"

**File:** `src/app/pricing/page.tsx` (FAQ section)
**Severity:** MEDIUM (implies master-pool depth across categories)

The "automatic routing and fallbacks" claim implies that if one tool is unavailable, ToolRoute routes around it from the master pool. For LLM/voice/email categories where the only viable provider in the registry is BYOK-only, fallback is impossible.

**Recommended language:**
- "Automatic routing and fallbacks within master-pool providers. BYOK-only providers (per their ToS) do not participate in master-pool fallback."

### Finding 3 — Use-cases page: 4 of 8 snippets use BYOK-only providers without annotation

**File:** `src/app/use-cases/page.tsx`
**Severity:** HIGH (these are the copy-pasteable proof-of-concept snippets)

| # | Use case | BYOK-only providers used | Snippet works without BYOK after Lane 6.2? |
|---|----------|--------------------------|-------------------------------------------|
| 1 | Content Pipeline | `anthropic/messages` | NO — 402 |
| 2 | Lead Outreach | `anthropic/messages` + `resend/send` | NO — 402 |
| 3 | Customer Support Bot | `resend/send` | NO — 402 |
| 4 | Voice AI Agent | `elevenlabs/speech-to-text` + `anthropic/messages` + `elevenlabs/text-to-speech` | NO — fully blocked |

The other 4 use-case snippets (whichever they are — the survey covered lines 90-280 of the file) use only master-pool-OK providers and remain accurate.

**Recommended language (per snippet):**

Add a one-line callout above each affected snippet:
```
> Requires BYOK for: Anthropic [, Resend, ElevenLabs]. See [BYOK setup](/dashboard/byok).
```

Or annotate per-line in the snippet:
```javascript
const result = await toolroute.execute({
  tool: "anthropic/messages",  // BYOK required
  ...
});
```

### Finding 4 — Homepage / hero copy (not yet surveyed)

**Status:** OUT OF SCOPE for this pass. Lane 6.3.1 follow-up if hero copy makes "any tool" / "all providers" claims.

### Finding 5 — Docs page (not yet surveyed)

**Status:** OUT OF SCOPE for this pass. If `/docs` shows code samples calling any of the 4 BYOK providers, same annotation pattern applies.

## Cross-references

- Lane 6.1 master audit: `.agent/lane-6-resale-audit.md` — verdicts for all 8 providers
- Lane 6.2 gate design: `.agent/lane-6.2-byok-gate-design.md` — the 4 providers gated
- Per ToolRoute Hard Rule #48: "deployed ≠ user-tested" — copy edits need Justin to read on the live site, not just merged.

## What this audit does NOT cover

- Hero / homepage copy (separate sweep needed)
- `/docs` page (separate sweep needed)
- Marketing emails / blog posts / changelog entries
- Twitter/X bio + pinned tweet
- README.md hero claims

These all need a one-pass scan before Lane 6.2 ships to production. Recommend Justin take a 15-minute pass with Ctrl+F on these terms across the repo + external surfaces:
- `all tools` / `all providers` / `every tool`
- `automatic fallback` / `automatic routing`
- `anthropic/` / `claude/` / `replicate/` / `elevenlabs/` / `resend/` (in code samples)

## Recommended sequencing

1. **Lane 6.2 gate ships first** (with feature flag, OFF in prod).
2. **This audit + the broader sweep** completes; copy lands in a single PR.
3. **Flag flips on** in same deploy as copy goes live — no window where gate is on but copy still says "all tools."

If sequencing flips (copy first, gate later), no harm done — copy is just early-honest. If gate first / copy later, ToolRoute is briefly making promises it doesn't keep. Avoid that.
