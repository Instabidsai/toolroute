---
name: Lane 4.118 — drift test scope batch (auth-rate-limit-shape + pagination-clamping → src/app/**)
description: Two more drift tests still scoped src/app/api/ — same Lane 4.116/4.117-class scope-claim gap. Audited at write-time, no current violations in non-/api routes. Extended scope. cache-control-private deliberately deferred — has a real gap on /mcp (Lane 4.119).
type: project
---

# Lane 4.118 — drift-test scope batch (auth-rate-limit + pagination-clamping)

**Owner:** Claude (auditor + impl)
**Started:** 2026-04-29
**Closed:** 2026-04-29 — both extensions shipped, 8/8 green.
**Severity:** LOW (defense-in-depth; no current violations, locks future drift)
**Sibling:** Lane 4.116 (route-auth-coverage scope), Lane 4.117 (supabase-error-leak scope), **Lane 4.119** (cache-control gap on /mcp — real fix needed, deliberately deferred)

## TL;DR

Two more drift tests had the same Lane 4.116-class scope-claim gap (walked `src/app/api/` only):

1. `tests/unit/auth-rate-limit-shape.test.ts` — line 14 + line 117-118 walked `src/app/api/v1` and `src/app/api`
2. `tests/unit/pagination-clamping.test.ts` — line 15 walked `src/app/api`

Both extended to `src/app/**`. Pre-extension audit confirmed zero current violations in non-/api routes (no `signInWithPassword|resetPasswordForEmail|signInWithOtp`, no `parseInt(searchParams.get(...))` outside /api).

8/8 tests green post-extension.

## Audit at write-time (Hard Rule #28 / Lane 4.116 process note)

### Test 1 — auth-rate-limit-shape (Lane 4.27 origin)

`grep -rn "signInWithPassword\|resetPasswordForEmail\|signInWithOtp" src/app/` — zero matches anywhere. Non-/api routes audited (clean):

| Path | Auth-mutation use? |
|------|--------------------|
| `src/app/mcp/route.ts` | No — uses `validateRequest` (Bearer tr_live_), no Supabase auth methods |
| `src/app/auth/callback/route.ts` | No — uses `exchangeCodeForSession` only (OAuth callback, not password/OTP entry point) |
| `src/app/llms.txt/route.ts` | No |
| `src/app/llms-full.txt/route.ts` | No |

### Test 2 — pagination-clamping (Lane 4.47 origin)

`grep -rn "parseInt.*searchParams.get" src/app/` — only 2 hits, both already in /api/:
- `src/app/api/admin/stats/route.ts:21` — `days` param (clamped + finite-guarded per Lane 4.47 fix)
- `src/app/api/v1/usage/route.ts:28,31` — `limit`, `offset` (clamped + finite-guarded per Lane 4.47 fix)

Non-/api routes do not paginate today.

## File:line evidence

### auth-rate-limit-shape.test.ts

**Before** (line 97 in the no-login-route test):
```ts
const allRoutes = listAllRoutes(API_V1_ROOT);  // only src/app/api/v1
```

**After**:
```ts
const allRoutes = listAllRoutes(join(process.cwd(), "src", "app"));
```

**Before** (line 117-118 in the no-signInWith* test):
```ts
it("no signInWithPassword/resetPasswordForEmail/signInWithOtp calls in src/app/api", () => {
  const allRoutes = listAllRoutes(join(process.cwd(), "src", "app", "api"));
```

**After**:
```ts
it("no signInWithPassword/resetPasswordForEmail/signInWithOtp calls in src/app/**", () => {
  const allRoutes = listAllRoutes(join(process.cwd(), "src", "app"));
```

### pagination-clamping.test.ts

**Before** (line 15 + line 48):
```ts
const API_ROOT = join(process.cwd(), "src", "app", "api");
// ...
for (const file of walk(API_ROOT)) {
```

**After**:
```ts
const APP_ROOT = join(process.cwd(), "src", "app");
// ...
for (const file of walk(APP_ROOT)) {
```

## Why severity is LOW

Same posture as Lane 4.116 + 4.117: no live leak, scope-extension locks future drift. A future PR adding a password-reset route under `src/app/auth/reset/route.ts` (instead of `/api/auth/reset/route.ts`) would now trip Lane 4.27's audit gate. Likewise pagination DoS via a future `src/app/discover/route.ts` etc.

## Lane 4.119 — deliberately deferred (real gap found)

`tests/unit/cache-control-private.test.ts:24` (Lane 4.48 origin) was the THIRD test in the original 4.118 batch plan. **Found a real gap during the write-time audit:**

- `src/app/mcp/route.ts` is auth-gated (`validateRequest` at line 139)
- Lane 4.48 says auth-gated routes MUST emit `Cache-Control: private, no-store`
- mcp/route.ts emits `MCP_CORS` only — no cache header at all (lines 31-35, 48, 64, 187, 191)
- `src/app/auth/callback/route.ts` reads `cookies()` via `createServerClient` — also flagged by the test's AUTH_HINTS
- Returns `NextResponse.redirect(...)` for OAuth flow — `?code=` URLs SHOULD NOT be cached

So extending cache-control-private's scope right now would turn it into a failing test. The right move is:

1. **Code fix** in `src/app/mcp/route.ts`: add `private, no-store` to MCP_CORS or define `MCP_AUTHED_HEADERS = { ...MCP_CORS, "Cache-Control": "private, no-store" }`
2. **Code fix** in `src/app/auth/callback/route.ts`: set cache header on the redirect responses
3. **Then** extend cache-control-private.test.ts scope

Splitting into Lane 4.119 because (1) requires runtime change vs this lane's test-only delta. Created task #138.

## Acceptance

- [x] Audit non-/api routes for current violations of each rule — 0 found in scope-extended pair
- [x] Extend `auth-rate-limit-shape.test.ts` to walk `src/app/**`
- [x] Extend `pagination-clamping.test.ts` to walk `src/app/**`
- [x] Run vitest — 8/8 green
- [x] Defer `cache-control-private.test.ts` to Lane 4.119 (real gap on /mcp)
- [ ] N/A — no Codex follow-up; test-only delta with no runtime change

## Process note — chain summary

Drift-test scope-claim gaps surfaced by Lane 4.116:

| Lane | Test | Status |
|------|------|--------|
| 4.116 | `route-auth-coverage.test.ts` | ✅ Extended (27/27) |
| 4.117 | `supabase-error-leak.test.ts` | ✅ Extended (2/2) |
| 4.118 | `auth-rate-limit-shape.test.ts` | ✅ Extended (6/6) |
| 4.118 | `pagination-clamping.test.ts` | ✅ Extended (2/2) |
| **4.119** | `cache-control-private.test.ts` | 🔴 Deferred — real gap on /mcp + /auth/callback |

After Lane 4.119, all drift tests scanning the route tree default to `src/app/**` scope. Reviewer rule going forward: any new drift test that walks the App Router defaults to `src/app/**`, narrows only with documented justification.
