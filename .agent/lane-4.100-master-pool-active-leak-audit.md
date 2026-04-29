# Lane 4.100 — Master-pool runtime-gate gap converts to ACTIVE LEAK on Anthropic + OpenAI

**Owner:** Claude (auditor)
**Started:** 2026-04-28
**Severity:** P0 / CRITICAL
**Sibling:** Lane 6 ToS audit (closed) → Lane 6.5 BYOK gate-gap memo (closed) → Lane 6.5-impl Codex ticket #23 (PENDING) → **Lane 4.100 (ACTIVE LEAK escalation)**

## TL;DR

The Lane 6 ToS audit (Lanes 6 + 6.8 + 6.9 + 6.11 + 6.12 + 6.13, 27 providers) re-classified Anthropic as `forbidden` and OpenAI as `ambiguous_ask_legal` (default-to-BYOK). However:

1. `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` are SET in Vercel production env (verified via Vercel API).
2. `/api/v1/execute` has NO BYOK enforcement gate — it validates auth + rate-limits, then calls `executeToolRequest` which falls through to the master-pool env-var.
3. Codex ticket #23 (Lane 6.5-impl) and #25 (Lane 6.7) — the runtime BYOK gate — are still PENDING.

**Result:** any `tr_live_` API key holder calling `{tool:"claude",operation:"chat"}` or `{tool:"openai",...}` without a BYOK key consumes ToolRoute's pooled Anthropic/OpenAI inference. This is a live ToS breach (Anthropic) + ambiguous-aggregator-pattern exposure (OpenAI) AND a live COGS leak (every call charged to ToolRoute's account, no customer-side credit deduction tied to the pool).

## Verification trail

### Vercel prod env-var inventory (2026-04-28)
Pulled via `GET /v10/projects/$PROJ/env?teamId=$TEAM` with CLI auth token. Master-pool keys actually set in production:

| Env var | Targets | Status |
|---|---|---|
| `ANTHROPIC_API_KEY` | production | **LIVE — leak path active** |
| `OPENAI_API_KEY` | production | **LIVE — leak path active** |
| `RESEND_API_KEY` | production | LIVE — Resend ToS permits BYOK; master-pool authorization separate question |
| `STRIPE_SECRET_KEY` | dev/preview/prod | ToolRoute platform billing key (NOT the stripe-adapter master-pool — different code path) |
| `STRIPE_PLATFORM_KEY` | (not present) | Latent — stripe adapter would fall through if Justin sets it |

**16 of 18 verified-forbidden master-pool env vars are NOT set in prod** (replicate, tavily, mux, twilio, heygen, shotstack, deepl, apollo, linear, sendgrid, sentry, linkedin, hubspot, slack, github, notion). Those leaks are LATENT — gate-gap exists but nothing to fall through to.

**2 of 18 ARE set:** `ANTHROPIC_API_KEY` + `OPENAI_API_KEY`. These are the ACTIVE leak paths. They were wired in original launch task #2 ("Wire master pool keys on Vercel") before Lane 6 ToS re-classification, and never yanked.

### Code path proof

**`src/lib/adapters/claude-adapter.ts:8-10` (slug = `claude`):**
```typescript
function getApiKey(byokKey?: string): string | null {
  return byokKey || process.env.ANTHROPIC_API_KEY || null;
}
```

**`src/lib/adapters/openai-adapter.ts:5-7`:**
```typescript
function getApiKey(byokKey?: string): string | null {
  return byokKey || process.env.OPENAI_API_KEY || null;
}
```

**`src/app/api/v1/execute/route.ts` (full read 2026-04-28):**
- Validates `tr_live_` API key (auth ✓)
- `checkRateLimit` ✓
- Calls `executeToolRequest(ctx, body.tool, body.input)` directly
- **NO check** for `byokKey` presence by tool slug
- **NO byok-slugs.ts** file exists (Codex tickets #23 + #25 pending — never landed)

**`src/app/dashboard/providers/page.tsx:59`** (verified earlier this loop):
```typescript
{ slug: "stripe", name: "Stripe", type: "byok", category: "Payments" }
```
UI claims many slugs are `type: "byok"` but runtime doesn't enforce. Drift between intended posture and actual behavior — sibling to Hard Rule #54 (UI/runtime drift class).

## Concrete leak scenarios

### Scenario A — Anthropic ToS breach + COGS leak (PROVEN active)
Any user with valid `tr_live_` key:
```bash
POST /api/v1/execute
{ "tool": "claude", "operation": "chat",
  "input": { "messages": [{"role":"user","content":"..."}] } }
```
Path: route validates key → no BYOK gate → claude-adapter.getApiKey returns `process.env.ANTHROPIC_API_KEY` → call hits Anthropic on ToolRoute's account.

Per Lane 6 audit, Anthropic ToS forbids: "providing access to the Anthropic API to a third party as part of a service... including via API resale, gateway, or proxy services." Direct breach.

### Scenario B — OpenAI ambiguous-aggregator (PROVEN active)
Same shape as above with `tool:"openai"`. Lane 6 audit classified OpenAI as `ambiguous_ask_legal` — by Hard Rule #7 default, treat as forbidden until clarified. Currently active at Lane 6 default-to-BYOK posture but no runtime gate.

### Scenario C — Latent (16 other forbidden adapters)
The moment Justin sets any of the 16 currently-unset env vars (e.g., to support a paying customer who wants pooled access), that adapter goes live as-leak with NO additional code change required. Same pattern as scenarios A/B.

### Scenario D — Stripe latent (worst case if triggered)
If Justin sets `STRIPE_PLATFORM_KEY` for any future ToolRoute platform-billing reason, `tool:"stripe",operation:"list-customers"` returns ToolRoute's full Stripe customer list to the API caller. PII + financial leak.

## Root cause

**Sequencing fault:** master-pool keys were wired BEFORE the ToS audit was performed. The audit re-classified them but the env vars + runtime fall-through were never reconciled. The two Codex tickets that would close the gap (`#23 Lane 6.5-impl` BYOK runtime gate, `#25 Lane 6.7` 49-slug BYOK list) have been pending across multiple sprints.

**Aggravating factor:** UI says BYOK, runtime doesn't enforce — Hard Rule #54 class. No drift test catches this because no source-of-truth exists (no `byok-slugs.ts`).

## Remediation — sequence matters

### Immediate (Justin owns, ≤15 min, no Codex)
**STEP 1: Yank env vars from Vercel production now.**
```bash
TOKEN="vca_..."; TEAM="team_hXFPmWH2P3BcbEhlD0EJqgGl"; PROJ="prj_kx4eeLmGLd8SbQbhxZkAoEORMfhF"
# Delete ANTHROPIC_API_KEY (production target)
curl -X DELETE "https://api.vercel.com/v10/projects/$PROJ/env/<env_id_anthropic>?teamId=$TEAM" -H "Authorization: Bearer $TOKEN"
curl -X DELETE "https://api.vercel.com/v10/projects/$PROJ/env/<env_id_openai>?teamId=$TEAM" -H "Authorization: Bearer $TOKEN"
# Force redeploy: empty commit on main + push, OR `vercel deploy --prod --yes`
```
After yank: `getApiKey` returns null → adapters return error "No API key configured. Set ANTHROPIC_API_KEY or provide your own key via BYOK." Acceptable degradation — caller is told to BYOK.

### Short-term (Codex ticket — already exists, raise priority)
**STEP 2: Promote Codex ticket #23 (Lane 6.5-impl) from `pending` to `P0/critical`.**

The current ticket scope is "BYOK runtime gate." Augment scope:
- Add `src/lib/byok-slugs.ts` exporting `BYOK_REQUIRED_SLUGS: Set<string>` containing 21 slugs verified across Lanes 6 + 6.8 + 6.9 + 6.11 + 6.12 + 6.13:
  - `anthropic` (`claude` adapter slug), `openai`, `replicate`, `tavily`, `mux`, `twilio`, `heygen`, `shotstack`, `deepl`, `apollo`, `linear`, `sendgrid`, `sentry`, `linkedin`, `hubspot`, `slack`, `github`, `outscraper`, `creatomate`, `dataforseo`, `creatify`, `exa`, `shippo`, `notion` (24 actually — final count below).
- Modify `/api/v1/execute/route.ts` after auth + rate-limit, before `executeToolRequest`: if `BYOK_REQUIRED_SLUGS.has(body.tool)` AND no BYOK key registered for this user+slug, return 402 `{ error: "BYOK required for this provider", code: "BYOK_REQUIRED" }`.
- Add equivalent gates on `/mcp`, `/api/a2a`, OpenAI Functions catalog filtering.
- Vitest drift guard: list of master-pool fingerprints in adapters MUST be subset of `BYOK_REQUIRED_SLUGS` (or explicitly carved out as `MASTER_POOL_AUTHORIZED`).

### Cumulative BYOK-required slug list (Lane 6 audit closure)
Sourced from `.agent/lane-6-resale-audit.md` + 6.9, 6.11, 6.12, 6.13 sibling memos.

**Forbidden (16):** anthropic (slug=`claude`), replicate, tavily, mux, twilio, heygen, shotstack, deepl, apollo, linear, sendgrid, sentry, linkedin, hubspot, slack, github

**Ambiguous default-to-BYOK (10):** openai, firecrawl, deepgram, outscraper, creatomate, dataforseo, creatify, exa, shippo, notion

**byok-permitted (2):** resend, elevenlabs

**Total to gate: 26 slugs** (16 forbidden + 10 ambiguous treated as forbidden by Hard Rule #7).

The `resend` + `elevenlabs` permitted-BYOK slugs do NOT need master-pool surface — they pass through BYOK by definition. If user has no key, adapter returns config error. No gate needed (caller still gets honest error, no leak).

## Acceptance for this audit memo

- [x] Vercel prod env-var inventory verified via API (2026-04-28)
- [x] Adapter master-pool fingerprint confirmed: claude-adapter.ts:8-10, openai-adapter.ts:5-7
- [x] `/api/v1/execute` route confirmed to have NO BYOK gate
- [x] `src/lib/byok-slugs.ts` confirmed NOT to exist
- [x] Codex ticket #23 referenced as the existing-pending fix
- [x] Recommended immediate action (env-var yank) documented with curl
- [x] Cumulative 26-slug BYOK list compiled across Lanes 6 + 6.8 + 6.9 + 6.11 + 6.12 + 6.13
- [ ] Justin: yank ANTHROPIC_API_KEY + OPENAI_API_KEY from Vercel prod
- [ ] Justin: promote Codex #23 (Lane 6.5-impl) priority to P0
- [ ] Codex: ship `src/lib/byok-slugs.ts` + `/api/v1/execute` gate

## Why this matters for the loop

The /loop directive is "production-ready financial gateway." A live ToS breach against the upstream foundation model provider (Anthropic) makes the gateway not production-ready by definition — Anthropic could revoke the master key on detection, breaking every paying customer + every BYOK-fallback path that tries to demo the master pool. Plus the COGS leak ($/call charged to ToolRoute). Plus the Hard Rule #54 UI/runtime drift class.

The fix exists as a pending Codex ticket. The escalation here is making it actually move + the immediate env-var yank as interim mitigation.
