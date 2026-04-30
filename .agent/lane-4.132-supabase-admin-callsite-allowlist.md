# Lane 4.132 — supabaseAdmin() callsite drift guard

## What this guards

`supabaseAdmin()` returns a service-role-keyed Supabase client. Service-role
**bypasses RLS** — every gateway table is readable + writable, including:
- `gateway_users` (Stripe customer IDs, balances, plan slugs)
- `api_keys` (key hashes + prefixes — auth bypass primitive)
- `credit_transactions` (financial ledger — mint/double-charge surface)
- `user_provider_keys` (encrypted BYOK provider keys)
- `usage_events` (request log, PII)

Every callsite is a security-load-bearing line.

## Why a separate lane (sibling to 4.33 + 4.131)

Lane 4.33 + 4.116 (route-auth-coverage) gate `src/app/**/route.ts`: every
route file MUST declare its auth class (`api_key` / `session` / `admin` /
`dual` / `stripe_webhook` / `public`). That covers the 22 route-level
`supabaseAdmin()` callsites — a public-classified route can't sneak in a
service-role read because the auth-coverage test reads the route file's
source and demands a classification banner.

What Lane 4.33 **doesn't** cover: a new `src/lib/some-billing-helper.ts`
with `supabaseAdmin()` inside an exported function. That helper could be
imported by **any** route — including a route classified `public` by
Lane 4.33 — and transitively grant that route service-role bypass. The
route-auth test reads only the route file's source; it can't follow
imports.

This lane closes that gap. In `src/lib/`, `supabaseAdmin()` may **only**
be called from `gateway.ts`, where the function is defined and used by
auth-bound internals (`validateRequest` / `checkRateLimit` /
`executeToolRequest` / `getKeyInfo` / `getUserFromSession`). Any new lib
file calling `supabaseAdmin` trips this guard, forcing the reviewer to
either:
- (a) move the helper into a route file (gated by Lane 4.33), or
- (b) explicitly add the lib file to the allow-list with a documented
  auth invariant.

## Today's lib-layer supabaseAdmin() callers (audited)

```
src/lib/gateway.ts:16   — `export function supabaseAdmin()` (definer)
src/lib/gateway.ts:45,100,174,276,330,379,466,556 — 9 internal use sites
```

Allow-list:
```ts
const LIB_SUPABASE_ADMIN_ALLOWLIST = new Set<string>([
  "src/lib/gateway.ts",
]);
```

## What the test enforces

Three assertions, all source-file regex parsers (memory rule #59 — never
import registry/runtime modules; they pull in `createClient()` and crash
without prod env):

1. **Only `src/lib/gateway.ts` calls `supabaseAdmin()` in `src/lib/`.**
   Any new lib file with a `supabaseAdmin()` call expression fails.
   Comment-strip pass before regex check (block `/* */` and line `//`)
   so JSDoc references like `* touching supabaseAdmin().` in
   `admin-auth.ts:13` don't false-positive.

2. **No `createClient(... SUPABASE_SERVICE_ROLE_KEY ...)` outside
   `gateway.ts`.** Defense-in-depth: someone could side-channel by
   calling `createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY)`
   directly instead of going through `supabaseAdmin()`. Catch that
   anywhere in src/, not just lib/.

3. **No hardcoded JWT (`eyJ...`) anywhere in src/.** Lane 4.26
   service-role JWT bundle exposure audit + memory rule #54 (hardcoded-
   JWT recurring class). A future PR could ship `const SR = "eyJ..."` at
   file top to avoid env-var ceremony — same drift class as Lane 4.32 +
   memory rule #54. Hardcoded JWT === service-role bypass.

## Sibling guards

- **Lane 4.33 + 4.116** — route auth coverage (every route classified).
- **Lane 4.131** — RPC callsite allow-list (`add_credits`,
  `deduct_credits`, `validate_api_key`, `check_rate_limit`,
  `log_gateway_request`).
- **Lanes 4.121–4.130** — column-write allow-lists for every sensitive
  field on `gateway_users` / `api_keys` / `credit_transactions` /
  `user_provider_keys`.

Together: every service-role-using surface in `src/` is either
route-classified (Lane 4.33) or lib-layer-allow-listed (Lane 4.132),
every RPC has a callsite allow-list (Lane 4.131), and every sensitive
column has a write-path allow-list (Lanes 4.121–4.130). New service-role
write surface cannot ship without tripping at least one CI gate.
