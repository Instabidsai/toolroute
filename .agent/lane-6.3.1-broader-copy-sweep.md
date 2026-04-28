# Lane 6.3.1 — Broader Marketing Copy Sweep (hero + docs + integrations + compare)

**Date:** 2026-04-27
**Author:** Claude (auditor lane)
**Status:** findings only — Justin owns copy edits
**Continuation of:** `lane-6.3-marketing-copy-audit.md`

## Methodology

Grepped `src/app/**` for the 6 trigger phrases (`all tools` / `every tool` / `automatic fallback` etc.) and for code snippets calling the 4 BYOK-gated providers (`anthropic` / `claude/` / `replicate` / `elevenlabs` / `resend`).

## Findings — additional surfaces beyond Lane 6.3

### Finding 6 — Homepage hero: "Every tool." (HIGHEST visibility)

**File:** `src/app/page.tsx:49`

```tsx
<h1 ...>
  One API key.
  <br />
  <span className="text-accent">Every tool.</span>
</h1>
```

This is the single most-visited line on toolroute.ai. After Lane 6.2, "every tool" is false unless the user has BYOK configured for the 4 gated providers.

Sub-headline (line 52-54) is also affected:
> "ToolRoute is the OpenRouter for tools. One unified API to access 70+ best-in-class tools for AI agents. No more managing dozens of API keys, accounts, and integrations."

— `No more managing dozens of API keys` is contradicted by BYOK requirement for Anthropic/Replicate/ElevenLabs/Resend.

**Severity:** HIGH (visibility) but SOFT (it's a tagline, not a contractual claim).

**Recommended language options:**
- Soft: keep "Every tool." headline, add subtle footnote `* BYOK required for some premium providers (provider terms forbid resale)`
- Honest: change to "One API key. Every tool we can resell." (less punchy)
- Hybrid (recommended): keep headline, change sub-headline first sentence: "ToolRoute is the OpenRouter for tools. One unified API for ~50 master-pool tools, BYOK for the rest."

### Finding 7 — Homepage Pro tier: "All tools access" + "BYOK support"

**File:** `src/app/page.tsx:316,320`

Same finding as pricing page (Finding 1) but on homepage too. Pro tier shows "All tools access" right above "BYOK support" which is internally contradictory — if all tools were truly accessible, why is BYOK called out as a separate Pro feature?

**Recommended:** same fix as Finding 1, applied here too.

### Finding 8 — Homepage CTA: "One API key. Every tool." (line 583)

**File:** `src/app/page.tsx:583`

Repeated headline near footer. Same edit as Finding 6 should propagate here.

### Finding 9 — Pricing meta description: "every tool"

**File:** `src/app/pricing/page.tsx:116`

```ts
"MCP gateway and unified API for 70+ AI tools. One API key, every tool. Prepaid credits + BYOK support."
```

This is the SEO meta description — appears in Google results. Same "every tool" + "BYOK support" contradiction.

### Finding 10 — Compare page: "One API key. One bill. Every tool your agent needs."

**File:** `src/app/compare/page.tsx:385` (also `283` "Unified billing across all tools")

Same pattern. After Lane 6.2, billing is unified for master-pool only; BYOK calls bill at the customer's own provider account.

### Finding 11 — Integrations page: 3 instances of "every tool"

**File:** `src/app/integrations/page.tsx:52,74,487`

Lines 52 and 74 specifically describe the MCP server adding "every tool":
> "Add ToolRoute as an MCP server in your `.mcp.json` and every tool is available instantly."
> "Same MCP endpoint works in Cursor... every ToolRoute tool appears as a native action your Cursor agent can call."

After Lane 6.2, an MCP client without BYOK gets 402 on 4 of those tools. The tool is "available" in that it appears in the listing but is not callable.

**Recommended:** add a short aside in the Claude Code / Cursor onboarding:
> "Premium providers (Anthropic, Replicate, ElevenLabs, Resend) require BYOK — set them up in [Dashboard › BYOK](/dashboard/byok)."

### Finding 12 — `/docs` page: 4 unannotated curl snippets for BYOK providers

**File:** `src/app/docs/page.tsx`
**Severity:** HIGH (developers copy-paste these)

Four curl snippets show direct calls to BYOK-gated providers without any "BYOK required" annotation:
- Line 267: `'{"tool": "claude/chat", "input": {...}}'`
- Line 310: `'{"tool": "replicate/run", "input": {...}}'`
- Line 414: `'{"tool": "elevenlabs/text-to-speech", "input": {...}}'`
- Line 517: `'{"tool": "resend/send-email", "input": {...}}'`

Line 1489 already lists these as "BYOK-supported adapters" but the snippets above that section don't call out that BYOK is **required**, not optional, for these 4.

**Recommended:** add a callout box above each of those 4 snippets:
```
> ⚠ BYOK required: this provider's terms-of-service forbid resale. Register your key at /dashboard/byok before running this snippet.
```

And the line 1489 list of "BYOK-supported adapters" should be split into two lists:
- **BYOK required** (master-pool not allowed): claude, replicate, elevenlabs, resend
- **BYOK optional** (master-pool also works): openai, whisper, brave search, firecrawl, deepgram, vapi, etc.

### Finding 13 — Existing CORRECT framing (no edit needed)

For completeness — these surfaces already have honest language:

- `agents/page.tsx:69` — "BYOK on **every provider whose terms allow it**" ✓
- `faq/page.tsx:95` — Same correct phrasing ✓

These pages are aware that some providers don't allow master-pool. **Lane 6.3.1 deliverable: align all other pages to this language.**

## Out-of-scope (deferred to Lane 6.3.2 if needed)

- Blog posts (40+ files) using "every tool" — lower priority, less commercial commitment
- Changelog entries
- README.md
- External marketing surfaces (Twitter, LinkedIn, etc.)

## Total surfaces flagged: 12 findings across 6 files

| File | Findings | Severity |
|------|----------|----------|
| `src/app/pricing/page.tsx` | 4 (Lane 6.3 + 9) | HIGH |
| `src/app/use-cases/page.tsx` | 4 snippets (Lane 6.3) | HIGH |
| `src/app/page.tsx` | 3 (Lane 6.3.1 #6, #7, #8) | HIGH (visibility) |
| `src/app/docs/page.tsx` | 4 snippets (#12) | HIGH (devs) |
| `src/app/compare/page.tsx` | 2 (#10) | MED |
| `src/app/integrations/page.tsx` | 3 (#11) | MED |

## Sequencing recommendation (unchanged from Lane 6.3)

1. Lane 6.2 BYOK gate ships behind feature flag (OFF in prod).
2. Copy edits from Lane 6.3 + 6.3.1 land in single PR.
3. Flag flips on in same deploy as copy goes live.

If the volume of edits feels intimidating, the absolute minimum to ship Lane 6.2 ethically is: pricing page + docs page + 4 use-case snippets. The hero / compare / integrations edits can ship later in a copy-cleanup pass.
