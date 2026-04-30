# Lane 4.128 — gateway_users.email write-paths drift guard

## What this guards

`gateway_users.email` is the account-takeover surface. If a future PR allows
attacker A to rewrite victim B's `gateway_users.email`, password-reset / OAuth
re-link / magic-link flows redirect to attacker. Subtler variant: a
signup-or-callback drift inserts `gateway_users.email != authData.user.email`,
silently de-syncing the row from the auth boundary.

## Audit findings — current write paths

**INSERT (3 files, each auth-bound):**

| File | Trigger | Email source |
|------|---------|--------------|
| `src/lib/gateway.ts:576` | `getUserFromSession` lazy profile create | `user.email` (JWT-validated Supabase auth user) |
| `src/app/auth/callback/route.ts:94` | OAuth first-time profile create | `user.email` (post `exchangeCodeForSession`) |
| `src/app/api/v1/signup/route.ts:168` | Password signup | `email` variable (just passed to `sb.auth.admin.createUser` two blocks above; signup IS the email-binding moment) |

**UPDATE (1 file):**

| File | Trigger | Email source |
|------|---------|--------------|
| `src/app/auth/callback/route.ts:79` | OAuth subsequent visits | `email \|\| existing.email` where `email = user.email` (auth-validated, falls back to row's existing value) |

No upserts. No raw SQL. All four sites source email from a Supabase-auth-validated
identity, never from request body.

## Test asserts (5)

1. **UPDATE allow-list** — only `auth/callback/route.ts` may UPDATE
   gateway_users with an email payload.
2. **INSERT allow-list** — only `lib/gateway.ts`, `auth/callback/route.ts`,
   `signup/route.ts` may INSERT gateway_users with an email payload.
3. **No UPSERT** — no upsert against gateway_users with email payload anywhere
   in src/. (Adding upsert side-channels both lists above.)
4. **No raw SQL** — no `UPDATE gateway_users SET email=` or
   `INSERT INTO gateway_users (...email...)` in src/.
5. **In-source binding sanity** — `auth/callback/route.ts` must:
   - declare `const email = user.email` (or `?? ""`) before the UPDATE,
   - reference `existing.email` in the UPDATE payload (the auth-bound fallback shape),
   - NOT contain any `email: body.X` style assignment.

## Why source-file regex (not runtime import)

Memory feedback rule #59 — registry imports often pull in `createClient()`
and crash without prod env. Tests use `fs.readFileSync` + regexes; nothing
imports app code.

## Defense-in-depth (this column)

1. **DB-layer**: Lane 4.97 REVOKE on `authenticated` writes + RLS
   service-role-only.
2. **Auth-layer**: every write path derives email from a Supabase Auth
   identity — `exchangeCodeForSession`, JWT validation, or
   `sb.auth.admin.createUser` (which validates uniqueness + format upstream).
3. **App-layer test**: this PR — fail CI on any new write site, any UPDATE
   that takes email from request body, any UPSERT, or any raw SQL.

## Drift-guard family progression

- 4.121 credit_balance (PR #168)
- 4.122 plan_slug (PR #169)
- 4.123 api_keys.user_id (PR #170)
- 4.124 stripe_customer_id (PR #171)
- 4.124-followup CAS guard (PR #173)
- 4.125 auto_topup_* (PR #172, closed gateway_users financial family)
- 4.126 credit_transactions ledger (PR #174)
- 4.127 user_provider_keys (PR #175)
- **4.128 gateway_users.email** (this PR) — closes account-takeover-class
  drift surface

After this PR, every gateway-side column whose drift = direct financial
fraud OR account takeover has a CI gate. Next-tier candidates are
audit-class (api_keys.last_used_at = audit log poisoning) or
operational-class (gateway_users.metadata = grab-bag JSON column).
