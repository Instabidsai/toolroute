# Lane 4.127 — user_provider_keys write-paths drift guard

## What this guards

`user_provider_keys` stores users' BYOK provider credentials
(`api_key_encrypted` today; Vault-encrypted post Lane 4.36-impl). Two
takeover classes if the write surface drifts:

1. **user_id rebind** — a future PR rewrites a row's `user_id` to victim B,
   OR seeds an INSERT with `user_id` from request body instead of session.
   Attacker A's pasted key is now associated with B's account; calls made
   by A may bill B (or, worse, draw on B's prefer_own_key path).
2. **is_active / prefer_own_key flip on someone else's row** — toggling
   victim B's `is_active=false` forces fallback to gateway master-pool
   (gateway-eats-cost = self-mint surface), or flipping `prefer_own_key=false`
   redirects billing.

## Today's write paths

Single file: `src/app/api/v1/byok/route.ts`

- **POST** — `.upsert({ user_id: userId, tool_slug, api_key_encrypted, is_active, prefer_own_key, updated_at }, { onConflict: "user_id,tool_slug" })`
  where `userId` comes from `getUserFromSession(authHeader)`.
- **DELETE** — `.update({ is_active: false, updated_at })`, scoped by
  `.eq("user_id", userId).eq("tool_slug", tool_slug)`. Payload does NOT
  contain `user_id` (no rebind risk).

GET is read-only and not relevant to drift surface.

## Test asserts (4)

1. **File allow-list** — only `byok/route.ts` may call
   `.from("user_provider_keys").(insert|upsert|update|delete)(...)`.
2. **No UPDATE rebinds user_id** — `update({ ... user_id ... })` against
   user_provider_keys is forbidden anywhere in src/ (upsert is allowed
   because the upsert seeds user_id at row creation). If a future
   soft-delete refactor needs to UPDATE more columns, that's fine — but
   user_id is never one of them.
3. **No raw SQL** — `UPDATE | DELETE FROM | INSERT INTO user_provider_keys`
   in src/ source files.
4. **In-source seeding sanity** — the allow-listed file must (a) call
   `getUserFromSession()`, (b) include `user_id: userId` in its upsert,
   and (c) NOT contain `user_id: body.X` style assignment.

## Why source-file regex (not runtime import)

Memory feedback rule #59 — registry imports often pull in `createClient()`
and crash without prod env. Tests read files with `fs.readFileSync` and
run regexes; nothing imports the app code.

## Defense-in-depth (this column)

1. **DB-layer**: Lane 4.97 REVOKE on `authenticated` writes + RLS
   service-role-only.
2. **Auth-layer**: `getUserFromSession()` derives userId from the auth
   header, never from request body.
3. **App-layer test**: this PR — fail CI if anyone re-introduces a write
   site or rebinds user_id via UPDATE.
4. **Pending**: Lane 4.36-impl Vault encryption (Codex ticket #52) — once
   shipped, even row-rebinding gets you ciphertext, not plaintext keys.

## Drift-guard family progression

- 4.121 credit_balance (PR #168)
- 4.122 plan_slug (PR #169)
- 4.123 api_keys.user_id (PR #170)
- 4.124 stripe_customer_id (PR #171)
- 4.124-followup CAS guard (PR #173)
- 4.125 auto_topup_* (PR #172, closes gateway_users family)
- 4.126 credit_transactions ledger (PR #174)
- **4.127 user_provider_keys** (this PR) — closes BYOK row takeover surface

After this lands, every column whose drift = direct financial fraud OR
account-takeover has a CI gate. Next iter targets are lower blast radius:
`gateway_users.email` (account hijack via password reset) and
`api_keys.last_used_at` (audit log poisoning).
