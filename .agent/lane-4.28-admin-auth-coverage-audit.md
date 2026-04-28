# Lane 4.28 — Admin Endpoint Authorization Coverage Audit

**Status:** CLEAN. Both admin routes gate every non-OPTIONS handler behind `validateAdmin(request)` + constant-time secret comparison. Drift test pins coverage so any new admin route or unauthed handler fails master.
**Severity:** P0 if violated (admin endpoints expose master provider keys, platform-wide revenue/COGS, top-user spend).
**Date:** 2026-04-28
**Sibling lane:** 4.11 (validateAdmin extraction, PR #33 still open).

## Why this audit class

Admin endpoints have three properties that make missing auth catastrophic:

1. **Service-role context** — `supabaseAdmin()` bypasses RLS. An unauthed admin route hands the caller schema-level read/write.
2. **High-leverage data** — `/api/admin/providers` POST writes `auth_key_encrypted` (provider master keys); `/api/admin/stats` GET reads platform-wide revenue/COGS, top-spend users, by-tool margin breakdown.
3. **No second line of defense** — unlike user routes (which still need a Bearer JWT to identify the caller), admin routes use a single shared secret. Miss the gate once and the entire surface is open.

## Surface

```
src/app/api/admin/
├── providers/route.ts   POST + GET + OPTIONS
└── stats/route.ts       GET + OPTIONS
```

Total handlers: 5 (POST + GET on providers, GET on stats, plus 2 OPTIONS).

Total handlers requiring auth: 3 (POST + GET on providers, GET on stats).
OPTIONS handlers exempt — return 204 with CORS headers, no body, no DB access.

## Findings

### F-1 — Both routes gate every non-OPTIONS handler

`src/app/api/admin/providers/route.ts`:
```ts
// L18 (POST) — gate
if (!validateAdmin(request)) {
  return NextResponse.json(
    { error: { message: "Unauthorized", code: "admin_auth_required" } },
    { status: 401, headers: ADMIN_HEADERS }
  );
}
// ... only AFTER the gate: supabaseAdmin() + sb.from('tool_providers')
```

Same pattern on:
- `providers/route.ts` GET (L137)
- `stats/route.ts` GET (L19)

Verified: every `supabaseAdmin()` / `sb.from(...)` / `sb.rpc(...)` call lives BELOW the `validateAdmin(request)` check in source order. No handler accesses DB before the gate.

### F-2 — Constant-time secret comparison

```ts
function validateAdmin(request: NextRequest): boolean {
  const secret = request.headers.get("x-admin-secret");
  const expected = process.env.TOOLROUTE_ADMIN_SECRET;
  if (!expected || !secret) return false;
  if (secret.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(secret), Buffer.from(expected));
}
```

`timingSafeEqual` from `node:crypto` — prevents timing-attack secret enumeration. Length-check before `timingSafeEqual` is necessary because the function throws on length mismatch. ✅

The two-step `length !== expected.length` precheck DOES leak the secret length but that's a 32+ char shared admin secret — length is not material. Acceptable.

### F-3 — Currently duplicated, Lane 4.11 (PR #33) extracts to single source

`validateAdmin` is currently defined identically in BOTH admin route files (lines 7-13 of each). Lane 4.11 PR #33 extracts to `src/lib/admin-auth.ts`. Drift test must tolerate both states (pre-merge inline, post-merge import) — matches either:
- Inline function definition with timingSafeEqual
- Import from `@/lib/admin-auth`

### F-4 — No other admin-class routes exist

```bash
$ find src/app/api/admin -name route.ts
src/app/api/admin/providers/route.ts
src/app/api/admin/stats/route.ts
```

Only 2 admin routes. Drift test asserts the count + adds a fail-loud guard so any new admin route added without auth coverage trips master.

### F-5 — No admin functionality leaked outside `src/app/api/admin/`

Verified: no other route hard-codes the admin path or trusts `x-admin-secret` outside the admin/ tree.

```bash
$ grep -rn "TOOLROUTE_ADMIN_SECRET\|x-admin-secret" src/ | grep -v "src/app/api/admin"
# → zero matches
```

## What admin routes can do today (impact-of-bypass)

| Route | Method | Bypass impact |
|-------|--------|---------------|
| `/api/admin/providers` | POST | Insert/update master provider key (auth_key_encrypted) for any tool — attacker registers their own provider in our pool, any user route call to that tool gets routed through attacker's API |
| `/api/admin/providers` | GET | Read all provider configs (cost markup, base URLs, auth_type, redacted keys but still full config) |
| `/api/admin/stats` | GET | Read platform revenue, COGS, margin, top-20 user spend, by-tool requests/errors |

P0 because POST `/api/admin/providers` is direct-to-prod tampering: register attacker's URL as `api_base_url` for `openai`, every user `/api/v1/execute` call to openai routes through attacker's proxy → captures every BYOK key + every prompt + every output.

## Drift prevention — vitest

`tests/unit/admin-auth-coverage-shape.test.ts` (Hard Rule #59) asserts:

1. **Every admin route file has at least 1 validateAdmin reference** — file-level guard.
2. **Every non-OPTIONS exported handler in admin routes calls validateAdmin** — per-handler guard.
3. **validateAdmin call appears BEFORE any DB call** in each handler — order guard.
4. **validateAdmin (whether local or imported) uses timingSafeEqual** — implementation guard.
5. **No admin routes exist outside `src/app/api/admin/`** — surface-area guard.
6. **No file outside `src/app/api/admin/` references `TOOLROUTE_ADMIN_SECRET` or `x-admin-secret`** — leak-class guard.

Test fails master if anyone:
- Adds a new handler to an admin route without `validateAdmin` (e.g. ships a PATCH that forgets the check)
- Reorders a handler to call `supabaseAdmin()` before `validateAdmin`
- Replaces `timingSafeEqual` with `===` or `!==` (timing-attack regression)
- Drops a new admin route under a different prefix (e.g. `src/app/api/internal/...`) without updating this test
- Leaks `TOOLROUTE_ADMIN_SECRET` to a non-admin file

## Cross-applies to

Same audit on every Justin product with an admin/internal API surface:
- **CallTwin** — admin Vapi config, admin user lookup
- **DropClose** — admin lead config, admin user impersonation
- **AffixedAI** — admin template editor, admin user management
- **JarvisCRM** — admin tenant provisioning, admin schema generator
- **PureUSPeptide2** — admin product management, admin order management
- **PeptideAI** — admin inventory, admin formulary
- **VibeArmor** — admin scan re-run, admin finding override

10-min audit per product:
```bash
find src/app/api/admin -name route.ts | xargs grep -L "validateAdmin\|requireAdmin\|isAdmin"
# zero output = every admin route has SOME auth fn called somewhere
# Then per-handler: verify call appears BEFORE first sb.from / sb.rpc
```

## Conclusion

ToolRoute's admin endpoint authorization coverage is CLEAN at file scope — both routes gate every non-OPTIONS handler with `validateAdmin` + `timingSafeEqual`. Drift test pins the property forever so any new admin route or skipped handler fails CI. Lane 4.11 PR #33 extracts the duplicated function to `src/lib/admin-auth.ts` — drift test handles both states.
