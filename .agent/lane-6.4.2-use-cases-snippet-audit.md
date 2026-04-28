# Lane 6.4.2 — /use-cases snippet audit (adapter slug + operation correctness)

**Status:** AUDIT — proposes follow-on copy fixes. Codex-friendly cleanup.
**Owner:** Claude (Lane 6)
**Hard Rule cross-refs:** #14 (audits: present findings before executing), #57 (pre-launch copy audit before tiered gates)

## TL;DR

PR #19 (Lane 6.4) fixed REGISTRY-slug references on `/tools/<slug>` chip links. This deeper audit found that the **code snippets themselves are runtime-broken** beyond the chip-link layer:

- 19 distinct `toolroute.execute({ tool: "<slug>/<op>" })` calls across 8 use-cases
- **Only 6 of 19 (32%) are callable today.** The other 13 either reference an unregistered adapter slug or call a non-existent operation.
- The page presents itself as copy-paste-runnable code via the `<CodeBlock>` component. Today, ~68% of the lines a customer would paste fail at runtime with `tool not found` or `operation not supported`.

This is exactly the surface Hard Rule #57 was written for. Lane 6.4 caught the chip-link layer; this audit catches the gateway-routing layer underneath.

## Two-layer slug system (root cause)

ToolRoute carries TWO independent identifiers per tool:

| Layer | Source of truth | Example for Anthropic |
|---|---|---|
| **Registry slug** (catalog, `/tools/<slug>`) | `tools.slug` column in Supabase | `claude-api` |
| **Adapter slug** (gateway routing) | `slug:` field in `src/lib/adapters/<x>-adapter.ts` | `claude` |

Curl/JS examples must use the **adapter slug** to actually execute. Chip links (`href={"/tools/" + slug}`) must use the **registry slug** to render. The two diverge for ~10 tools today. `/use-cases` mixed them up in both directions.

Plus a third layer: **operation names**. The `tool: "x/y"` `y` segment must match a `case`/`if (operation === "y")` branch in the adapter. Marketing-friendly verbs (`messages`, `query`, `deploy`, `scan`) don't always match the adapter's actual op names.

## Audit table — every `toolroute.execute` call in `src/app/use-cases/page.tsx`

✓ = correct, ✗ = broken at runtime. Sources: `grep slug: src/lib/adapters/*.ts` and `grep operation === src/lib/adapters/<x>-adapter.ts`.

| # | line | snippet `tool:` | adapter exists | operation valid | chip toolSlug → registry | runtime callable? |
|---|---|---|---|---|---|---|
| 1 | 50 | `tavily/search` | ✓ tavily | ✓ search | ✓ tavily | **✓ YES** |
| 2 | 56 | `firecrawl/scrape` | ✓ firecrawl | ✓ scrape | ✓ firecrawl | **✓ YES** |
| 3 | 61 | `supabase/insert` | ✓ supabase | ✓ insert | ✗ supabase → supabase-mcp | partial: gateway works, chip 404s |
| 4 | 77 | `semgrep/scan` | ✗ no semgrep adapter | n/a | ✗ semgrep → semgrep-mcp | **✗ tool_not_found** |
| 5 | 82 | `playwright/run-tests` | ✓ playwright | ✗ has screenshot/scrape-text/pdf | ✗ playwright → playwright-mcp | **✗ operation_not_supported** |
| 6 | 87 | `github/create-comment` | ✓ github | ✗ has search-repos/get-readme/list-issues | ✗ github → github-mcp | **✗ operation_not_supported** |
| 7 | 102 | `anthropic/messages` | ✗ slug is `claude` (no `anthropic`) | ✗ adapter ops are chat/complete | ✗ anthropic → claude-api | **✗ tool_not_found** |
| 8 | 110 | `remotion/render` | ✗ no remotion adapter | n/a | ✓ remotion (registry-only) | **✗ tool_not_found** |
| 9 | 115 | `postiz/schedule` | ✓ postiz | ✗ has create-post/list-posts/get-integrations | ✓ postiz | **✗ operation_not_supported** |
| 10 | 131 | `apollo/search-contacts` | ✓ apollo | ✗ has search-people/search-companies/enrich | ✓ apollo | **✗ operation_not_supported** |
| 11 | 137 | `anthropic/messages` (dup) | ✗ | ✗ | ✗ | **✗ tool_not_found** |
| 12 | 145 | `resend/send` | ✓ resend | ✗ has send-email/list-emails | ✗ resend (no registry row at all) | partial: gateway accepts slug, op fails; chip 404 |
| 13 | 158 | `context7/search` | ✓ context7 | ✓ search (also has query-docs) | ✓ context7 | **✓ YES** |
| 14 | 163 | `supabase/query` | ✓ supabase | ✗ has execute-sql/select | ✗ supabase → supabase-mcp | **✗ operation_not_supported** |
| 15 | 173 | `resend/send` (dup) | ✓ | ✗ | ✗ | partial |
| 16 | 185 | `vercel/deploy` | ✗ no vercel adapter | n/a | ✗ vercel → vercel-mcp | **✗ tool_not_found** |
| 17 | 191 | `sentry/query` | ✓ sentry | ✗ has list-issues/get-issue/list-events | ✗ sentry → sentry-mcp | **✗ operation_not_supported** |
| 18 | 200 | `twilio/send-sms` | ✓ twilio | ✓ send-sms | ✓ twilio | **✓ YES** |
| 19 | 219 | `firecrawl/scrape` (dup) | ✓ | ✓ | ✓ | **✓ YES** |
| 20 | 224 | `apollo/enrich-company` | ✓ apollo | ✗ adapter op is `enrich`, not `enrich-company` | ✓ apollo | **✗ operation_not_supported** |
| 21 | 229 | `supabase/upsert` | ✓ supabase | ✗ has insert/select (no upsert) | ✗ supabase → supabase-mcp | **✗ operation_not_supported** |
| 22 | 245 | `elevenlabs/speech-to-text` | ✓ elevenlabs | ✗ has text-to-speech/voices only | ✓ elevenlabs | **✗ operation_not_supported** |
| 23 | 250 | `anthropic/messages` (dup) | ✗ | ✗ | ✗ | **✗ tool_not_found** |
| 24 | 259 | `elevenlabs/text-to-speech` | ✓ elevenlabs | ✓ text-to-speech | ✓ elevenlabs | **✓ YES** |

**Summary:** 24 calls. 5 fully callable + 1 dup of #2 = 6 unique passing. 13 broken (op or slug). 5 partial (gateway works, chip 404).

## Two-layer mismatch table for `toolSlugs` (chip links only)

These render `<Link href={"/tools/" + slug}>` — broken slugs 404.

| toolSlugs entry | registry slug needed | broken? |
|---|---|---|
| `tavily` | tavily | ✓ |
| `firecrawl` | firecrawl | ✓ |
| `supabase` | supabase-mcp (or supabase-auth) | ✗ |
| `semgrep` | semgrep-mcp | ✗ |
| `playwright` | playwright-mcp | ✗ |
| `github` | github-mcp | ✗ |
| `anthropic` | claude-api | ✗ |
| `remotion` | remotion | ✓ |
| `postiz` | postiz | ✓ |
| `apollo` | apollo | ✓ |
| `resend` | (no registry row) | ✗ |
| `context7` | context7 | ✓ |
| `vercel` | vercel-mcp | ✗ |
| `sentry` | sentry-mcp | ✗ |
| `twilio` | twilio | ✓ |
| `elevenlabs` | elevenlabs | ✓ |

**8 of 16 unique toolSlugs entries 404 today.**

## Proposed fixes

Two paths, must be a paired choice:

### Path A — Make snippets actually runnable (recommended)

Replace each broken slug+op pair with the real adapter slug + real op. Add adapters for the missing tools (semgrep, vercel, remotion) under Lane 5 (Codex-owned) before re-using their slugs in /use-cases.

| Current snippet | Proposed swap |
|---|---|
| `anthropic/messages` ×3 | `claude/chat` (adapter routes; op exists) |
| `semgrep/scan` | **DEFER** — adapter doesn't exist yet. Use `playwright/scrape-text` for a different demo OR drop the use-case entirely. |
| `playwright/run-tests` | `playwright/screenshot` (real op; reframe demo as "screenshot-on-deploy regression check") |
| `github/create-comment` | **DEFER** — no write op exists on github adapter. Use `github/list-issues` for a different demo. |
| `remotion/render` | **DEFER** — no adapter. Use `creatify/<op>` or `creatomate/<op>` (verify ops). |
| `postiz/schedule` | `postiz/create-post` (real op) |
| `apollo/search-contacts` | `apollo/search-people` (real op) |
| `resend/send` ×2 | `resend/send-email` (real op) — also needs registry row for chip link |
| `supabase/query` | `supabase/execute-sql` (real op) |
| `vercel/deploy` | **DEFER** — no adapter. Drop or replace with a real CI tool. |
| `sentry/query` | `sentry/list-issues` |
| `apollo/enrich-company` | `apollo/enrich` (real op name) |
| `supabase/upsert` | `supabase/insert` (closest real op; or document upsert as ON CONFLICT execute-sql) |
| `elevenlabs/speech-to-text` | **DEFER** — adapter has TTS only. Use `whisper/transcribe` instead (whisper adapter exists, ops to verify). |

Then fix `toolSlugs` arrays to match registry slugs (8 entries to update).

### Path B — Reframe snippets as "illustrative pseudo-code, not exact API"

Add a banner above each snippet: "Conceptual flow — exact slugs/ops in [docs](/docs)." This is the cheap fix but lowers the page's marketing value (hands-on credibility evaporates).

## Recommendation

**Path A**, but staged:

1. **This PR (audit only):** ship this doc. Do not touch /use-cases/page.tsx.
2. **Fast follow (Codex):** apply the 9 "real swap" edits in the table above (anthropic→claude, postiz/schedule→postiz/create-post, etc.) plus all 8 toolSlugs fixes. Keep the 5 DEFER cases unchanged with a `// TODO: needs adapter — see lane-6.4.2 audit` comment in source.
3. **Lane 5 dependency:** semgrep/vercel/remotion adapters need to land in Codex-owned Lane 5 before /use-cases can ship those use-cases honestly.

## Why this is Lane 6 (not Lane 5)

The runtime-broken adapters (semgrep, vercel, remotion) are Codex's territory — adding new MCP integrations is Lane 5. But the **honest-copy claim** that /use-cases code is runnable is Lane 6 (resale audit / honest marketing). Lane 6.4 already split this between us once. This audit hands Codex a precise table for the swap; Codex doesn't need to re-derive what's broken.

## Cross-references

- `src/app/use-cases/page.tsx` (the file)
- `src/lib/adapters/*.ts` (adapter slug + ops source of truth)
- Supabase `tools` table (registry slug source of truth)
- PR #19 (Lane 6.4 — first-pass chip fixes; merged shows scope was incomplete)
- PR #21 (Lane 6.3 — honest copy edits on /pricing + /docs; same class of issue)
- Hard Rule #57 (pre-launch copy audit before tiered gates)

## Risks / drift

- Adapter ops change without /use-cases tracking → snippets silently rot. Fix: add a build-time test that parses every `tool: "<slug>/<op>"` from page.tsx and asserts each adapter+op resolves. ~30 lines of vitest.
- New use-cases added without going through this audit → drift compounds. Fix: same vitest covers any future case.
