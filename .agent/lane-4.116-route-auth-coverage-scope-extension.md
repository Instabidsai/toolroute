---
name: Lane 4.116 — route auth coverage scope extension (src/app/api/** → src/app/**)
description: Lane 4.33's drift test only walked src/app/api/, missing 4 auth-bearing routes outside /api (mcp, auth/callback, llms.txt, llms-full.txt). Extended scope so future non-/api route.ts files are auto-flagged.
type: project
---

# Lane 4.116 — route auth coverage scope extension

**Owner:** Claude (auditor + impl)
**Started:** 2026-04-29
**Closed:** 2026-04-29 — test extension shipped, 27/27 green.
**Severity:** LOW (defense-in-depth; existing routes are correctly auth'd, this guards against the next one slipping in outside `/api/`)
**Sibling:** Lane 4.33 (original test), Lane 4.28 (admin coverage), Lane 4.66 (auth/callback hardening), Lane 4.101 (mcp BYOK gap audit)

## TL;DR

`tests/unit/route-auth-coverage.test.ts` (Lane 4.33 drift guard) walks `src/app/api/**/route.ts` and asserts every route file has an explicit auth classification in `ROUTE_MAP`. **It missed 4 route files that live OUTSIDE `/api/`:**

- `src/app/mcp/route.ts` — MCP Streamable HTTP gateway, **requires Bearer tr_live_** (validateRequest at line 139)
- `src/app/auth/callback/route.ts` — Supabase OAuth callback, public-input but session-establishing
- `src/app/llms.txt/route.ts` — public AI-agent discovery file
- `src/app/llms-full.txt/route.ts` — public AI-agent discovery file

Next.js App Router accepts `route.ts` anywhere under `src/app/`, not just under `/api/`. The test's narrow scope meant any future auth-bearing route added under `src/app/<thing>/route.ts` would silently bypass classification — sibling pattern to Hard Rule #59 (failing-snapshot test as drift TODO list) and the "claimed-complete-but-incomplete" pattern documented in Lane 4.108's process note.

## File:line evidence

### Test scope before this lane (Lane 4.33 walkRoutes, line 158)

```ts
const apiRoot = path.join(process.cwd(), "src", "app", "api");
```

### Real route surface (`find src/app -name route.ts | sort`)

25 route files total. Of those, 21 lived under `/api/` and were classified. The 4 outside:

| Path | Auth class | Justification |
|------|------------|---------------|
| `src/app/mcp/route.ts` | `api_key` | Line 122-130: explicit `Bearer tr_live_` check + `validateRequest()` at line 139 |
| `src/app/auth/callback/route.ts` | `public` | OAuth callback, no validateRequest/getUserFromSession/etc. — session is OUTPUT not INPUT. Input gate is Supabase `?code=` param verified via `createServerClient`. |
| `src/app/llms.txt/route.ts` | `public` | Static text serve. No auth markers. |
| `src/app/llms-full.txt/route.ts` | `public` | Same as above. |

## Fix shipped (this commit)

`tests/unit/route-auth-coverage.test.ts`:

1. `walkRoutes()` scan root: `src/app/api` → `src/app` (line 159, with explanatory comment).
2. Added the 4 missing routes to `ROUTE_MAP` with classifications + rationales.
3. Updated header comment + describe block to reference Lane 4.116 + the broadened scope.

Test count: 21 + 2 sanity → 25 + 2 sanity = **27 tests, all passing**.

## Why severity is LOW

All 4 missed routes are correctly auth'd today:

- `mcp` already gates on `Bearer tr_live_` — Lane 4.101 audited this BYOK class for `/mcp` + `/api/a2a` and found the gate is correct (modulo the auto/route bypass class documented in Lane 4.113, which is upstream of `validateRequest` not downstream of it).
- `auth/callback` was hardened in Lane 4.66 (gateway_users error capture).
- `llms*.txt` is intentional public surface (audited in Lane 4.109).

So this is a **drift-prevention upgrade**, not a fix to a live leak. The existing routes were already in the right state; the test now ENFORCES that any new route added outside `/api/` must be classified.

## Failure modes this guards against

1. **Next.js convention drift.** Future PR adds `src/app/admin/route.ts` (a top-level admin endpoint outside /api) without auth — Lane 4.33 wouldn't have flagged. Now does.
2. **Migration accidents.** Someone moves `/api/v1/health` to `/health` for SEO and forgets the auth re-classification — caught.
3. **AI-discovery surface drift.** Adding `src/app/.well-known/ai-plugin.json/route.ts` or `src/app/openapi.json/route.ts` (Lane 9.2 in the build queue) — caught.

## Acceptance

- [x] Enumerate ALL route.ts files under src/app — 25 found
- [x] Cross-reference against existing ROUTE_MAP — 21 classified, 4 missing
- [x] Add the 4 missing routes with correct classification + rationale
- [x] Extend walkRoutes() to scan src/app instead of src/app/api
- [x] Update test header + describe block to reference Lane 4.116
- [x] Run vitest — 27/27 green (was 21 routes + 2 sanity = 23 before; 25 routes + 2 sanity = 27 after)
- [ ] N/A — no Codex follow-up needed; this is a test-only delta with no runtime change

## Process note

Lane 4.33 was committed 2026-04-27 with `apiRoot = path.join(process.cwd(), "src", "app", "api")`. The implicit assumption was "all API routes live under /api/" — true at the time, but `src/app/mcp/route.ts` was already there. So the gap was real-on-day-one, not a drift over time. **Audit pattern lesson:** when a drift test scopes to a subdirectory, verify the assumption (no auth-bearing routes outside the scope) holds at write-time, not just "going forward". Sibling to Hard Rule #28 (depth audit after PROVEN) — should also apply to scope-claim tests.
