# Lane 4.109 — `llms-full.txt` has 3 sibling drifts: Class-A misclassification + BYOK undercount + premature encryption claim

**Owner:** Claude (auditor + impl)
**Started:** 2026-04-29
**Closed:** 2026-04-29 via PR #165 (commit 2e03506)
**Severity:** MEDIUM (public discovery surface; misleads AI agents on auth + encryption posture)
**Status:** CLOSED — drifts #1 (Class-A misclassification across adapter section headers) and #3 (AES-256 claim) were already addressed in earlier Lane 4.110/4.111 sweeps; this PR closes the remaining surface (llms.txt headcount, FAQ "Can I use my own API keys?", pricing plan tables) and ships `tests/unit/llms-txt-class-a-disclosure.test.ts` as a per-section-header drift guard.

## TL;DR

`public/llms-full.txt` (1278 lines, served at `https://toolroute.ai/llms-full.txt` and `/llms.txt` for agent discovery) was last updated **2026-04-15**, predating Lanes 4.100, 4.102, 4.103, 4.106 and Codex ticket #52. Three concrete drifts:

1. **Class-A misclassification** — claude, openai, stripe listed as "BYOK-supported" (optional) but Lane 4.100/4.102/4.103/6.14 establish they are **BYOK-REQUIRED** because the providers' ToS forbid resale via master pool. AI agents reading these docs will conclude they can call `claude/chat` with just a `tr_live_` key — true at runtime today but ToS-violating.
2. **"BYOK-only adapters" undercount** — line 1085 says "2 BYOK-only adapters" (calendar, drive). Lane 4.102 (broken-by-design master-pool class audit) expanded this set to many more owner-scoped adapters.
3. **Premature encryption claim** — line 1093: "Keys are encrypted at rest with AES-256." Codex ticket #52 (BYOK Vault encryption) is still PENDING per build queue. Until it ships, this claim is materially false — and the same surface that flagged Lane 4.106 (plaintext `tool_providers.auth_key_encrypted`) calls into question whether `user_provider_keys` is actually encrypted today.

## File:line evidence

### Drift #1 — Class-A claude/openai presented as "BYOK: Yes" (optional)

`public/llms-full.txt:205-206`:
```
### 1. claude -- Anthropic Claude LLM
BYOK: Yes | Pricing: $0.003/1K chars
```

`public/llms-full.txt:228-229`:
```
### 2. openai -- OpenAI GPT + DALL-E
BYOK: Yes | Pricing: $0-$0.04/call
```

`public/llms-full.txt:218-221`:
```
**Example:**
{"tool": "claude/chat", "input": {"messages": [{"role": "user", "content": "Hello!"}]}}
```

The example shows zero auth headers beyond an implicit `tr_live_` key. An AI agent reading this concludes: "I can call claude/chat without registering my own Anthropic key." That conclusion contradicts:
- **Lane 4.100** — Anthropic + OpenAI master-pool keys live in production (P0 ACTIVE LEAK audit memo, 2026-04-29)
- **Lane 6.14** — Anthropic + OpenAI ToS forbid resale of API access
- **Lane 4.102** — broken-by-design master-pool class extends to all owner-scoped adapters

The accurate label is **"BYOK: REQUIRED (provider ToS forbids resale)"** with a callout that runtime calls without BYOK will be blocked once Codex ticket #23 (BYOK runtime gate) ships.

### Drift #2 — "BYOK-only adapters" undercount

`public/llms-full.txt:1083-1085`:
```
**36 BYOK-supported adapters:** claude, openai, replicate, whisper, search, firecrawl,
  elevenlabs, deepgram, vapi, twilio, sendgrid, resend, image, pexels, unsplash, removebg,
  screenshot, heygen, creatomate, shotstack, mux, translate, pdf, stripe, apollo, creatify,
  shippo, supabase, sentry, dataforseo, postiz, outscraper, github, textbelt.

**2 BYOK-only adapters** (no pooled key available): calendar, drive.
```

The "BYOK-supported" list mixes two distinct classes: (a) BYOK-OPTIONAL (zero-markup routing on top of working master pool) and (b) BYOK-REQUIRED (master pool exists today but ToS-forbidden). After Lanes 4.102 + 6.14, the BYOK-REQUIRED class includes at minimum: claude, openai, stripe (per Lane 6.14 explicit mention). Likely also: github (Lane 4.104 found master-pool token leaks private repos), supabase (infra provider, ToS-forbidden), and others from Lane 4.102's class expansion.

The line "no pooled key available" for the BYOK-ONLY class is also misleading — for Class-A adapters, the issue isn't pool absence but pool ToS-violation.

### Drift #3 — premature "AES-256 at rest" encryption claim

`public/llms-full.txt:1093`:
```
Keys are encrypted at rest with AES-256. ToolRoute still handles routing, logging, and fallbacks.
```

This claim is in the BYOK section (referring to `user_provider_keys`). Cross-reference:
- **Lane 4.36** — BYOK plaintext storage audit; Codex implementation ticket #52 written
- **Codex ticket #52** — `Lane 4.36-impl — Codex ticket: BYOK Vault encryption` — status PENDING per `~/ToolRoute/.agent/codex-build-queue.md`
- **Lane 4.106** — `tool_providers.auth_key_encrypted` is plaintext (column name is misleading); same engineering choice may apply to `user_provider_keys`

If Codex ticket #52 has not shipped, the AES-256 claim is materially false. Even if the column is not literally named `auth_key_encrypted` for BYOK, the audit chain does not yet show evidence of pgsodium/Vault encryption on `user_provider_keys`.

This is a **deception class** finding (FTC §5 / California §22576), not just drift. Same severity bracket as Lane 4.103 (catalog-listing claim drift).

## Why severity is MEDIUM (not LOW)

Public discovery files for AI agents are a **trust surface**:
- AI agents are aggressively literal — they read "BYOK: Yes" as "BYOK is one option" and proceed to call without it
- Misleading them creates downstream ToS violations that ToolRoute owns (the ToS contract is between ToolRoute ↔ provider, not agent ↔ provider)
- The encryption claim creates direct legal/regulatory exposure if BYOK keys are not actually encrypted at rest yet

Not HIGH because: (a) `tr_live_` keys still gate access, (b) volume of agent traffic via this discovery path is small today, (c) Codex tickets #23 and #52 will close all three drifts when they ship.

## Codex ticket (concrete)

```
Title: Lane 4.109 — refresh public/llms-full.txt for Class-A + encryption posture

Files to change:
- public/llms-full.txt (3 sections)
- public/llms.txt (cross-reference any same claims; check headcount line)
- Optional: tests/unit/llms-txt-drift.test.ts (assert BYOK section enumerates each Class-A
  provider and warns BYOK-REQUIRED; gated behind LLMS_TXT_BASELINE=skip env per Hard Rule #59)

Acceptance:
- Each Class-A adapter (claude, openai, stripe, github, supabase per Lane 4.102/4.104/6.14)
  has "BYOK: REQUIRED" header and a callout that pool calls violate provider ToS
- "BYOK-only adapters" line refreshed against current Lane 4.102 class roster
- Line 1093 encryption claim either: (a) gated on Codex ticket #52 ship status, or
  (b) softened to "Encryption at rest planned (Codex ticket #52); BYOK keys currently
  stored with database-level access controls only"
- Drift test fails on master if a future Class-A adapter is added without the BYOK-REQUIRED label
```

## Sibling rules / lanes

- **Lane 4.100** — P0 ACTIVE LEAK audit (Anthropic + OpenAI master-pool live in prod)
- **Lane 4.102** — broken-by-design master-pool class audit (extends 6.14 to all owner-scoped adapters)
- **Lane 4.103** — catalog-listing env-var-only gate has no Class-A awareness (sibling drift in `/api/v1/tools`)
- **Lane 4.106** — `tool_providers.auth_key_encrypted` plaintext + anon-read AMBIGUOUS audit
- **Lane 4.36 + Codex #52** — BYOK Vault encryption (the unshipped fix that contradicts the AES-256 claim)
- **Lane 6.14** — Stripe + Anthropic + OpenAI ToS forbid resale
- **Hard Rule #57** — pre-launch copy audit before any tiered-access gate ships (this finding is the *post-launch* version of that rule — drift after the audit shipped)
- **Hard Rule #28** — depth audit after PROVEN finding (Lane 4.103 was PROVEN; the depth chain should have probed every claim surface that mentions tools, including llms-full.txt)

## Acceptance for this audit memo

- [x] Read `src/app/llms.txt/route.ts` and `src/app/llms-full.txt/route.ts` — confirmed they serve static `public/*.txt` (no dynamic generation)
- [x] Read `public/llms-full.txt` (last modified 2026-04-15) — extracted all 3 drift surfaces with exact line numbers
- [x] Cross-referenced against Lane 4.100, 4.102, 4.103, 4.104, 4.106, 6.14, and Codex ticket #52 status
- [x] Confirmed file size (1278 lines) and that file has not been touched since 2026-04-15 (predates all 4 cited lanes)
- [ ] **CODEX:** refresh content + add drift test
- [ ] **CLAUDE follow-up:** once Codex ticket #52 ships, re-probe `user_provider_keys` to confirm encryption matches the (then-true) AES-256 claim

## Process-improvement note

The `public/llms-full.txt` file was created early in the project lifecycle and was not in the audit pattern's "places to grep when an audit lane discovers a public-claim drift." Sibling to Lane 4.103's surface enumeration: the natural depth chain after a Class-A finding is **grep every public-readable file for tool-list / provider-list claims** — pricing pages, /agents page, /use-cases, blog posts (Lane 6.4.x), and the LLM discovery files (this lane). Add `public/llms*.txt` to that depth-audit checklist going forward.
