# Lane 6.2 — BYOK-required gate (design + diff plan)

**Status:** Designed, NOT implemented. Held until Justin OKs the gateway.ts touch.

## What

Add a structural gate in `src/lib/gateway.ts` that refuses tool calls to BYOK-only adapters when the customer has not configured a BYOK row in `user_provider_keys`. The gate returns HTTP 402 with `code: "byok_required"` so customer-side error handling can prompt for a key.

Without this gate, ToolRoute is in structural breach of:
- **Anthropic Commercial Terms D.4** (effective 2025-06-17): "may not...resell the Services except as expressly approved by Anthropic."
- **Replicate ToS §2.7(c)(iii)** (effective 2026-04-01): forbids "service bureau, software as a service, cloud, or other technology or service" pattern.
- **ElevenLabs ToS** (byok_only): customer must hold the credential.
- **Resend ToS** (byok_only via sender-domain mechanic): customer transactional email must use customer's own Resend account.

Verified breach pattern (read 2026-04-27): `claude-adapter.ts:8-9`, `replicate-adapter.ts:5-6`, `elevenlabs-adapter.ts:7-8`, `resend-adapter.ts:5-6` all do `byokKey || process.env.X || null` — i.e. byok-supported, NOT byok-required. `gateway.ts:212-293` has zero ToS gate between key resolution and adapter dispatch.

## Why a separate constant in adapter-availability.ts (not in each adapter)

- **Single source of truth.** ToS verdicts live in `.agent/lane-6-resale-audit.md`. The code constant is the runtime mirror. Distributing the check across 4 adapters means 4 places drift independently.
- **Test-friendly.** A unit test can assert `BYOK_ONLY_ADAPTERS` matches the audit doc's `byok_only` rows. (Same pattern as Lane 5.1's adapter-env-matrix self-validating test.)
- **Catalog filter, too.** Lane 5.4's `/api/v1/tools` route can use the same constant to mark byok-only tools with a `byok_required: true` flag for clients.

## Diff plan

### File 1: `src/lib/adapter-availability.ts` (additive)

Add a Set, exported alongside the existing availability map:

```typescript
/**
 * Adapters whose upstream provider's ToS forbids master-pool resale.
 * Source of truth: .agent/lane-6-resale-audit.md.
 *
 * When a customer hits an adapter in this set without a `user_provider_keys`
 * row (prefer_own_key=true, is_active=true), executeToolRequest returns
 * 402 byok_required.
 *
 * If you add an adapter to or remove one from this set, also update:
 *   1. .agent/lane-6-resale-audit.md (verdict column)
 *   2. tests/unit/byok-only-matches-audit.test.ts (self-validating test)
 *   3. project_toolroute_lane6_resale_findings memory entry
 */
export const BYOK_ONLY_ADAPTERS = new Set<string>([
  "claude",       // Anthropic Commercial Terms D.4
  "replicate",    // Replicate ToS §2.7(c)(iii)
  "elevenlabs",   // ElevenLabs API ToS (byok_only)
  "resend",       // Resend sender-domain mechanic
]);
```

### File 2: `src/lib/gateway.ts` (one new branch in `executeToolRequest`)

Insert between current line 283 (end of master-key resolution) and line 288 (request-id generation):

```typescript
  // 3. ToS gate: byok-only adapters require a customer key.
  //    See .agent/lane-6.2-byok-gate-design.md.
  if (BYOK_ONLY_ADAPTERS.has(adapter.slug) && keySource !== "byok") {
    return {
      success: false,
      error: {
        code: "byok_required",
        message: `${adapter.slug} requires a customer-provided API key (BYOK). Add a key at /dashboard/providers, then retry.`,
        provider: adapter.slug,
      },
      requestId: randomBytes(16).toString("hex"),
      latencyMs: 0,
      httpStatus: 402,
    };
  }
```

Plus one import at top:

```typescript
import { BYOK_ONLY_ADAPTERS } from "./adapter-availability";
```

### File 3: `tests/unit/byok-only-matches-audit.test.ts` (new, self-validating)

Reads `.agent/lane-6-resale-audit.md`, extracts every adapter row with verdict `byok_only`, asserts `BYOK_ONLY_ADAPTERS` matches exactly. Same pattern as `tests/unit/adapter-env-matrix.test.ts`. Catches future drift if Justin negotiates an enterprise contract for one provider but the code lags.

### File 4: `src/app/api/v1/execute/route.ts` (no change)

The handler already returns whatever `executeToolRequest` produces. Adding `httpStatus` to the response shape (via `gateway-types.ts`) lets the route translate to a 402 status code instead of the default 200. Verify this is wired — if not, this becomes a 5th file change.

## Total scope

- ~15 lines added across 3 files.
- 1 new test file.
- Zero changes to adapter implementations.
- Zero schema changes.
- Critical path touch: gateway.ts, but inside `executeToolRequest`, NOT inside `validateRequest` (which is the auth path Hard Rule #1 forbids touching).

## Failure modes considered

| Risk | Mitigation |
|---|---|
| Customer with valid BYOK row hits 402 by mistake | The gate is gated on `keySource !== "byok"`. If `byokRow` resolved successfully on line 260, `keySource = "byok"` and the gate passes. |
| Demo API key (`tr_live_e8e4f6c7...`) breaks because it has no BYOK rows | Demo key is for `claude` — yes, this gate would refuse demo claude calls. **Justin must decide:** seed BYOK rows for the demo key, OR keep demo only on master-pool-OK adapters (openai, resend-via-Justin's-domain), OR exempt the demo user. |
| Adapter list drifts from audit doc | Self-validating test (file 3) will fail CI if `BYOK_ONLY_ADAPTERS` doesn't match the audit's `byok_only` rows. |
| 402 status code not propagated | Verify `gateway-types.ts` + `execute/route.ts` carry `httpStatus`. If not, +1 file. |
| Anthropic enterprise contract negotiated later | Remove `claude` from the Set + update the audit doc + remove the test row. ~5 minute change. |

## Smoke test plan (post-deploy)

1. `curl -H "Authorization: Bearer tr_live_e8e4f6c7..." -d '{"tool":"claude","operation":"messages.create",...}' /api/v1/execute` → 402 byok_required.
2. Add a BYOK row for the demo user via `/api/v1/byok` POST → retry → 200 + claude response.
3. `curl ... /api/v1/execute -d '{"tool":"openai",...}'` → 200 (openai NOT in BYOK_ONLY_ADAPTERS, master pool still serves).
4. Run `npm run test:unit` → byok-only-matches-audit test passes.

## What I need from Justin

1. **Authorize gateway.ts touch.** Per Lane 4 ground rule: critical path. PR will be small (~15 lines, no auth-flow change), but it's still an explicit ask.
2. **Demo-key decision** (the only non-obvious failure mode): seed BYOK rows for demo, OR mark demo as master-pool-only (no claude/replicate/elevenlabs/resend), OR exempt the demo user via a flag on `gateway_users`.
3. **OK to also wire `byok_required: true` into `/api/v1/tools`** so customers see which tools need BYOK before they call them. (Lane 5.4 already filters dead tools — this is one more flag.)

After those three answers I open the PR. Without them, this design doc is the entire deliverable.
