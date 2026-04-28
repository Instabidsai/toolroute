# Lane 4.37 — Request Body Size + Shape DoS Audit + Helper

**Severity:** P2 (cost amplification, not service downtime)
**Status:** Helper shipped + 3 high-risk routes patched + drift test
**Audit date:** 2026-04-28

## The gap

17 body-parsing call sites across `src/app/api/`. **Zero** of them
declared an app-level body-size limit prior to this PR. Vercel platform
caps requests at 4.5MB but that's an order of magnitude above what any
route actually needs, and a stolen API key could spam huge payloads
through `/execute`, `/mcp`, `/a2a` to:

1. Burn customer credits (adapter forwards user input to expensive
   downstream APIs like OpenAI Chat / Anthropic / Vapi).
2. Tie up serverless function execution time.
3. Spike memory during `JSON.parse` of deeply-nested payloads.

## Threat model

| Vector | Pre-this-PR | Post-this-PR |
|--------|-------------|--------------|
| Stolen `tr_live_` key spamming /execute with 4MB inputs | Up to 4.5MB per call → burns credits at adapter forwarding cost | 256KB cap → 18× smaller per-call ceiling |
| Public /mcp endpoint receiving giant JSON-RPC bodies | 4.5MB cap | 256KB cap |
| /a2a JSON-RPC same | 4.5MB cap | 256KB cap |

This is **cost amplification**, not full DoS. Vercel auto-scales and
rate limits at the platform layer. But during a window where an
attacker has a valid (stolen) API key, every additional MB they push
through `/execute` is real money.

## Method

1. Static — grep `await request\.(json|text|formData)\(` across
   `src/app/api/` + `src/app/mcp/`. **17 call sites** found.
2. Per-route exposure assessment based on:
   - Does the body reach a paid downstream API? (high-risk)
   - Does the body hit a session-only path? (lower-risk)
   - Is the body Stripe-signed? (very-low-risk — adversary can't craft)
3. Ship `src/lib/body-limit.ts` helper + apply to top-3 high-risk routes.
4. Drift test enforces the 3 patched routes call the helper before
   `request.json()` and the helper map has the right keys.

## Per-route limit table

| Route | Limit | Why | Applied this PR? |
|-------|-------|-----|-------------------|
| `POST /api/v1/execute` | 256 KB | Tool input forwarded to paid downstream | ✅ yes |
| `POST /mcp` | 256 KB | Public JSON-RPC, same downstream forwarding | ✅ yes |
| `POST /api/a2a` | 256 KB | Same | ✅ yes |
| `POST /api/v1/byok` | 16 KB | tool_slug + api_key only | follow-up PR |
| `POST,PATCH /api/v1/keys` | 4 KB | Key name + label | follow-up PR |
| `POST /api/v1/signup` | 8 KB | Email + password + invite | follow-up PR |
| `POST /api/v1/checkout` | 4 KB | Plan slug | follow-up PR |
| `PATCH /api/v1/settings` | 4 KB | Auto-topup config | follow-up PR |
| `POST /api/admin/providers` | 16 KB | Provider config row | follow-up PR |
| `POST /api/v1/registry/*` | 8 KB | Usage event / tool request | follow-up PR |
| `POST /api/check` | 4 KB | API key validation probe | follow-up PR |
| `POST /api/webhooks/stripe` | 64 KB | Stripe-signed payload — adversary can't craft, but defense in depth | follow-up PR |

## What ships in this PR

### `src/lib/body-limit.ts`
- `BODY_LIMITS` const with 12 keys + bytes per route class.
- `assertBodyUnder(request, maxBytes)` checks `Content-Length` header.
  Throws `GatewayError(..., 413, "body_too_large")` when over limit.
  Permissive when header is absent (Vercel 4.5MB cap still applies).

### Patched routes (3)
- `src/app/api/v1/execute/route.ts` — guard before `validateRequest`.
- `src/app/mcp/route.ts` — guard inside POST, returns JSON-RPC error
  on 413.
- `src/app/api/a2a/route.ts` — same shape.

### Drift test `tests/unit/body-size-guard.test.ts`
7 tests:
1. Helper file exports `assertBodyUnder` + `BODY_LIMITS`.
2. `BODY_LIMITS` has the 3 required keys.
3-5. Each high-risk route file calls `assertBodyUnder(request, BODY_LIMITS.<key>)` BEFORE `request.json()` (regex order check).
6. Functional: 413 GatewayError thrown when Content-Length > limit.
7. Functional: permissive when Content-Length header missing.

7/7 pass.

## Follow-up PRs

Add `assertBodyUnder` to remaining 9 routes per the limit table. Each
one is ~3 lines, low risk. Drift test grows the `REQUIRED_GUARD_ROUTES`
array as routes are patched.

## Cross-references

- Hard Rule #59 — drift test scans source via regex (no runtime imports
  for the static-shape checks; functional tests use dynamic import only
  on the helper module which has zero dependencies on prod env).
- Lane 4.21 — CSRF audit (sibling concern: malicious request shape).
- Lane 4.27 — signup rate-limiting (sibling: cost amplification).
- Lane 4.31 — SSRF audit (sibling: stolen key abuse vector).
