# Lane 4.48 — Cache-Control private,no-store on authed routes

## Threat model

Next.js 16 App Router emits `Cache-Control: public, max-age=0, must-revalidate`
by default on dynamic route handlers. The `public` directive permits ANY
downstream proxy (Cloudflare, corporate egress proxy, ISP transparent
cache, on-prem reverse proxy) to cache the response keyed by URL alone.

Auth-gated routes serve user-specific payloads at the same URL for every
caller (e.g. `/api/v1/keys` returns user A's keys when called by user A,
user B's keys when called by user B — keyed by `Authorization` header,
not by URL). A misconfigured downstream cache that ignores the auth
header could serve user A's payload to user B.

Vercel itself does not cache dynamic routes, but the moment a customer
deploys behind Cloudflare, an enterprise proxy, or a corporate cache,
the leak surface opens. Defense-in-depth: emit `private, no-store`
explicitly so every cache layer refuses storage.

## Detection rule

A route is "auth-gated" if its source references any of:
- `validateRequest` (API key auth)
- `validateAdmin` (admin session check)
- `auth.getUser` / `getSession` (Supabase session)
- `cookies()` (any cookie read)
- `gateway_users` (table name proves user-specific data)

## Fix

Introduced `AUTHED_RESPONSE_HEADERS` in `src/lib/gateway.ts`:

```ts
export const NO_STORE_HEADERS: Record<string, string> = {
  "Cache-Control": "private, no-store",
};

export const AUTHED_RESPONSE_HEADERS: Record<string, string> = {
  ...CORS_HEADERS,
  ...NO_STORE_HEADERS,
};
```

Swapped 14 auth-gated route files from `CORS_HEADERS` →
`AUTHED_RESPONSE_HEADERS`:

- `src/app/api/v1/usage/route.ts`
- `src/app/api/admin/stats/route.ts`
- `src/app/api/v1/signup/route.ts`
- `src/app/api/v1/registry/request/route.ts`
- `src/app/api/v1/registry/usage/route.ts`
- `src/app/api/v1/execute/route.ts`
- `src/app/api/v1/registry/challenge/route.ts`
- `src/app/api/admin/providers/route.ts`
- `src/app/api/v1/settings/route.ts`
- `src/app/api/v1/keys/route.ts`
- `src/app/api/v1/checkout/route.ts`
- `src/app/api/v1/byok/route.ts`
- `src/app/api/v1/billing/setup-payment/route.ts`
- `src/app/api/v1/key/route.ts`

Plus `src/app/api/a2a/route.ts` — uses its own `A2A_CORS` constant; added
`Cache-Control: private, no-store` directly to it.

## Allowlist (legitimately anon — no auth, no per-user data)

- `src/app/api/v1/tools/route.ts` — anon tool catalog
- `src/app/api/v1/health/route.ts` — anon health check
- `src/app/api/tools/route.ts` — anon legacy catalog
- `src/app/api/check/route.ts` — anon
- `src/app/api/search/route.ts` — anon search
- `src/app/api/webhooks/stripe/route.ts` — Stripe signature verify only;
  body is `{received:true}`, no user data, Stripe ignores cache headers
  on webhook responses.

## Drift guard

`tests/unit/cache-control-private.test.ts` walks `src/app/api/`,
greps for any AUTH_HINTS regex match, and asserts the file also
emits `private, no-store` (via `AUTHED_RESPONSE_HEADERS`,
`NO_STORE_HEADERS`, or literal `Cache-Control: ...private...no-store`).

Adding a new auth-gated route without the no-store header fails CI.

## Currently exploitable?

No — Vercel does not cache dynamic routes by default and ToolRoute is
not behind a customer-facing CDN today. This is defense-in-depth: the
moment any downstream cache is added (Cloudflare in front of toolroute.ai,
or enterprise customers proxying API calls), the leak surface vanishes
because every response carries `Cache-Control: private, no-store`.
