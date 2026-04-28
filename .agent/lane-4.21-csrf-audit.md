# Lane 4.21 — CSRF Audit on Session-Authed Mutation Routes

**Date:** 2026-04-28
**Auditor:** Claude (APEX builder pattern)
**Scope:** every POST/PATCH/PUT/DELETE route under `src/app/api/` that authenticates a logged-in user (not API-key-authed runtime routes, not admin-secret routes)
**Severity:** CLEAN — CSRF structurally impossible
**Status:** drift-prevention vitest shipped this PR

---

## Why this matters

When a session-authed mutation route accepts auth via **HTTP cookie**, any cross-origin browser tab the user has open can fire a state-changing request against the API — the browser auto-sends cookies on top-level form posts, image GETs, and iframe submits. This is classic CSRF (Cross-Site Request Forgery).

For ToolRoute the relevant attack surface is: a logged-in dashboard user visits an attacker page → attacker POSTs to `/api/v1/keys` to provision a `tr_live_` key the attacker exfiltrates, or POSTs to `/api/v1/byok` to register the attacker's BYOK key under the victim's account, or POSTs to `/api/v1/checkout` to charge the victim. All financially serious.

Two CSRF defenses are common:
1. **CSRF token** — server-issued nonce included in every form, validated server-side
2. **SameSite cookie attribute** — modern default is `Lax` which blocks most CSRF
3. **Bearer token in Authorization header** — structurally CSRF-immune (browsers don't auto-send custom headers cross-origin)

ToolRoute uses #3.

---

## Audit findings

### Auth pattern: Authorization Bearer (Supabase JWT)
`src/lib/gateway.ts:462` `getUserFromSession(authHeader)` requires `authHeader.startsWith("Bearer ")`, slices the JWT, and validates via `sb.auth.getUser()`. The JWT lives in the SPA client (localStorage / in-memory) and is explicitly attached to each fetch — never read from cookies, never auto-attached by the browser.

### Routes audited (6 session-authed):
| Route | Methods | Auth source |
|-------|---------|-------------|
| `/api/v1/keys` | GET, POST, PATCH, DELETE | `request.headers.get("authorization")` |
| `/api/v1/byok` | GET, POST, DELETE | `request.headers.get("authorization")` |
| `/api/v1/checkout` | POST | `request.headers.get("authorization")` |
| `/api/v1/settings` | GET, PATCH | `request.headers.get("authorization")` |
| `/api/v1/billing/setup-payment` | POST | `request.headers.get("authorization")` |
| `/api/v1/usage` | GET | `request.headers.get("authorization")` |

### Cookie usage: zero
- `grep -rn 'cookies()\|cookieStore' src/app/api src/lib` → zero matches
- No `import { cookies } from "next/headers"` anywhere in `src/app/api` or `src/lib`
- No `middleware.ts` / `middleware.tsx` at root → no global auth-via-cookie path

### CORS interaction (cross-checked against Lane 4.19)
- `CORS_HEADERS` uses wildcard `Access-Control-Allow-Origin: *` AND does NOT set `Access-Control-Allow-Credentials: true`.
- Per CORS spec, credentialed cross-origin requests (which include the Authorization header) require `Allow-Credentials: true` AND a non-wildcard origin. ToolRoute has neither → browsers refuse to send the Authorization header on cross-origin XHR.
- Even if an attacker bypassed CORS preflight (e.g., a "simple request" with no custom headers), the request would arrive WITHOUT the Authorization header → `getUserFromSession` throws 401 → no state change.

### Why this is CSRF-immune (formal reasoning)
1. Every mutation route requires a valid `Authorization: Bearer <jwt>` header.
2. Browsers send `Authorization` headers ONLY when JS explicitly attaches them via `fetch({ headers: ... })` or `XMLHttpRequest.setRequestHeader`.
3. JS cannot make cross-origin requests with custom headers without a CORS preflight.
4. CORS preflight requires `Access-Control-Allow-Credentials: true` AND non-wildcard origin to allow the request — neither is set.
5. Therefore: no cross-origin browser context can authenticate to a ToolRoute mutation route. Same-origin only. → no CSRF.

---

## What is NOT in scope

- **API-key-authed runtime routes** (`/api/v1/execute`, `/mcp`, `/api/a2a`) — agents call these, not browsers. Auth is via `tr_live_*` / `tr_test_*` API key in `Authorization: Bearer` or `x-api-key` header. CSRF doesn't apply (no logged-in session, no cookies, attacker would need the API key itself = game over anyway).
- **`/api/admin/stats`** — auth is `x-admin-secret` custom header. Lane 4.19 audited as accidentally CSRF-safe (custom header not in any Allow-Headers list, browsers won't send).
- **Stripe webhook** (`/api/webhooks/stripe`) — public route, signature-verified, no user session.
- **The Supabase login flow itself** — handled by Supabase Auth, not in this codebase. Supabase has its own CSRF mitigations on the auth.users endpoints.

## Future hardening (not blocking)

If ToolRoute ever migrates to cookie-based session auth (e.g., for SSR-rendered authed pages), this audit is invalidated and a CSRF token system must be added. The drift-prevention vitest will catch the import of `cookies` in `/api` and fail master.

---

## Drift-prevention test

`tests/unit/csrf-bearer-only.test.ts` — regex-based snapshot drift test (no module imports). Asserts:
1. No file under `src/app/api/v1/` imports `cookies` from `next/headers`
2. No file under `src/app/api/v1/` reads `cookieStore` or calls `cookies()`
3. The 6 known session-authed routes still read auth via `request.headers.get("authorization")`
4. `getUserFromSession` in `src/lib/gateway.ts` still requires `Bearer ` prefix

Per Hard Rule #59 — failing-snapshot test as drift TODO list. Test fails master if anyone introduces cookie auth → forcing the migration to also add CSRF tokens.

---

## Cross-applies

Same audit pattern (cookie-vs-bearer for session-authed routes) applies to:
- **CallTwin** — Vapi/Twilio webhooks + dashboard
- **DropClose** — agent dashboard
- **AffixedAI** — consultant dashboard
- **JarvisCRM** — multi-tenant dashboard

For each: grep `cookies(\)` in `src/app/api`. If zero matches AND auth uses `Authorization: Bearer`, CSRF is structurally impossible. If matches, audit each call site for CSRF token validation.
