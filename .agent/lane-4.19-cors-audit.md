# Lane 4.19 — CORS configuration audit + drift-prevention test

**Status:** CLEAN — no exposure
**Date:** 2026-04-28
**Auditor:** Claude (auto-loop, tick 55)
**Sibling lanes:** 4.10 (COGS), 4.11 (validateAdmin), 4.14 (RPC EXECUTE), 4.18 (redactCreds)

## TL;DR

All three CORS configurations across the app — `CORS_HEADERS` (api/v1/*
+ admin), `MCP_CORS` (/mcp), `A2A_CORS` (/api/a2a) — use the conventional
"open API" shape:

- `Access-Control-Allow-Origin: *`
- NO `Access-Control-Allow-Credentials: true`
- NO origin reflection from `request.headers.get("origin")`

This is **CSRF-safe by browser policy.** The `*` origin disables
credential-bearing cross-origin requests at the browser layer, and the
absence of `Allow-Credentials` means session cookies (if any existed)
would not be auto-included. There is no origin-reflection bug.

A snapshot vitest at `tests/unit/cors-config-drift.test.ts` (8 tests, 189ms)
locks the configs against future drift.

## Configuration inventory

| Config | File | Origin | Credentials | Methods | Headers |
|--------|------|--------|-------------|---------|---------|
| `CORS_HEADERS` | `src/lib/gateway.ts:515-520` | `*` | none | `GET,POST,DELETE,OPTIONS` | `Content-Type, Authorization` |
| `MCP_CORS` | `src/app/mcp/route.ts:19-23` | `*` | none | `POST, OPTIONS` | `Content-Type, Authorization, Mcp-Session-Id` |
| `A2A_CORS` | `src/app/api/a2a/route.ts:45-49` | `*` | none | `POST, OPTIONS` | `Content-Type, Authorization` |

Routes consuming `CORS_HEADERS`:

- `/api/v1/checkout` (POST) — Stripe checkout session creation
- `/api/v1/byok` (GET/POST/DELETE) — BYOK key CRUD
- `/api/v1/keys` (GET/POST/DELETE) — API key CRUD
- `/api/v1/billing/setup-payment` (POST) — Stripe SetupIntent
- `/api/v1/signup` (POST) — user registration
- `/api/v1/settings` (PATCH) — auto-top-up settings
- `/api/v1/usage` (GET) — usage history
- `/api/v1/key` (GET) — key info + balance
- `/api/admin/stats` (GET) — platform metrics
- `/api/admin/providers` (GET/POST) — provider master pool config

## CSRF analysis

### Why `*` is safe here

`Access-Control-Allow-Origin: *` is the standard "public API" CORS
configuration. Browsers explicitly forbid `*` + `Allow-Credentials: true`
combined — and we don't set `Allow-Credentials` at all. Therefore:

1. **Cross-origin fetches with cookies:** browser does not include cookies
   regardless of origin (no Allow-Credentials).
2. **Cross-origin fetches with `Authorization: Bearer ...`:** browser does
   not auto-include any header named `Authorization` cross-origin. The
   attacker would need to know the bearer token, in which case they can
   call the API directly server-to-server — no CSRF gain.
3. **Cross-origin preflight on custom headers:** browser sends OPTIONS,
   server responds with `Allow-Headers: Content-Type, Authorization`.
   Any header not in that allowlist is rejected by the browser (see
   admin protection below).

### Admin route accidental protection

Admin routes auth via the `x-admin-secret` custom header (validated with
`timingSafeEqual` in `src/lib/gateway.ts` and at the route level). Because
`x-admin-secret` is **not** in any `Access-Control-Allow-Headers` list,
browsers preflight-fail any cross-origin attempt to send it. This is
accidental but correct CSRF protection for the admin surface.

The drift test at line 65 of `cors-config-drift.test.ts` enforces that
`x-admin-secret` stays out of `Allow-Headers`:

```ts
expect(corsBlock).not.toMatch(/x-admin-secret/i);
```

If a future PR adds it to the allowlist (perhaps to allow a cross-origin
admin tool), the drift test fails — forcing the author to either revert,
or pair the change with an explicit origin allowlist (replacing `*` with
the legitimate admin tool origin).

### Origin reflection class

A common CORS misconfiguration is reading the request's `Origin` header
and echoing it back into `Access-Control-Allow-Origin` — this combined
with `Allow-Credentials: true` is a CSRF catastrophe, and even without
credentials it simplifies attacks against any leaked bearer token from a
victim subdomain.

Audited 8 route files for `request.headers.get("origin")`:

```bash
grep -rE 'headers\.get\(\s*['"][oO]rigin['"]' src/
# zero matches
```

Drift test enforces this class never gets introduced.

## Recommendations (NOT shipped this PR)

| Recommendation | Rationale | Effort | Trade-off |
|----------------|-----------|--------|-----------|
| Tighten `*` to `https://toolroute.ai` + `https://www.toolroute.ai` for admin routes | Defense-in-depth — even if `x-admin-secret` ends up in Allow-Headers later, the origin gate would still hold | 1 hour | Cross-origin admin tooling stops working |
| Tighten `*` for /api/v1/byok and /api/v1/keys | Reduces blast radius of any future bearer-token leak from victim subdomain | 1 hour | Breaks legitimate cross-origin client SDKs |
| Keep `*` for /api/v1/execute, /mcp, /api/a2a | These are the public agent-API endpoints; gateway pattern requires `*` | — | — |
| Add `Vary: Origin` header when origin allowlist is later introduced | Prevents CDN cache from serving wrong CORS response to wrong origin | 1 hour | Required when moving off `*` |

Recommended: tighten on Lane 4.20 only after marketing-side product positioning is finalized (do customers integrate from custom origins? if yes, allowlist needs feature-flagged toggle).

## Drift-prevention test (8/8 passing)

- `gateway CORS_HEADERS uses wildcard origin`
- `gateway CORS_HEADERS does NOT include Allow-Credentials`
- `gateway CORS_HEADERS Allow-Headers does NOT include x-admin-secret`
- `MCP_CORS uses wildcard origin`
- `MCP_CORS does NOT include Allow-Credentials`
- `A2A_CORS uses wildcard origin`
- `A2A_CORS does NOT include Allow-Credentials`
- `no route reads Origin header to echo back into CORS response`

```
Test Files  1 passed (1)
Tests       8 passed (8)
Duration    189ms
```

## Generalizable lesson

**`Access-Control-Allow-Origin: *` is safe IF AND ONLY IF
`Access-Control-Allow-Credentials` is absent AND no origin reflection
happens.** This three-way invariant is what makes "open API" CORS
configurations safe from CSRF. Any change to one of the three must
re-evaluate the other two.

The audit pattern for any aggregator/API-gateway product:

1. Grep for every distinct CORS object literal:
   `grep -rE '"Access-Control-Allow-Origin"' src/`
2. For each, verify NO `Allow-Credentials` is paired with it.
3. Grep for `headers.get("origin")` — any match is a CORS reflection
   site, must be reviewed against credential model.
4. Lock the verified shape with a snapshot test reading source files
   (NOT importing modules; CORS configs often live in route files that
   transitively pull in DB clients, which crash without prod env).

Cross-applies to JarvisCRM, DropClose, GTM-Hub, AffixedAI, CallTwin —
every aggregator with a public API surface.

## Sibling rules

- Hard Rule #59 — failing-snapshot test = drift TODO list (this test is
  the always-passing "stay green" form; same shape as Lane 4.15)
- Lane 4.11 — validateAdmin single source of truth
- Lane 4.14 — RPC EXECUTE lockdown (function-level CSRF gate at the SQL layer)
- Lane 4.15 — RPC EXECUTE drift test (same drift-prevention pattern)
