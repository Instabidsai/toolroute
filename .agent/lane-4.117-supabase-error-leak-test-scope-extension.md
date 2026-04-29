---
name: Lane 4.117 — supabase-error-leak drift test scope extension (src/app/api/** → src/app/**)
description: tests/unit/supabase-error-leak.test.ts walked src/app/api/ only — same Lane 4.116-class scope-claim gap (Next.js App Router accepts route.ts anywhere under src/app/). Extended scope. No live leak; defense-in-depth.
type: project
---

# Lane 4.117 — supabase-error-leak drift test scope extension

**Owner:** Claude (auditor + impl)
**Started:** 2026-04-29
**Closed:** 2026-04-29 — extension shipped, 2/2 green.
**Severity:** LOW (defense-in-depth; no current leak detected outside /api/, this guards future drift)
**Sibling:** Lane 4.116 (route-auth-coverage scope extension — identical pattern, identical fix), Lane 4.33 (original drift-test pattern)

## TL;DR

`tests/unit/supabase-error-leak.test.ts` flags routes that return raw Supabase `error.message` to clients (schema/RLS/RPC-arg leak). It walked `src/app/api/**/route.ts` only. **Same Lane 4.116-class gap:** non-/api route handlers (`src/app/mcp/route.ts`, `src/app/auth/callback/route.ts`, `src/app/llms*.txt/route.ts`) were outside the scan.

A drop-in `error.message` leak in any future non-/api route would silently bypass this test.

## Audit at write-time (Hard Rule #28 / Lane 4.116 process note)

Pre-extension live audit on the 4 non-/api routes:

| Path | `error.message` leak? | Notes |
|------|------------------------|-------|
| `src/app/mcp/route.ts` | NO | Uses `err.message` (catch-block GatewayError) — different identifier, intentionally whitelisted by the test regex |
| `src/app/auth/callback/route.ts` | NO | No `error.message` substring at all |
| `src/app/llms.txt/route.ts` | NO | Static text serve |
| `src/app/llms-full.txt/route.ts` | NO | Static text serve |

So this is a drift-prevention upgrade, not a fix to a live leak — same posture as Lane 4.116.

## File:line evidence

### Before

```ts
const API_ROOT = resolve(process.cwd(), "src", "app", "api");  // line 5
// ...
const files = walk(API_ROOT);                                   // line 23
```

### After

```ts
const APP_ROOT = resolve(process.cwd(), "src", "app");
// ...
const files = walk(APP_ROOT);
```

Smoke-test threshold (`expect(files.length).toBeGreaterThan(5)`) still holds — `src/app/**/route.ts` has 25 routes (per Lane 4.116), comfortably above 5.

## Why severity is LOW

All 4 non-/api routes are clean of the flagged pattern today. The test regex `/message:\s*error\.message/` is specifically tuned to flag the Supabase `error.message` shape (where `error` is the destructured `{ data, error } = await supabase.rpc(...)` pattern), not the generic `err.message` catch-block pattern that mcp uses safely.

So this lane:
- Adds no false positives (no current routes flagged)
- Locks in scope coverage for future non-/api routes
- Sibling-completes the Lane 4.116 effort (route-auth-coverage already broadened)

## Failure modes this guards against

1. **Future MCP error-handling change.** Someone replaces `err.message` with `error.message` (Supabase `{data, error}` destructure) in `mcp/route.ts` — would have silently leaked schema/RPC details to MCP clients.
2. **Future Supabase OAuth callback rewrite.** If `auth/callback/route.ts` adds direct Supabase RPC calls (instead of just `supabase.auth.exchangeCodeForSession`), the `error.message` leak class becomes possible.
3. **New top-level routes (Lane 9.2 OpenAPI / well-known endpoints).** Any future `src/app/<path>/route.ts` that touches Supabase RPC is now covered.

## Acceptance

- [x] Audit non-/api routes for current `error.message` leaks — 0 found
- [x] Extend `walk()` scan root from `src/app/api` → `src/app`
- [x] Update header comment + describe block to reference Lane 4.117
- [x] Confirm smoke-test threshold (`>5`) still passes (25 routes ≫ 5)
- [x] Run vitest — 2/2 green
- [ ] N/A — no Codex follow-up; test-only delta with no runtime change

## Process note — chain of scope-claim gaps

This is the THIRD scope-claim gap surfaced in 48 hours (sibling to Lane 4.116 + the original Lane 4.33 narrowing):

- **Lane 4.33** (2026-04-27): drift test scoped `src/app/api/` — narrow at write-time
- **Lane 4.116** (2026-04-29): route-auth-coverage extended → `src/app/**`
- **Lane 4.117** (2026-04-29, this lane): supabase-error-leak extended → `src/app/**`

**Pattern:** every drift test that walks the route tree needs `src/app/**` scope, not `src/app/api/**`. Worth a one-shot grep for any other `walk(...api...)` test still narrow-scoped:

```bash
grep -rn "src.*app.*api" tests/unit/ | grep -i "walk\|readdir\|path.join"
```

**Audit pattern lesson (extension of Lane 4.116):** when adding any new drift test that scans the route tree, default to `src/app/**` scope unless there's a deliberate reason to narrow. Sibling to Hard Rule #28 (depth audit after PROVEN) and Lane 4.116 process note (verify scope assumption at write-time).
