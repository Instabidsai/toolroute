# Lane 6.3.2 — Candidate copy edits (ready-to-apply)

**Date:** 2026-04-27
**Author:** Claude (auditor lane)
**Status:** suggested edits — Justin owns final wording
**Continuation of:** lane-6.3 + lane-6.3.1

This doc converts the 12 audit findings into surgical before/after diffs for the **min ethical-ship floor**: pricing + docs + use-cases. Hero/compare/integrations are listed at the bottom as deferred.

Each edit is small. None modifies layout, components, or design — only string content. Justin can copy-paste the "AFTER" block directly.

---

## Edit 1 — `src/app/pricing/page.tsx:55` (Pro tier feature)

**BEFORE:**
```tsx
features: [
  "10,000 requests/month",
  "60 RPM rate limit",
  "10 API keys",
  "All tools access",
  "Priority routing",
  "BYOK support",
  ...
]
```

**AFTER:**
```tsx
features: [
  "10,000 requests/month",
  "60 RPM rate limit",
  "10 API keys",
  "All master-pool tools",
  "BYOK for premium providers*",
  "Priority routing",
  ...
]
```

Plus add footnote at bottom of pricing card:
```tsx
<p className="text-xs text-text-muted mt-2">
  * Anthropic, Replicate, ElevenLabs, Resend require Bring-Your-Own-Key
  (provider terms forbid resale).
</p>
```

(Same edit applies to line 75 — Enterprise tier "All tools + custom adapters" → "All master-pool tools + custom adapters + BYOK for premium providers*")

---

## Edit 2 — `src/app/pricing/page.tsx:99` (FAQ)

**BEFORE:**
```tsx
a: "One key, one bill, automatic routing and fallbacks. Plus our intelligence layer picks the best tool for your task based on real usage data across hundreds of agents. No more managing 20 different API keys and accounts.",
```

**AFTER:**
```tsx
a: "One key, one bill, automatic routing and fallbacks within the master pool. Plus our intelligence layer picks the best tool for your task based on real usage data across hundreds of agents. Premium providers (Anthropic, Replicate, ElevenLabs, Resend) require BYOK — their terms-of-service forbid resale, so we route those calls through your own provider account at zero markup.",
```

---

## Edit 3 — `src/app/pricing/page.tsx:116` (SEO meta description)

**BEFORE:**
```tsx
"MCP gateway and unified API for 70+ AI tools. One API key, every tool. Prepaid credits + BYOK support."
```

**AFTER:**
```tsx
"MCP gateway and unified API for 70+ AI tools. One API key for the master pool, BYOK for premium providers. Prepaid credits + auto-top-up."
```

---

## Edit 4 — `src/app/use-cases/page.tsx:101-107` (Content Pipeline snippet)

**BEFORE:**
```tsx
snippet: `const article = await toolroute.execute({
  tool: "anthropic/messages",
  input: {
    model: "claude-sonnet-4-20250514",
    prompt: "Write a blog post about MCP tools"
  }
});
```

**AFTER:** (add a one-line comment above the BYOK call)
```tsx
snippet: `// Requires BYOK for Anthropic — see /dashboard/byok
const article = await toolroute.execute({
  tool: "anthropic/messages",
  input: {
    model: "claude-sonnet-4-20250514",
    prompt: "Write a blog post about MCP tools"
  }
});
```

---

## Edit 5 — `src/app/use-cases/page.tsx:137-145` (Lead Outreach snippet — anthropic/messages + resend/send)

Add comment above each BYOK call:
```tsx
// Requires BYOK for Anthropic + Resend
```

(Apply same `// Requires BYOK for X` pattern to:)
- Edit 6: line 173 (Customer Support Bot — `resend/send`)
- Edit 7: lines 245, 250, 259 (Voice AI Agent — `elevenlabs/*` + `anthropic/messages`)

---

## Edit 8 — `src/app/docs/page.tsx:267` (claude/chat curl)

Add a callout box ABOVE the snippet:
```tsx
<div className="border border-amber-500/30 bg-amber-500/5 rounded p-3 mb-4 text-sm">
  <strong className="text-amber-300">⚠ BYOK required.</strong>
  <span className="text-text-dim"> Anthropic's terms-of-service forbid
  API resale. Register your key at <a className="text-accent" href="/dashboard/byok">/dashboard/byok</a> before
  running this snippet.</span>
</div>
```

(Apply same callout to:)
- Edit 9: line 310 (replicate/run)
- Edit 10: line 414 (elevenlabs/text-to-speech)
- Edit 11: line 517 (resend/send-email)

---

## Edit 12 — `src/app/docs/page.tsx:1489` (BYOK adapters list)

**BEFORE:**
```tsx
<strong className="text-text">BYOK-supported adapters:</strong> claude, openai, replicate, whisper, search (Brave), firecrawl, elevenlabs, deepgram, vapi, twilio, sendgrid, resend, image (fal.ai), pexels, unsplash, removebg, screenshot, heygen, creatomate, shotstack, mux, translate (DeepL), pdf, stripe, apollo, creatify, shippo, supabase, sentry, dataforseo, postiz, outscraper, github, textbelt.
```

**AFTER:** (split into REQUIRED vs OPTIONAL)
```tsx
<strong className="text-text">BYOK required (provider terms forbid resale):</strong> claude (Anthropic), replicate, elevenlabs, resend.
<br /><br />
<strong className="text-text">BYOK optional (master pool also works):</strong> openai, whisper, brave search, firecrawl, deepgram, vapi, twilio, sendgrid, image (fal.ai), pexels, unsplash, removebg, screenshot, heygen, creatomate, shotstack, mux, translate (DeepL), pdf, stripe, apollo, creatify, shippo, supabase, sentry, dataforseo, postiz, outscraper, github, textbelt.
```

---

## DEFERRED (copy-cleanup pass after Lane 6.2 ships)

These don't need to land in the same PR as Lane 6.2 — they're tagline-level visibility, not contractual claims:

- `src/app/page.tsx:49` — hero "Every tool."
- `src/app/page.tsx:316,320` — Pro tier on homepage
- `src/app/page.tsx:583` — CTA "Every tool"
- `src/app/compare/page.tsx:283,385` — "Unified billing across all tools"
- `src/app/integrations/page.tsx:52,74,487` — MCP "every tool" claims

A simpler approach for these: add a single subtle sentence in the homepage sub-headline or footer:

> "ToolRoute proxies 70+ tools through one API key. Premium providers (Anthropic, Replicate, ElevenLabs, Resend) use Bring-Your-Own-Key per their terms."

That one sentence pre-empts the "every tool isn't actually every tool" complaint without requiring rewrites of every "every tool" mention.

---

## How to apply

If Justin wants this shipped fast, the workflow is:

1. Apply Edits 1-12 in a single commit on a `lane-6.3-copy-fixes` branch.
2. Open PR. Diff stays small (~80 lines changed across 3 files).
3. Merge in same deploy as Lane 6.2 BYOK gate (so flag flips on with copy already updated).

Lane 6.3 + 6.3.1 + 6.3.2 together = one focused PR ready to merge after Lane 6.2 design questions are answered.
