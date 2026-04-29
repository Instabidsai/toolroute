---
name: Lane 4.119 — Cache-Control private,no-store gap on /mcp + /auth/callback
description: Lane 4.48 missed /mcp (auth-gated, MCP_CORS only) and /auth/callback (OAuth redirects). Found during Lane 4.118 write-time scope-extension audit. Fixed both routes; extended cache-control-private drift test scope to src/app/**.
type: project
---

# Lane 4.119 — /mcp + /auth/callback Cache-Control gap fix

**Owner:** Claude (auditor + impl)
**Started:** 2026-04-29
**Closed:** 2026-04-29 — fixes shipped; cache-control-private now scopes src/app/**, all tests green.
**Severity:** MEDIUM (real Lane 4.48-class gap; defense-in-depth header missing on auth-gated routes)
**Sibling:** Lane 4.48 (origin), Lane 4.116/4.117/4.118 (drift-test scope extensions)

## TL;DR

Lane 4.118's write-time audit (per Lane 4.116 process note) found that `tests/unit/cache-control-private.test.ts` had the same Lane 4.116-class scope-claim gap (walked `src/app/api/` only) AND broadening it would FAIL — `src/app/mcp/route.ts` and `src/app/auth/callback/route.ts` are auth-gated but emit no `Cache-Control: private, no-store`.

This is a real Lane 4.48 gap, not a test-only delta:

- **`/mcp`** — `validateRequest()` at line 139 (Bearer tr_live_), but JSON-RPC responses use `MCP_CORS` only (no cache header). Lane 4.48 audit walked `/api/` only and missed `/mcp` entirely.
- **`/auth/callback`** — uses `cookies()` via `createServerClient`, returns 5 redirect responses. None had `private, no-store`. OAuth `?code=` is single-use; downstream-proxy caching could replay another user's session bootstrap.

Fixed both routes, then broadened the drift test scope.

## File:line evidence

### Before — `/mcp/route.ts`

```ts
const MCP_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id",
};
// ...
return NextResponse.json(response, { headers: MCP_CORS });   // line 187 — auth-gated payload, NO cache header
```

### After

```ts
const MCP_AUTHED_HEADERS = {
  ...MCP_CORS,
  "Cache-Control": "private, no-store",
};
// ...
return NextResponse.json(response, { headers: MCP_AUTHED_HEADERS });  // line 187
```

Three responses in `/mcp` swapped to `MCP_AUTHED_HEADERS` (body-limit error at line 48, JSON parse error at line 64, success at line 187). OPTIONS preflight at line 191 keeps `MCP_CORS`-only — preflight has no body and CDN preflight caching is per-spec, no payload to leak.

### Before — `/auth/callback/route.ts`

```ts
return NextResponse.redirect(
  new URL("/login?error=missing_auth_code", requestUrl.origin)
);
// ... 5 NextResponse.redirect() call sites total, none with cache-control
```

### After

```ts
function withNoStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
// ...
return withNoStore(
  NextResponse.redirect(new URL("/login?error=missing_auth_code", requestUrl.origin))
);
// ... all 5 redirect call sites wrapped
```

5 redirect responses wrapped via `withNoStore()` helper (lines 23-27, 30-32, 52-56, 87-91, 106-110).

### Drift test extension — `tests/unit/cache-control-private.test.ts`

```ts
// Before
const API_ROOT = join(process.cwd(), "src", "app", "api");
// ...
for (const file of walk(API_ROOT)) {

// After
const APP_ROOT = join(process.cwd(), "src", "app");
// ...
for (const file of walk(APP_ROOT)) {
```

Plus added two new REQUIRED_HEADERS regex patterns to detect the `Headers.set("Cache-Control", "...")` form (used by auth/callback) in addition to the existing object-literal form (used by mcp). The describe label updated to `"Cache-Control private,no-store on authed routes (Lane 4.48 + 4.119 — src/app/**)"`.

## Why severity is MEDIUM (not LOW)

Distinct from Lane 4.116/4.117/4.118 which were pure test-scope extensions:

- This was a real Lane 4.48-class miss. Auth-gated `/mcp` JSON-RPC responses were cacheable by any downstream proxy.
- ToolRoute is fronted by Vercel today; Vercel Edge does not cache POST responses by default. So **no live exposure today**.
- BUT: if any future downstream proxy (Cloudflare in front of Vercel, corporate proxy, ISP transparent cache) is added, missing `private, no-store` becomes a cross-user data leak surface (user A's `tools/call` JSON-RPC payload served to user B keyed by URL alone — same URL for every MCP user).

Same risk class Lane 4.48 mitigated for `/api/v1/*` routes 1 month ago. Closing the gap brings `/mcp` to parity.

## Test status

- `cache-control-private.test.ts` — 1/1 green post-extension
- 3 pre-existing failures elsewhere (`marketing-snippet-drift.test.ts`, `page-snippet-slug-validation.test.ts`) — unrelated, queued under Codex tickets #20/#22 (Lane 6.4.2/6.4.3 swap PRs not yet shipped)
- Verified failures are pre-existing by stashing my changes and re-running master — same 3 failures.

## Acceptance

- [x] Add `MCP_AUTHED_HEADERS = { ...MCP_CORS, Cache-Control: "private, no-store" }`
- [x] Swap mcp JSON responses (3 sites) to MCP_AUTHED_HEADERS; keep OPTIONS preflight on MCP_CORS
- [x] Add `withNoStore()` helper in auth/callback; wrap all 5 redirect responses
- [x] Extend `cache-control-private.test.ts` walk root to src/app/**
- [x] Add Headers.set(...) regex patterns to REQUIRED_HEADERS (object-literal didn't cover auth/callback's idiom)
- [x] Run vitest — relevant test green; full suite shows 3 pre-existing unrelated failures
- [x] Audit memo + commit

## Process note — write-time audit pays off again

Lane 4.118 plan was "extend 3 drift tests scope". Audit at write-time (per Lane 4.116 process note) caught that one of the three would fail because of an actual product gap. Without that audit step, broadening the scope and shipping would have either:
1. Caused a CI regression (failing test on master), or
2. Been deferred-or-ignored, leaving the gap forever.

**Lesson reinforced:** every drift-test scope extension MUST audit at write-time. If the audit finds violations, surface them as their own lane (don't bury the finding inside a "scope extension" commit).

This is the second time the Lane 4.116-class audit pattern has paid off (first was Lane 4.116 itself catching that 4 routes outside `/api/` had never been classified).

## Drift-test scope normalization complete

| Lane | Test | Status |
|------|------|--------|
| 4.116 | `route-auth-coverage.test.ts` | ✅ src/app/** |
| 4.117 | `supabase-error-leak.test.ts` | ✅ src/app/** |
| 4.118 | `auth-rate-limit-shape.test.ts` | ✅ src/app/** |
| 4.118 | `pagination-clamping.test.ts` | ✅ src/app/** |
| **4.119** | `cache-control-private.test.ts` | ✅ src/app/** + product fix |

All drift tests scanning the App Router route tree now default to `src/app/**`. Reviewer rule going forward (per Lane 4.118 process note): any new drift test that walks the App Router defaults to `src/app/**`, narrows only with documented justification.
