# Lane 4.133 — sensitive-table SELECT owner-filter drift guard

## What this guards

Lanes 4.121–4.131 closed every WRITE-path drift class on sensitive tables.
Lane 4.132 closed the lib-layer service-role bypass surface.

Remaining unguarded drift class: **READ-path IDOR**. Lane 4.33 verifies
the *caller* is auth-classified, but auth ≠ ownership. A session-authed
route can still leak any other user's row if a SELECT forgets
`.eq("user_id", userId)` / `.eq("id", userId)`.

Lane 4.30 was a one-shot manual IDOR audit. This lane ships CI
enforcement so future drift can't reintroduce the bypass silently.

## Drift class examples

```ts
// BUG: no user filter — leaks every user's stripe_customer_id + balance
const { data } = await admin
  .from("gateway_users")
  .select("credit_balance, stripe_customer_id");

// BUG: filter from request input, no auth-bound owner check
const { data } = await admin
  .from("api_keys")
  .select("*")
  .eq("id", request.body.key_id);  // attacker controls key_id
```

Both pass Lane 4.33 (route is auth-classified) and pass Lane 4.132
(supabaseAdmin called from route, not lib). Without 4.133, both ship
silently.

## What the test enforces

Five assertions (one per sensitive table + a Stripe-filter scope check):

### Per-table file allow-list

```ts
gateway_users:
  src/lib/gateway.ts
  src/app/auth/callback/route.ts
  src/app/api/webhooks/stripe/route.ts
  src/app/api/v1/keys/route.ts
  src/app/api/v1/settings/route.ts
  src/app/api/v1/billing/setup-payment/route.ts
  src/app/dashboard/page.tsx

api_keys:
  src/lib/gateway.ts
  src/app/api/v1/keys/route.ts

credit_transactions:
  src/lib/gateway.ts
  src/app/api/webhooks/stripe/route.ts
  src/app/dashboard/billing/page.tsx

user_provider_keys:
  src/lib/gateway.ts
  src/app/api/v1/byok/route.ts
```

A new file calling `.from("<sensitive>").select(...)` trips the guard.
Reviewer must explicitly add it to the allow-list AND audit the SELECT's
filter mechanism.

### Per-callsite filter check

For each `.from("<table>").select(...)` callsite (where `.select` is the
first chained method — read path; UPDATE/INSERT/DELETE chains are
covered by Lanes 4.121–4.130), at least one of these filters must
appear within 600 chars of the chain:

- `.eq("id", ...)`
- `.eq("user_id", ...)`
- `.eq("stripe_customer_id", ...)` — **only** in `webhooks/stripe/route.ts`
- `.eq("stripe_payment_id", ...)` — **only** in `webhooks/stripe/route.ts`

Stripe filters are scoped to the webhook route because that route is
the only place where the value comes from a Stripe-signature-verified
event (Lane 4.20 + 4.29). In any other file, those filter values come
from request input → IDOR.

### Defense-in-depth: Stripe-filter scope check

The fifth assertion grep-scans for `.eq("stripe_customer_id"|
"stripe_payment_id", ...)` anywhere outside the webhook route and
fails if any are found. Catches a future PR that tries to filter by
stripe_customer_id in a session-authed route — those filters
fundamentally belong to webhook-signed lookups.

## Source-file regex parser

Memory rule #59: never `import` registry/runtime modules in tests —
they pull in `createClient()` and crash without prod env. All four
assertions use `readFileSync` + regex over source text. Comment-strip
pass (block + line) before regex check so JSDoc references like
`// .from("gateway_users")` in a code example don't false-positive.

## Why .from-then-.select scope (read-path only)

Restricting to `\.from\(["']X["']\)\s*\.select\(` (i.e., `.select` is
the first chained method) catches read-only chains. UPDATE-then-
returning chains like `.from("api_keys").update({...}).eq(...).select(...)`
are intentionally excluded — those are write paths, already gated by
Lanes 4.121–4.130. This avoids double-coverage and false positives.

## Coverage matrix (post Lane 4.133)

| Drift class | Guard |
|---|---|
| Service-role JWT in source | Lane 4.26 + 4.132 |
| supabaseAdmin() in lib helper | Lane 4.132 |
| RPC-callable mint surface | Lane 4.131 |
| Sensitive column WRITE drift | Lanes 4.121–4.130 |
| Sensitive table READ drift (IDOR) | **Lane 4.133 (this lane)** |
| Route missing auth class | Lane 4.33 + 4.116 |
| Webhook signature bypass | Lane 4.20 + 4.29 |

Every gateway surface — read, write, RPC, service-role, route auth —
is now CI-gated. New PRs cannot ship a service-role-bypass-class
regression without tripping at least one drift guard.
