# Lane 4.137 — auto-adapter execMessage credential leak

## What this fixes

`auto-adapter.ts` had two unwrapped error-message paths surfacing
raw thrown-error text from inner adapters into the auto-route
response's `result.error` field. Lane 4.18 / 4.136 wrapped the
direct-dispatch paths (gateway.ts:394 catches thrown errors and
wraps with `redactCreds()`), but auto-adapter dispatches its own
inner adapter call — and its catch block returns `success: true`
(routing succeeded even though execution failed), so gateway.ts:388
catch never fires. The error leak flowed through the success-true
path verbatim.

## Drift class (pre-fix)

```ts
// auto-adapter.ts:1203 (inner exec catch)
return {
  success: true,
  data: {
    ...
    execution_failed: true,
    error: isKeyError
      ? `Tool "..." requires an API key. Set up BYOK at ...`
      : `Tool "${bestMatch.adapterSlug}" execution failed: ${execMessage}`,  // ← leak
  },
};
```

```ts
// auto-adapter.ts:1293 (outer catch — surfaces raw err.message)
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  return { success: false, error: message, provider: "auto" };  // ← leak
}
```

If the inner adapter throws `new Error(\`Linear API failed: 401
${errText}\`)` and `errText` is a provider 401 body that echoes
back the failed Authorization header (some providers DO), the
caller's bearer/api-key flows through `execMessage` → `result.error`
→ JSON response.

Linear is the only adapter today using the Linear-class
`throw new Error(\`...${errText}...\`)` shape (Lane 4.136 audit
confirmed only 1 occurrence), but a future adapter could trip
the same path — and the outer catch (line 1293) catches ANY
thrown error from auto-adapter's logic, including third-party
library errors that may include raw URLs with embedded
credentials.

## Fix

Two-line change:

```ts
// Import (line 3)
import { redactCreds } from "../redact-creds";

// Inner exec catch (line 1203)
: redactCreds(`Tool "${bestMatch.adapterSlug}" execution failed: ${execMessage}`),

// Outer catch (line 1293)
return { success: false, error: redactCreds(message), provider: "auto" };
```

`redactCreds()` (Lane 4.18) covers Bearer/Token, sk-/sk-ant-/
sk-proj-/xai-/gsk_/rk_/tvly-/tr_live_, and generic `api_key=`
shapes — the leak class for both paths.

## Why not the gateway-side wrap in gateway.ts:394?

That wrap covers thrown errors from `adapter.execute()` — including
any errors thrown by `autoAdapter.execute()` itself. But once
auto-adapter catches the inner adapter's throw and returns
`success: true` with `data.error` populated, the gateway treats
that as a successful execution and surfaces the result verbatim.
The leak escapes gateway sanitization by being wrapped inside
a `success: true` response.

The fix happens INSIDE auto-adapter before the result leaves the
function, which means the leak class is closed regardless of how
the gateway handles the result.

## Coordination with Codex #23 (Lane 6.5-impl)

Codex's BYOK runtime gate WIP touches the same file (auto-adapter.ts
imports + signature changes around line 1215). The Lane 4.137 fix is
a 3-line surgical change that doesn't conflict structurally with
Codex's #23 logic — Codex's diff replaces the dispatch wrapping but
doesn't touch lines 1203 or 1293. Merge order:

1. Lane 4.137 (this PR) — minimal redactCreds wrap, lands first.
2. Codex #23 — rebases on master with 4.137 included, line numbers
   shift but the redactCreds calls remain.

If Codex #23 merges first, this PR rebases and the wrap moves to
the post-#23 line numbers (functionally identical change, both
leak sites still need wrapping).

## Sibling guards

- Lane 4.18 — `redactCreds()` definer + first 3 callsites
- Lane 4.83 — 47-adapter coverage gap audit
- Lane 4.135 — `supabaseAdmin()` callsite drift guard
- Lane 4.136 — adapter `errText` interpolation drift guard

## Test plan

- Verified `npx vitest run tests/unit/redact-creds.test.ts` passes (21/21)
- TypeScript clean: `npx tsc --noEmit` shows only pre-existing test-file
  ES2018-flag warnings, no errors in auto-adapter.ts
- Production smoke (post-merge): force an inner-adapter throw via
  invalid BYOK key, confirm `result.data.error` doesn't contain
  `Bearer ` or `sk-ant-` substrings
