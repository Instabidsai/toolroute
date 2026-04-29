# Lane 4.113 — `auto/route` will bypass Codex ticket #23 BYOK runtime gate

**Owner:** Claude (auditor; impl belongs to Codex ticket #23)
**Started:** 2026-04-29
**Severity:** P0 the day Codex #23 ships (latent today; gate doesn't exist yet)
**Status:** OPEN — feeds Codex ticket #23 acceptance criteria so the gate isn't shipped with this bypass

## TL;DR

Codex ticket #23 (BYOK runtime gate) is PENDING. Current draft per `~/ToolRoute/.agent/codex-build-queue.md` and Lane 4.101: gate fires inside `executeToolRequest()` keyed on `adapter.slug` from `resolveAdapter(toolPath)` (gateway.ts:238). For `tool: "auto/route"` the resolved slug is **`"auto"`**, which is not a member of `BYOK_REQUIRED_SLUGS`. The gate passes. The auto-adapter then runs `heuristicRoute()`, picks a Class-A adapter (claude/openai/stripe/supabase/elevenlabs/sentry/replicate/vapi/calendar/drive/sendgrid/heygen/postiz/etc.), and dispatches via `adapter.execute(operation, input, byokKey)` (auto-adapter.ts:1164) with **no Class-A check**.

Net effect: every Class-A provider that we just spent Lanes 4.100/4.102/4.103/4.108/4.109/4.110/4.111/4.112 surfacing as BYOK-REQUIRED becomes callable via master pool simply by prepending the task with `tool: "auto/route"`.

## File:line evidence

### Gate point (post-Codex #23, will be at gateway.ts:238)

`src/lib/gateway.ts:238`:
```ts
const { adapter, operation } = resolveAdapter(toolPath);
```
Codex #23 will check `BYOK_REQUIRED_SLUGS.has(adapter.slug)` immediately after this. For `toolPath = "auto/route"`:
- `adapter.slug = "auto"`
- `BYOK_REQUIRED_SLUGS.has("auto")` → **false**
- Gate passes.

### BYOK lookup is also keyed wrong for the auto path

`src/lib/gateway.ts:282-283`:
```ts
.eq("tool_slug", adapter.slug)   // "auto"
```
Even if the user has a BYOK key registered for `claude` or `stripe`, this lookup queries `user_provider_keys` for `tool_slug = "auto"` — which never exists. So `byokKey` passed into `auto.execute()` is always `undefined`, and the auto-adapter then calls the downstream Class-A adapter with no key, which falls through to the master pool (the very behavior we're trying to block).

### Heuristic dispatches to Class-A without checking

`src/lib/adapters/auto-adapter.ts:1145-1165`:
```ts
const adapter = getAdapter(bestMatch.adapterSlug);
...
result = await adapter.execute(
  bestMatch.operation,
  mappedInput,
  byokKey
);
```
`bestMatch.adapterSlug` can be: claude (line 151), openai (line 361), stripe (line 841), supabase (line 823), sentry (line 396), elevenlabs, replicate, vapi, calendar, drive, mux, sendgrid, heygen, shotstack, postiz, translate, image, twitter, linkedin, youtube, slack, hubspot, sheets, linear, notion, exa, resend, context7, and ~10 more — all owner-scoped per Lane 4.102.

Confirmed via grep: `BYOK_REQUIRED_SLUGS` is **not imported** anywhere in `auto-adapter.ts`. There is a reactive "requires an API key" error at line 1201 for downstream 401/403 catches, but no proactive Class-A gate.

### Today (pre-#23) the bypass exists in same shape

Even before the gate ships, calling `tool: "auto/route"` with `task: "send a marketing email"` resolves to `sendgrid` and dispatches with whatever BYOK key auto's row has (typically none) → falls back to the sendgrid env var → master-pool resale. Same ToS class as Lane 4.100. The day Codex #23 lands, the gate will block the **direct** path (`tool: "sendgrid/send"`) but leave this auto path open. That asymmetry is the regression.

## Why the gate-point matters

There are two places the gate could fire. They have very different blast radii:

**Option A — gateway.ts on `adapter.slug` (what Codex #23 currently drafts):**
- Fast path: one `Set.has()` before any DB lookups.
- BUG: `auto/route` slug is `"auto"`, never matches.
- Class-A providers reachable via `auto/route` are silently un-gated.

**Option B — gateway.ts on `adapter.slug` PLUS in-adapter re-check inside auto:**
- Auto adapter, after `heuristicRoute()` picks `bestMatch.adapterSlug`, checks `BYOK_REQUIRED_SLUGS.has(bestMatch.adapterSlug)` and (a) looks up BYOK keyed on the resolved slug, not "auto", and (b) returns 402 `byok_required` if the user has no BYOK row for the resolved slug.
- Closes the bypass.
- Cost: one extra DB roundtrip per auto call to look up the resolved-slug BYOK.

**Option C — auto/route refuses to ever resolve to a Class-A adapter:**
- Filter `heuristicRoute()` candidate list against `BYOK_REQUIRED_SLUGS` before scoring.
- Requires user to call the Class-A adapter directly (where the gateway gate fires correctly).
- Cleaner — no asymmetric gate logic — but breaks the "describe your task in natural language" UX for paying BYOK users who *should* be allowed to use auto/route → claude/chat.

**Recommended: Option B.** Auto/route is a marketing differentiator; Option C is a regression for paying users. Option B closes the bypass and keeps the UX. The extra roundtrip is acceptable because auto already does heuristic scoring + adapter resolution + downstream `.execute()` — one more lookup is in the noise.

## Sketch of in-adapter gate (proposed for Codex #23)

In `src/lib/adapters/auto-adapter.ts`, immediately after `bestMatch.adapterSlug` is determined and before line 1145:

```ts
import { BYOK_REQUIRED_SLUGS } from "../byok-required-slugs";

if (BYOK_REQUIRED_SLUGS.has(bestMatch.adapterSlug)) {
  // Look up user's BYOK keyed on the *resolved* slug, not "auto".
  const sb = supabaseAdmin();
  const { data: byokRow } = await sb
    .from("user_provider_keys")
    .select("api_key_encrypted")
    .eq("user_id", ctx.userId)
    .eq("tool_slug", bestMatch.adapterSlug)
    .eq("is_active", true)
    .eq("prefer_own_key", true)
    .single();

  if (!byokRow) {
    return {
      success: false,
      error: `auto/route resolved to "${bestMatch.adapterSlug}" which requires BYOK per provider ToS. Register your key at /api/v1/byok or rephrase the task to route to a non-Class-A adapter.`,
      provider: `auto->${bestMatch.adapterSlug}`,
      metadata: { code: "byok_required", resolved_adapter: bestMatch.adapterSlug }
    };
  }

  byokKey = byokRow.api_key_encrypted;
}
```

This requires `auto.execute()` to receive `ctx` (or at least `ctx.userId`). Today the gateway calls `adapter.execute(operation, input, resolvedKey)` with no ctx. Either:
- Threading ctx through (small breaking signature change to `ToolAdapter`), or
- Pre-resolving the BYOK lookup at the gateway after `auto` is identified (gateway re-runs `heuristicRoute()` against the input — duplicates work).

The signature change is cleaner. Codex ticket #23 will already be touching the adapter contract — bundle it.

## Drift-prevention test (proposed)

`tests/unit/auto-route-class-a-gate.test.ts` (failing-snapshot per Hard Rule #59, gated `AUTO_ROUTE_GATE_BASELINE=skip`):

```ts
describe("auto/route Class-A gate (Lane 4.113)", () => {
  it("auto.execute returns 402 byok_required when heuristic resolves to a Class-A adapter without BYOK", async () => {
    // Mock supabaseAdmin to return no BYOK row.
    // Call autoAdapter.execute("route", { task: "summarize this with claude" }, undefined).
    // Assert: success === false, metadata.code === "byok_required", resolved_adapter === "claude".
  });

  it("auto.execute proceeds when user has BYOK row for the resolved Class-A slug", async () => {
    // Mock supabaseAdmin to return a BYOK row for slug=claude.
    // Assert: dispatched with byokKey from the row, not undefined.
  });

  it("BYOK lookup uses the *resolved* slug, not 'auto'", async () => {
    // Spy on the .from("user_provider_keys").eq("tool_slug", X) call.
    // Assert X === "claude" / "stripe" / etc., never "auto".
  });
});
```

## Sibling lanes / rules

- **Lane 4.100** — P0 ACTIVE LEAK audit (Anthropic + OpenAI master-pool live in prod) — the bypass class this lane exists to close
- **Lane 4.101** — Codex ticket #23 written; original BYOK runtime gate at `/mcp` + `/api/a2a` boundary
- **Lane 4.102** — broken-by-design master-pool class roster (defines BYOK_REQUIRED_SLUGS membership)
- **Lane 4.103** — catalog `/api/v1/tools` env-var-only gate has no Class-A awareness (sibling drift, also feeds Codex #23)
- **Lane 4.108–4.112** — public-claim drift sweeps (the user-facing surface the gate has to stay coherent with)
- **Codex ticket #23** — `Lane 6.5-impl: BYOK runtime gate` PENDING. This memo is direct input to its acceptance criteria.
- **Hard Rule #28** — depth audit after PROVEN finding. Lane 4.103 was PROVEN; the depth chain across "every entrypoint that can resolve a tool" must include `auto/route` and `toolroute/check_before_build`. (`toolroute/check_before_build` checked separately, lines 1-87 of toolroute-adapter.ts — no passthrough, only ToolRoute's own DB. Safe.)
- **Hard Rule #57** — pre-launch copy audit before any tiered-access gate ships. This memo is the runtime-side analog: pre-ship code audit before the gate flips on.

## Acceptance for this audit memo

- [x] Read `src/lib/gateway.ts:220-345` — confirmed gate point is at line 238 (`resolveAdapter(toolPath)`) and BYOK lookup at line 282-283 keys on `adapter.slug`
- [x] Read `src/lib/adapters/auto-adapter.ts` (1327 lines) — confirmed `BYOK_REQUIRED_SLUGS` is not imported, no gate before `adapter.execute()` at line 1164
- [x] Confirmed `toolroute/check_before_build` does NOT have the same bypass class — it only hits ToolRoute's own Supabase RPC
- [x] Drafted in-adapter gate sketch with the slug-resolution fix (lookup on resolved slug, not "auto")
- [x] Drafted vitest skeleton for drift prevention
- [ ] **CODEX #23:** bundle the auto-adapter in-adapter gate into the BYOK runtime gate ticket; ship the vitest as part of the same PR
- [ ] **CLAUDE follow-up:** once Codex #23 lands, end-to-end test `tool: "auto/route"` with `task: "send to claude"` and verify it returns 402 byok_required when no BYOK row exists

## Process-improvement note

The depth chain after a Class-A finding now has two arms:
1. **Public-claim drift** (Lanes 4.103/4.108/4.109/4.110/4.111/4.112) — covers what users *read* about Class-A.
2. **Runtime entrypoint drift** (Lane 4.101 + this lane) — covers what users *call* that resolves to Class-A.

Adapters that resolve to other adapters (auto, future "agent" adapters, anything that does heuristic or LLM-based routing) are a recurring runtime-arm class. Add to depth-audit checklist: **after any P0 BYOK_REQUIRED_SLUGS update, grep for adapters whose `.execute()` calls `getAdapter()` or otherwise dispatches to a runtime-resolved slug, and verify they re-check the gate against the resolved slug, not their own.**
