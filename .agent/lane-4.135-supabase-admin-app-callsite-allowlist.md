# Lane 4.135 — supabaseAdmin() callsite drift guard for src/app/**

## What this guards

Lane 4.132 closed the **lib-layer** supabaseAdmin() surface
(src/lib/* may only call from gateway.ts). Its rationale comment
deferred src/app/ to "Lane 4.33 (route-auth-coverage) gates routes."
That deferral is correct for the auth-class declaration gate, but
leaves three drift classes uncaught:

### Drift class #1: page.tsx / layout.tsx Server Component calling supabaseAdmin()

```tsx
// src/app/dashboard/admin-leaderboard/page.tsx (HYPOTHETICAL)
import { supabaseAdmin } from "@/lib/gateway";

export default async function AdminLeaderboard() {
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("gateway_users")
    .select("email, plan_slug, credit_balance");
  // ^ service-role read of every user's row. Auth context is
  //   "whoever loads the page". Lane 4.33 walks route.ts only,
  //   doesn't see this. Memory rule #58 sibling — but for service-
  //   role reads, where the row would otherwise be RLS-locked.
  return <Table data={data} />;
}
```

This sails past Lane 4.33 (no route file added), past Lane 4.132
(not in src/lib/), and reaches prod silently.

### Drift class #2: non-route helper colocated under src/app/api/

```ts
// src/app/api/v1/exports/build-csv.ts (HYPOTHETICAL helper)
import { supabaseAdmin } from "@/lib/gateway";

export async function buildExportCsv(userId: string) {
  const sb = supabaseAdmin();
  return sb.from("credit_transactions").select("*");
  // ^ no .eq() — leaks every user's ledger. Lane 4.33's walker
  //   only reads route.ts; this file isn't route.ts. Lane 4.132
  //   only walks src/lib/.
}
```

### Drift class #3: existing route adds new supabaseAdmin() call

Lane 4.33 declares the route's auth class once at file top in a
banner. It does NOT re-validate that imports stay consistent with
the declared class. A route classified `public` could quietly add
a `supabaseAdmin()` call mid-handler and Lane 4.33 wouldn't catch
it because the banner remains correct. Lane 4.135's allow-list
locks the SET of files that may call it.

## What the test enforces

Three assertions in
`tests/unit/supabase-admin-app-callsite-allowlist.test.ts`:

### 1. Only allow-listed src/app/ files call supabaseAdmin()

The 14-file allow-list (audited 2026-04-29):
- 2 admin: providers, stats
- 5 session: keys, byok, settings, billing/setup-payment, (usage is dual)
- 1 dual: usage
- 3 api_key: registry/{usage,challenge,request}
- 2 public: tools (catalog read), signup (insert new user row)
- 1 stripe_webhook: webhooks/stripe
- 1 oauth: auth/callback

Adding a new file requires updating this Set AND providing a
rationale in the test's header comment correlating the auth
classification to the legitimate need for service-role.

### 2. Allow-list rot guard

Every entry in the allow-list must actually contain a
`supabaseAdmin()` call. Catches the case where a file gets
refactored to remove the call but the allow-list entry stays —
later, an unrelated file at the same path could silently inherit
the grant.

### 3. Non-route src/app/ files cannot call supabaseAdmin()

Defense for drift class #1. Walks every src/app/**/*.{ts,tsx}
that ISN'T `route.ts`, asserts no `supabaseAdmin()` call. Locks
the invariant: only route handlers (already gated by Lane 4.33's
auth-class declaration AND Lane 4.135's allow-list) can use
service-role; page/layout/helper files may NOT.

## Source-file regex hygiene per memory rule #59

`readFileSync` + regex (no runtime imports — they pull
`createClient()` and crash without prod env). `stripComments()`
pass before the regex check so JSDoc references like the comment
in `src/lib/admin-auth.ts:13` ("touching supabaseAdmin().") don't
false-positive (this exact false-positive class hit Lane 4.132 on
first run — see memory rule #59 hygiene tactical section).

## Coverage matrix (post Lane 4.135)

| Drift class | Guard |
|---|---|
| Service-role JWT in source | Lane 4.26 + 4.132 |
| supabaseAdmin() in src/lib/ | Lane 4.132 |
| supabaseAdmin() in src/app/ routes | **Lane 4.135 (this lane, allow-list)** |
| supabaseAdmin() in src/app/ pages/helpers | **Lane 4.135 (this lane, blanket ban)** |
| RPC-callable mint surface | Lane 4.131 |
| Sensitive column WRITE drift | Lanes 4.121–4.130 |
| Sensitive table READ drift (IDOR) | Lane 4.133 |
| Route missing auth class | Lane 4.33 + 4.116 |
| Webhook signature bypass | Lane 4.20 + 4.29 |
| Admin route missing validateAdmin gate | Lane 4.134 |

Every src/ file capable of producing a service-role-keyed Supabase
client is now allow-listed by file path, with auth-class rationale
documented in test source.

## Sibling guards
- Lane 4.33 + 4.116 — route auth class declaration
- Lane 4.132 — lib-layer supabaseAdmin allow-list
- Lane 4.131 — gateway RPC EXECUTE allow-list
- Lane 4.134 — admin/* validateAdmin() coverage
