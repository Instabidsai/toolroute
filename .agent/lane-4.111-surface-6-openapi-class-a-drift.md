# Lane 4.111 surface 6 — public/openapi.json + public/.well-known/openapi.json Class-A drift

**Owner:** Claude
**Started:** 2026-04-29
**Severity:** MEDIUM (agent-discoverable surface; same class as surface 1-5)
**Status:** **partial** — 4 example summaries fixed; 40+ schema/path/description references still drift.

## TL;DR

The OpenAPI spec served at `/openapi.json` and `/.well-known/openapi.json` is the canonical machine-readable contract for ToolRoute's public REST API — agents using OpenAPI tooling (LangChain `OpenAPIToolkit`, OpenAI tool-use generators, custom MCP-via-OpenAPI bridges) consume this file to discover what they can call.

When that spec mentions Class-A adapter slugs without "BYOK required" disclosure, agents try the call first and fail at runtime instead of selecting a different tool — same drift class as surfaces 1-5.

This iteration shipped a **partial fix**: the 4 Class-A example values in the `/api/v1/execute` `requestBody.examples` block now have BYOK disclosure in their `summary`. The remaining drift requires walking the entire 1706-line spec.

## What was fixed (this PR)

Both `public/openapi.json` and `public/.well-known/openapi.json`:
- `claude-chat` example: summary `"Chat with Claude"` → `"Chat with Claude (BYOK required — Anthropic ToS forbids resale)"`
- `elevenlabs-tts` example: summary `"Text to speech"` → `"Text to speech (BYOK required — premium provider)"`
- `github-search` example: summary `"Search GitHub repos"` → `"Search GitHub repos (BYOK required — premium provider)"`
- `sendgrid-email` example: summary `"Send an email"` → `"Send an email (BYOK required — premium provider)"`

Agents browsing the example list now see the BYOK qualifier inline.

## What still drifts (future surfaces)

Test extension to walk public/openapi.json was prototyped during this iteration and reverted because it surfaces ~42 deterministic drifts. Per Hard Rule #59 (failing-snapshot test as drift TODO list), the extension is the right end-state — but each fix should ship as a contained PR so the audit trail is per-surface.

Drift inventory (file:line // Class-A slug // context):
- `claude/chat` x2 (path examples) — line ~53
- `claude/complete` (path operation list) — line ~?
- `elevenlabs/text-to-speech` (path examples)
- `elevenlabs/voices` (operation listing)
- `translate/text` x3 (path examples + schema descriptions)
- `sendgrid/send-email` (path examples)
- `image/generate` x3 (path examples + schema descriptions) — `image` is BYOK-required (Fal.ai)
- `context7/query-docs` x2 (schema descriptions) — `context7` is BYOK-required (Upstash)
- `context7/resolve-library` (schema description)
- AES-256 string x2 — needs `Codex ticket #52` qualifier within 200 chars (sibling to Lane 4.110)

(Run extended test locally to confirm full count — 40 Class-A drifts + 2 AES-256 drifts on 2026-04-29.)

## Why partial-fix-now is correct

- **Examples block is the highest-traffic agent surface in the spec** — agents pick the example closest to their task. Fixing 4 examples covers the typical agent path.
- **Schema descriptions and path operation lists** are read by spec-aware tooling but rarely surfaced to the LLM directly. Lower drift severity.
- **Comprehensive openapi cleanup deserves its own PR** — 40+ edits would be hard to audit in a Class-A drift PR mixed with surface-5 work. Single-surface PRs preserve the per-PR audit trail.

## Acceptance for this surface

- [x] 4 example-block summaries fixed in both openapi files
- [x] Build green
- [x] Existing drift suite (4 files / 18 tests) still passes — no regression
- [ ] **Future surface**: extend `tests/unit/class-a-and-encryption-claim-drift.test.ts` to walk `public/openapi.json` + `public/.well-known/openapi.json` AND grind down all 42 drifts. Open as Lane 4.111 surface 7.

## Sibling

- Surfaces 1-5 of Lane 4.111-impl shipped (PRs #155-#159)
- Lane 4.110 — sibling AES-256 deception class (12 drifts ground to 0 across 4 PRs)
- Hard Rule #59 — drift test as TODO list
- Hard Rule #57 — pre-launch copy audit before tiered-access gate ships
