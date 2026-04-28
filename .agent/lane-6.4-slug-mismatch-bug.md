# Lane 6.4 — Slug/operation mismatches in customer-facing copy (CURRENTLY BROKEN)

**Date:** 2026-04-27
**Author:** Claude (auditor lane)
**Severity:** HIGH — copy-pasteable snippets are broken **right now**, not post-Lane-6.2

While auditing for the Lane 6.2 BYOK gate, I cross-referenced the slugs/operations in `src/app/use-cases/page.tsx` and `src/app/docs/page.tsx` against the actual adapter registry in `src/lib/adapters/*-adapter.ts`. Found that **5 of 7 use-cases snippets reference slugs or operations that do not exist** — they would 404 with "Unknown provider" before any BYOK question even comes up.

## Adapter registry (canonical, from code)

| Slug (registry) | Operations |
|---|---|
| `claude` | `chat`, `complete` |
| `replicate` | `run`, `list-models` |
| `elevenlabs` | `text-to-speech`, `voices` |
| `resend` | `send-email`, `list-emails` |

## Bugs in `src/app/use-cases/page.tsx`

| Line | Snippet | Issue | Status |
|------|---------|-------|--------|
| 102 | `tool: "anthropic/messages"` | Slug `anthropic` doesn't exist; should be `claude/chat` | BROKEN (404 currently) |
| 137 | `tool: "anthropic/messages"` | Same | BROKEN (404 currently) |
| 145 | `tool: "resend/send"` | Operation `send` doesn't exist; should be `send-email` | BROKEN (404 currently) |
| 173 | `tool: "resend/send"` | Same | BROKEN (404 currently) |
| 245 | `tool: "elevenlabs/speech-to-text"` | Operation `speech-to-text` doesn't exist on `elevenlabs` adapter (only `text-to-speech` + `voices`); should use `whisper/transcribe` or `deepgram/transcribe` | BROKEN (404 currently) |
| 250 | `tool: "anthropic/messages"` | Slug `anthropic` doesn't exist | BROKEN (404 currently) |
| 259 | `tool: "elevenlabs/text-to-speech"` | Matches registry ✓ | OK (will 402 post-6.2) |

**Net:** 6 of 7 BYOK-only snippets in use-cases are 404'ing right now. Only line 259 is correct.

## Status of `src/app/docs/page.tsx` snippets

All 4 docs page curl snippets use correct slugs+operations:

| Line | Snippet | Status |
|------|---------|--------|
| 267 | `claude/chat` | Correct → 402 post-6.2 |
| 310 | `replicate/run` | Correct → 402 post-6.2 |
| 414 | `elevenlabs/text-to-speech` | Correct → 402 post-6.2 |
| 517 | `resend/send-email` | Correct → 402 post-6.2 |

Docs page is fine. Use-cases page is the problem surface.

## Why this slipped past CI

The use-cases page renders code as a string in a styled `<pre>` block — it's never executed by the build, never type-checked against the adapter registry. There's no test that walks the page snippets and verifies each `tool:` slug/operation exists in `listAdapters()`.

## Probable customer impact

Anyone copy-pasting these snippets from `/use-cases` into their agent code right now hits:
```
{
  "error": "Unknown provider: \"anthropic\". Available: claude, replicate, elevenlabs, resend, openai, ..."
}
```

The error message at least reveals the available providers, so the savvier user fixes it themselves. But it's a poor first impression.

## Recommended fixes

### Immediate (independent of Lane 6.2)

Edit `src/app/use-cases/page.tsx`:

| Line | BEFORE | AFTER |
|------|--------|-------|
| 102 | `tool: "anthropic/messages"` | `tool: "claude/chat"` |
| 137 | `tool: "anthropic/messages"` | `tool: "claude/chat"` |
| 145 | `tool: "resend/send"` | `tool: "resend/send-email"` |
| 173 | `tool: "resend/send"` | `tool: "resend/send-email"` |
| 245 | `tool: "elevenlabs/speech-to-text"` | `tool: "deepgram/transcribe"` or `tool: "whisper/transcribe"` (verify which exists) |
| 250 | `tool: "anthropic/messages"` | `tool: "claude/chat"` |

Plus the `input` shapes likely need adjustment too — `claude/chat` expects `{messages: [{role, content}]}` not `{prompt}`. The current snippets pass `prompt:` which would also fail validation post-slug-fix.

### Long-term (Lane 6.4.1, recommend Codex pick up)

Add a build-time test that walks every page in `src/app/**` for `tool:\s*"[^/]+/[^"]+"` patterns and asserts each slug/operation exists in `listAdapters()`. This is the same self-validation pattern already used in Lane 6.1 for the resale audit ↔ adapter-availability sync.

```ts
// src/test/use-cases-snippets.test.ts (sketch)
const SNIPPET_REGEX = /tool:\s*"([^/]+)\/([^"]+)"/g;
const pageFiles = await glob("src/app/**/page.tsx");
const adapters = listAdapters();
for (const file of pageFiles) {
  const content = await readFile(file, "utf-8");
  for (const [_, slug, op] of content.matchAll(SNIPPET_REGEX)) {
    const adapter = adapters.find(a => a.slug === slug);
    expect(adapter, `${file}: unknown slug "${slug}"`).toBeDefined();
    expect(adapter.operations).toContain(op);
  }
}
```

This test would have caught all 6 of the bugs above immediately. Recommend adding to CI as part of Lane 6.2's PR — fixes 6 latent bugs and prevents the next one.

## Cross-reference

- Lane 6.1 verdicts: `.agent/lane-6-resale-audit.md`
- Lane 6.2 gate design: `.agent/lane-6.2-byok-gate-design.md`
- Lane 6.3.2 candidate edits: `.agent/lane-6.3.2-candidate-copy-edits.md` — **needs revision** to incorporate the corrected slugs/ops above (the BYOK annotations were good, but they were going to be added to broken snippets).

## Recommendation

Justin should fix the slugs **first** (independent of any BYOK decision), then apply Lane 6.3.2 BYOK annotations on top of the corrected snippets. Doing it in this order means:
1. Snippets work today (immediate user-visible fix).
2. Once Lane 6.2 ships, snippets show correct 402 BYOK error instead of confusing 404 unknown-provider error.

If Justin wants this batched into one PR with Lane 6.2 + 6.3 copy edits, the diff is still small (~12 line changes for the slug corrections + ~12 for the BYOK annotations).
