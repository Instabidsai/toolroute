# Lane 6.4.1 — Snippet Slug Validation Test

**Status**: Built (test added in PR #19)
**Date**: 2026-04-27
**Owner**: Claude
**Companion to**: `.agent/lane-6.4-slug-mismatch-bug.md` (on branch `lane-6.1-resale-audit-docs` / PR #14)

## What

Added `tests/unit/page-snippet-slug-validation.test.ts`. Walks every `src/app/**/page.tsx`, extracts every static `tool: "slug/operation"` literal from inline code snippets, and asserts that:

1. `slug` exists in the runtime adapter registry (`listAdapters()`)
2. `operation` exists in that adapter's `operations[]` list

This catches the class of bug Lane 6.4 found — customer-facing code samples pointing at slugs/operations that 404 when copy-pasted.

## Why

Lane 6.4 fixed 6 broken refs in 4 BYOK-only-provider snippets. Running the test on the fixed file revealed **11 additional broken refs** across 6 other snippets that are also 404'ing in production right now. These are NOT BYOK-only providers — they're snippets for tools that don't exist on ToolRoute at all, or use the wrong operation name.

Of 18 total `tool: "X/Y"` references in `use-cases/page.tsx`, **17 are broken**. Only `elevenlabs/text-to-speech` (line 152) was correct before Lane 6.4.

## Lane 6.4.2 cleanup queue (11 additional broken refs)

Tracked via `KNOWN_BROKEN_REFS` allowlist in the test. Listed here so a Codex pickup can clear them.

| File:Line | Current ref | Issue | Likely fix |
|-----------|-------------|-------|------------|
| `use-cases/page.tsx:77` | `semgrep/scan` | adapter `semgrep` doesn't exist | Remove snippet OR add adapter (not in scope for Lane 6) |
| `use-cases/page.tsx:82` | `playwright/run-tests` | playwright adapter doesn't exist | Remove or rewrite to a tool that does (puppeteer? — also doesn't exist) |
| `use-cases/page.tsx:87` | `github/create-comment` | check github adapter — likely op is `comment` or `create-issue-comment` | Read `github-adapter.ts`, pick a real op |
| `use-cases/page.tsx:111` | `remotion/render` | remotion adapter doesn't exist | Remove or rewrite |
| `use-cases/page.tsx:116` | `postiz/schedule` | check postiz adapter ops | Read `postiz-adapter.ts`, pick a real op |
| `use-cases/page.tsx:132` | `apollo/search-contacts` | check apollo adapter ops | Read `apollo-adapter.ts` |
| `use-cases/page.tsx:165` | `supabase/query` | check supabase adapter ops | Likely `select` or `from` |
| `use-cases/page.tsx:188` | `vercel/deploy` | vercel adapter doesn't exist as runtime tool | Remove or rewrite |
| `use-cases/page.tsx:194` | `sentry/query` | check sentry adapter ops | Likely `events` or `issues` |
| `use-cases/page.tsx:227` | `apollo/enrich-company` | check apollo adapter ops | Read `apollo-adapter.ts` |
| `use-cases/page.tsx:232` | `supabase/upsert` | check supabase adapter ops | Likely `insert` with conflict resolution |

**Recommended approach for Codex/cleanup pass**:
1. For each file:line above, `grep` `src/lib/adapters/` for the slug.
2. If adapter exists → pick a real operation from `operations[]` and update the snippet (and the input shape — most adapters take typed input, not arbitrary keys).
3. If adapter doesn't exist → swap to an analogous tool that does, OR remove the use-case snippet entirely. Removing is preferable to inventing fictional code.
4. Update `tools[]` and `toolSlugs[]` arrays at the top of each use-case to match.
5. Each fix removes one entry from `KNOWN_BROKEN_REFS` in the test. The test fails if entries no longer reproduce, which forces the allowlist to shrink as bugs get fixed.

## Test design notes

- **Static-string-only**: regex matches `tool: "slug/operation"`. Dynamic `tool: ${var}/run` is skipped — can't validate at build time.
- **Allowlist with shrink-enforcement**: `KNOWN_BROKEN_REFS` is a `ReadonlySet`. Test fails on (a) any new broken ref not in the set, and (b) any set entry that no longer reproduces. Both directions catch drift.
- **Module-load workaround**: `lib/adapters/index.ts` instantiates Supabase at module load via `toolroute-adapter`. Test stubs `NEXT_PUBLIC_SUPABASE_URL` and `_ANON_KEY` before dynamic import.
- **Recursion**: Uses Node's `readdir({withFileTypes:true})` to walk `src/app` — `glob` is not in deps.

## Doesn't catch

- Dynamic `tool` strings built from variables
- Wrong `input` shape (e.g., `{prompt}` instead of `{messages}` for claude/chat) — the slug+operation are valid but the example is wrong
- Snippets in `<code>` blocks rendered from JSON or backtick template literals where the regex doesn't match the surrounding context
- Snippets in markdown files outside `src/app/**/page.tsx` (e.g., README, blog content)

## Coverage

Currently scans `src/app/**/page.tsx`. To extend: add `mdx` files or other formats by widening `findPageFiles`. Probably worth doing after Lane 6.4.2 cleanup, when `KNOWN_BROKEN_REFS` is empty.
