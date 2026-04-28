# Lane 4.33 — API route auth coverage audit

**Status:** CLEAN + drift test shipped
**Severity if broken:** P0 if hit (unauthenticated mutation route → fund drain, account takeover, IDOR at scale)
**Audited:** all 21 `src/app/api/**/route.ts` handlers

## Why this audit

Lane 4.28 covered admin endpoint auth (validateAdmin coverage). Lane 4.21 covered CSRF/method shape. Lane 4.30 covered IDOR on session-authed mutation routes. None of those individually proved that **every** route file has the auth class it should — a new route could land tomorrow with no auth check at all and slip past all three.

This lane locks the full set down: every route file gets an explicit classification in a static map, and the drift test asserts (a) every route on disk has a classification, (b) every classified route actually contains its class's auth marker, (c) public routes contain NO auth markers (defense against accidental partial removal).

## Audit method

Enumerated every `src/app/api/**/route.ts` file. For each, identified the auth function call site (validateRequest / getUserFromSession / validateAdmin / getKeyInfo / stripe.webhooks.constructEvent) and classified the route into one of seven classes:

| Class | Auth function | Use case |
|-------|---------------|----------|
| `public` | none | catalog reads, health, signup |
| `api_key` | `validateRequest()` | Bearer tr_live_/tr_test_ |
| `key_info` | `getKeyInfo()` | wraps validateRequest (key info endpoint) |
| `session` | `getUserFromSession()` | dashboard mutation routes |
| `admin` | `validateAdmin()` | admin-only |
| `dual` | both | endpoint accessible via api-key OR session |
| `stripe_webhook` | `stripe.webhooks.constructEvent()` | signature-verified webhook |

## Findings

### 21 routes, all classified, all auth checks present

| Route | Class | Why |
|-------|-------|-----|
| `/api/check` POST | public | Registry knowledge query |
| `/api/search` GET | public | Tool search |
| `/api/tools` GET | public | Tool list |
| `/api/v1/tools` GET | public | Catalog (with format=openai) |
| `/api/v1/health` GET | public | Health check |
| `/api/v1/signup` POST | public | Account creation (rate-limited + disposable-domain blocklist) |
| `/api/v1/execute` POST | api_key | Tool execution gateway |
| `/api/v1/key` GET | key_info | API key info via getKeyInfo |
| `/api/a2a` POST | api_key | A2A JSON-RPC gateway |
| `/api/v1/registry/usage` POST | api_key | Registry usage submit |
| `/api/v1/registry/request` POST | api_key | Registry tool request |
| `/api/v1/registry/challenge` POST | api_key | Registry champion challenge |
| `/api/v1/usage` GET | dual | Usage history — api-key OR session |
| `/api/v1/byok` POST/PATCH/DELETE | session | BYOK key registration |
| `/api/v1/checkout` POST | session | Stripe checkout creation |
| `/api/v1/billing/setup-payment` POST | session | Auto-top-up payment-method setup |
| `/api/v1/settings` GET/PATCH | session | User settings |
| `/api/v1/keys` POST/PATCH/DELETE/GET | session | API key CRUD |
| `/api/admin/providers` GET/POST | admin | Master pool provider keys |
| `/api/admin/stats` GET | admin | Admin stats |
| `/api/webhooks/stripe` POST | stripe_webhook | Stripe webhook |

### Notable: dual-auth pattern in `/api/v1/usage`

`src/app/api/v1/usage/route.ts:10-21` ships a clean dual resolver:
```ts
async function resolveUserId(request: NextRequest): Promise<string> {
  const authHeader = request.headers.get("authorization");
  const rawToken = authHeader?.slice(7) ?? "";
  if (rawToken.startsWith("tr_live_") || rawToken.startsWith("tr_test_")) {
    const ctx = await validateRequest(authHeader);
    return ctx.userId;
  }
  const { userId } = await getUserFromSession(authHeader);
  return userId;
}
```

The token-prefix dispatch is correct: `tr_live_`/`tr_test_` go through API-key validation, anything else (Supabase JWT) goes through session validation. Both paths return a server-trusted `userId` (no body-supplied user_id — IDOR-clean per Lane 4.30). Both paths are subject to the same `.eq("user_id", userId)` filter on the Supabase query. This is the right shape for an endpoint that legitimately serves both agents (API key) and the dashboard UI (session cookie).

## Drift-prevention test

`tests/unit/route-auth-coverage.test.ts` — 23 tests, all pass:

1. **Map completeness** — every `route.ts` file under `src/app/api/` is in `ROUTE_MAP`. New routes that land without classification fail this test with the file paths to add.
2. **Map currency** — every entry in `ROUTE_MAP` exists on disk. Catches stale entries from deleted/renamed routes.
3. **Per-route auth marker** (21 cases, one per route) — each route's source contains the regex marker for its declared class. For `public` routes, asserts that NO auth marker is present (negative assertion — defense against accidental partial removal that leaves a half-stripped check).

Failure modes:

```
src/app/api/v1/some-new-route/route.ts is classified public but contains
auth marker /\bvalidateRequest\s*\(/. Either remove the marker or reclassify.
```

```
1 route file(s) lack an auth classification:
  src/app/api/v1/new-feature/route.ts
Add each to ROUTE_MAP in this test file with one of: public | api_key |
session | admin | dual | stripe_webhook | key_info
```

The classification-map approach forces a reviewer to make the auth class an explicit, file-level decision visible in the PR diff. A new route can't land "by default with no auth" — the test fails until classification is added.

## What this test does NOT catch

- **Misuse of correct auth function** — e.g. a session-authed handler that ignores `userId` and reads `body.user_id`. Lane 4.30 IDOR drift test covers this.
- **Class-level mistake** — e.g. a route classified `session` that should have been `admin`. The classification is the human reviewer's call; the test only enforces consistency between declaration and code.
- **Method-level coverage** — a route file with both GET and POST where only one method has the auth check. Lane 4.21/4.22 per-handler block extraction covers this.

This test is the **outer perimeter**. Lanes 4.21/4.22/4.28/4.30 are the inner perimeter on individual handler bodies. Together they form a layered defense.

## Cross-applies

- **CallTwin** — same Next.js App Router shape. ~30 route files; lift this test pattern.
- **DropClose** — admin routes, webhook routes, session routes; same map pattern.
- **AffixedAI** — template framework, ~25 routes.
- **JarvisCRM** — auto-generated handlers (highest risk per memory rule #65); generators frequently produce 4-6 method exports per file. The classification map combined with per-handler block extraction (rule #65) covers this best.

## Sibling lanes

- 4.21 (CSRF — CLEAN) — covers method shape
- 4.22 (mass-assignment — CLEAN) — covers field-level drift on session writes
- 4.28 (admin endpoint auth — CLEAN) — covers `/api/admin/*` specifically
- 4.30 (IDOR — CLEAN) — covers ownership filters on session mutations
- 4.31 (SSRF — fixed) — covers user-URL fetch surface

Lane 4.33 sits on top: every route is in scope, classified, and verified.
