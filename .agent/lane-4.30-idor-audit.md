# Lane 4.30 — IDOR audit on session-authed mutation routes

**Status:** CLEAN
**Severity if exploited:** P0 (revoke/rename other users' API keys, hijack BYOK keys, alter another account's billing settings)
**Audited routes (5):**
- `PATCH /api/v1/settings` (gateway_users updates)
- `POST/GET/DELETE/PATCH /api/v1/keys` (api_keys CRUD)
- `POST/GET/DELETE /api/v1/byok` (user_provider_keys CRUD)
- `POST /api/v1/checkout` (Stripe checkout — creates session for current user)
- `POST /api/v1/billing/setup-payment` (Stripe SetupIntent — creates intent for current user)

**Sibling lanes:** 4.21 (CSRF, CLEAN), 4.22 (mass-assignment, CLEAN). 4.30 closes the third leg of the auth-state-tampering triad.

## Why this audit

Insecure Direct Object Reference (IDOR) is the class where a session-authed mutation handler accepts a resource ID from the request (body / query / path) and acts on it WITHOUT verifying the current session owns that resource. Distinct from CSRF (4.21 — defends auth-state forgery) and mass-assignment (4.22 — defends column overwrite). IDOR defends row ownership.

Concrete attack examples for ToolRoute:
- User A logged in, calls `DELETE /api/v1/keys` with `key_id: <user_B's_key_id>` → user B's key revoked
- User A calls `PATCH /api/v1/keys` with `key_id: <user_B's_key_id>, name: "compromised"` → user B's key renamed
- User A calls `DELETE /api/v1/byok` with `tool_slug: openai` → if filter omits user_id, deletes EVERY user's openai BYOK row
- User A's session updates `gateway_users` filtered by `body.user_id` instead of session userId → mints credits/changes plan on user B

## Findings

| Route | Handler | userId source | Ownership filter on UPDATE/DELETE | Status |
|-------|---------|---------------|----------------------------------|--------|
| `/api/v1/settings` | PATCH | `getUserFromSession()` L74 | `.eq("id", userId)` L186 | ✅ |
| `/api/v1/keys` | POST | `getUserFromSession()` L14 | `user_id: userId` insert L54 | ✅ |
| `/api/v1/keys` | GET | `getUserFromSession()` L105 | `.eq("user_id", userId)` L114 | ✅ |
| `/api/v1/keys` | DELETE | `getUserFromSession()` L144 | SELECT L168-169 + UPDATE L182-183 both filter `id` AND `user_id` | ✅ |
| `/api/v1/keys` | PATCH | `getUserFromSession()` L215 | SELECT L256-257 + UPDATE L270-271 both filter `id` AND `user_id` | ✅ |
| `/api/v1/byok` | POST | `getUserFromSession()` L8 | `user_id: userId` upsert L26 + onConflict `user_id,tool_slug` L33 | ✅ |
| `/api/v1/byok` | GET | `getUserFromSession()` L68 | `.eq("user_id", userId)` L75 | ✅ |
| `/api/v1/byok` | DELETE | `getUserFromSession()` L103 | `.eq("user_id", userId)` L120 + `.eq("tool_slug", ...)` L121 | ✅ |
| `/api/v1/checkout` | POST | `getUserFromSession()` L34 | inserts `user_id: userId` L67/L95, no other-user mutation surface | ✅ |
| `/api/v1/billing/setup-payment` | POST | `getUserFromSession()` L11 | `.eq("id", userId)` L25/L52, `user_id: userId` insert L40/L62/L67 | ✅ |

**Aggregate findings:**
- F-1: ALL 10 mutation handlers derive `userId` from `getUserFromSession(authHeader)` — single source of truth in `src/lib/gateway.ts:462`.
- F-2: ZERO routes read `user_id` from request body (grep `body\.user_id|body\["user_id"\]` returns no matches across `src/app/api/v1/`). Sibling-lane 4.22 ALLOWED_FIELDS whitelists exclude `user_id` by omission; this audit confirms no bypass route exists.
- F-3: Every UPDATE/DELETE filtering on a non-key column (id/key_id/tool_slug) ALSO filters by `user_id = session.userId`. Resource-ID + ownership filter = IDOR-safe pattern.
- F-4: 404 responses on `not found OR not owned` (e.g., keys DELETE L172-176) — no enumeration leak distinguishing "no such id" from "id exists, not yours."

## getUserFromSession source-of-truth

```ts
// src/lib/gateway.ts:462
export async function getUserFromSession(
  authHeader: string | null
): Promise<{ userId: string; email: string }> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new GatewayError("Missing or invalid Authorization header", 401, "auth_required");
  }
  const token = authHeader.slice(7);
  const sb = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: "Bearer " + token } },
  });
  // ... auth.getUser(), throws on invalid token
  // returns { userId: user.id, email: user.email }
}
```
The session JWT is the ONLY source of `userId`. The token is signed by Supabase Auth, anon key is used to verify (not bypass). No code path exists where `userId` is taken from a non-auth source.

## What would have failed this audit

```ts
// Hypothetical IDOR-vulnerable handler:
const { user_id, key_id } = await request.json();    // ← reads user_id from body
const { error } = await sb
  .from("api_keys")
  .update({ is_active: false })
  .eq("id", key_id);                                  // ← filters only by key_id, no ownership check
```

Or:
```ts
// Hypothetical "trusts query param" handler:
const userId = request.nextUrl.searchParams.get("user_id");  // ← user-controlled
.eq("user_id", userId)
```

Neither pattern appears anywhere in `src/app/api/v1/`.

## Drift test

`tests/unit/idor-shape.test.ts` regex-asserts shape (no module imports per Hard Rule #59):
1. **No route reads `user_id` from `body.*`** — grep all `route.ts` files under `src/app/api/v1/` for `body\.user_id|body\["user_id"\]|body\['user_id'\]`. Must return 0 matches.
2. **No route trusts `user_id` from query params** — grep for `searchParams\.get\(["']user_id["']\)` returning a value used in `.eq("user_id", ...)`. Must be 0.
3. **Every DELETE/PATCH that has a body-supplied resource id MUST also filter by `user_id`** — for each route, find `.eq("id"|"key_id"|"tool_slug", ...)` patterns and confirm a sibling `.eq("user_id", ...)` exists in the same handler block (per-handler block extraction per memory rule #65).
4. **getUserFromSession is the only user-id source in mutation routes** — every `PATCH|POST|DELETE` exported handler in `src/app/api/v1/` (excluding `signup`, `tools`, `health`, `execute` which are public/key-authed not session-authed) must contain an `await getUserFromSession(` call.

## Cross-applies

- **CallTwin** session-authed routes — same audit pattern (the userId-from-session + ownership-filter rule)
- **DropClose** session-authed routes
- **AffixedAI** session-authed routes
- **JarvisCRM** auto-generated handlers — highest IDOR risk (generators frequently emit `body.user_id` reads)
- **VibeArmor** scan-management endpoints

## Recommendations (none blocking)

- **R-1 (P3, optional):** Document the `getUserFromSession + ownership filter` pattern in `.agent/conventions.md` as the canonical session-authed mutation shape. Currently implicit across all 10 handlers; making it explicit anchors future PRs.
- **R-2 (P3, optional):** Add a per-route comment header noting the audit lanes that gate each handler (4.21 CSRF, 4.22 mass-assignment, 4.30 IDOR). Lowers cognitive load when porting patterns to new endpoints.

Neither blocks Lane 4 closure.
