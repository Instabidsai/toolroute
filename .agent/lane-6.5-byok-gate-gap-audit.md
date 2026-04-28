# Lane 6.5 — BYOK gate gap audit + minimal patch proposal

**Status:** AUDIT — proposes runtime change. Decisions block implementation.
**Owner:** Claude (Lane 6)
**Hard Rule cross-refs:** #13 (built ≠ executed), #34 (no partial designed systems), #57 (pre-launch copy audit before tiered gates)

## TL;DR

The runtime today **allows ToS-breaching calls**. Four provider slugs are documented BYOK-required (provider terms forbid API resale): `claude`, `replicate`, `elevenlabs`, `resend`. But `gateway.ts:239–286` resolves keys in a 3-step priority chain (BYOK → master → env var) **with no slug-aware short-circuit**. Customers without a BYOK key calling these 4 tools right now produce calls billed against ToolRoute's master pool / env var keys — the exact thing the providers' resale clauses forbid.

PR #19 (resale audit doc) and PR #21 (honest copy edits) **document** the policy. Lane 6.5 is what makes the policy **enforced** at runtime.

## Evidence

### 1. The 4 BYOK-required slugs (per Lane 6 audit, PR #19)

| Slug | Provider | ToS clause |
|---|---|---|
| `claude` | Anthropic | Usage Policy §3 — no resale of API access |
| `replicate` | Replicate | Acceptable Use — pass-through only with own key |
| `elevenlabs` | ElevenLabs | Master Subscription Agreement — no sublicensing |
| `resend` | Resend | Terms §6 — bring-your-own-domain & key |

### 2. Current key resolution flow

`src/lib/gateway.ts:239–286` — verbatim flow:

```
1. SELECT user_provider_keys WHERE user_id=ctx.userId AND tool_slug=adapter.slug AND is_active AND prefer_own_key
   → if hit:    keySource = "byok"
2. SELECT tool_providers WHERE tool_slug=adapter.slug AND is_active
   → if hit:    keySource = "master"
3. else:        keySource = "env_var"  (adapter reads process.env.<PROVIDER>_API_KEY)
```

The chain is slug-agnostic. There is no list of slugs that must stop at step 1.

### 3. Master/env-var paths are populated for all 4 slugs

- `.agent/adapter-env-matrix.md` lists `ANTHROPIC_API_KEY`, `REPLICATE_API_TOKEN`, `ELEVENLABS_API_KEY`, `RESEND_API_KEY` as adapter env vars.
- `.agent/codex-build-queue.md` task #2 ("Wire master pool keys on Vercel") is marked completed.
- Adapters fall through cleanly: `claude-adapter.ts:8–9` — `return byokKey || process.env.ANTHROPIC_API_KEY || null;` (and identical pattern in replicate/elevenlabs/resend).

Conclusion: a free-tier user without BYOK calling `claude/messages` today gets served by ToolRoute's pooled Anthropic key. ToS violation per call.

### 4. Grep-confirmed: no existing slug-aware gate

```
grep -rn "byok_required\|byokRequired\|RESALE_PROHIBITED" src/lib/
→ (no matches)
```

## Minimal patch proposal

Two-line constant + early-return check inserted between gateway.ts:237 (credit check) and 239 (key resolution).

```ts
// At module top, near GatewayError:
const BYOK_REQUIRED_SLUGS = new Set([
  "claude",
  "replicate",
  "elevenlabs",
  "resend",
]);

// Inserted at gateway.ts:~238 (after credit check, before key resolution):
if (BYOK_REQUIRED_SLUGS.has(adapter.slug)) {
  const sbCheck = supabaseAdmin();
  const { data: byokCheck } = await sbCheck
    .from("user_provider_keys")
    .select("id")
    .eq("user_id", ctx.userId)
    .eq("tool_slug", adapter.slug)
    .eq("is_active", true)
    .eq("prefer_own_key", true)
    .single();
  if (!byokCheck) {
    throw new GatewayError(
      `Provider ${adapter.slug} requires your own API key (provider terms-of-service forbid resale). Register a key at /dashboard/byok before calling this tool.`,
      402,
      "byok_required"
    );
  }
}
```

~15 lines. Returns 402 `byok_required` before any pooled key is touched. Preserves the existing BYOK-hit path (the duplicate query is cheap; a small refactor can dedupe later).

## Test plan

1. Vitest: free-tier user, no BYOK row, calling `claude/messages` → expect 402, code `byok_required`.
2. Vitest: free-tier user with active BYOK row for `claude` → expect 200 (BYOK path).
3. Vitest: free-tier user, no BYOK row, calling `firecrawl/scrape` (not on list) → expect 200 (master path unchanged).
4. Production smoke after deploy: `curl POST /api/v1/execute` with a master-pool API key against `claude/messages` → expect 402 (regression check).

## 3 binary decisions blocking implementation

These need Justin's call before this branch becomes a runtime PR:

### Q1. Default behavior for BYOK-required slugs without a BYOK key
- **A.** Hard 402 `byok_required` (this proposal — enforces ToS)
- **B.** Allow fallthrough to master/env_var (status quo — keeps ToS violation)

### Q2. Existing customers calling these 4 slugs today (if any)
- **A.** Email warning + 7-day grace period before flipping the gate on
- **B.** Hard cut at deploy — affected customers see 402 on next call

### Q3. Master pool keys (`ANTHROPIC_API_KEY` etc.) in Vercel env
- **A.** Remove the 4 env vars after the gate ships — eliminates fallback risk entirely
- **B.** Keep them — gate is the only enforcer; preserves ability to debug ops without flipping rows

## Sequencing

This is **independent of Lane 0.1** (the RLS lockdown SQL). Both can ship in parallel:

- Lane 0.1 protects rows from anon read.
- Lane 6.5 protects providers from ToS-breaching pass-through calls.

Lane 6.5 implementation only requires Justin's answers to Q1–Q3. No SQL, no migration, no schema change.

## Cross-references

- `.agent/codex-build-queue.md` Lane 6 (Claude-owned, full latitude)
- `src/lib/gateway.ts:239-286` (current 3-step chain)
- `src/lib/adapters/{claude,replicate,elevenlabs,resend}-adapter.ts` (env var fallback pattern)
- PR #19 (resale audit findings doc — established the 4-slug policy)
- PR #21 (honest copy edits — `/pricing` + `/docs` already tell users BYOK is required for these 4)

## Risks / what could go wrong

- **Existing paying customer surprise.** If any Pro tier account has been calling these slugs against the master pool, they hit 402 the moment this ships. Q2 governs the grace.
- **Adapter-level env var still works after gate.** If an attacker bypasses gateway.ts entirely (e.g. direct call to an internal adapter), env vars still resolve. Mitigation = Q3.A (remove env vars). Defense-in-depth.
- **Slug list drift.** If a new BYOK-required tool is added later, this `Set` must be updated alongside `.agent/codex-build-queue.md` Lane 6 docs. Add a TODO/test that grep-ensures parity, or move the list to a DB column on `tools`.
