# Lane 4.130 — gateway_users.metadata write-paths drift guard

## What this guards

`gateway_users.metadata` is a `jsonb` grab-bag column. Today's keys:

| Key | Set by | When |
|-----|--------|------|
| `accepted_tos_at` | `signup/route.ts:168` | password signup |
| `signup_source` | `signup/route.ts:168` | password signup |
| `email_verified` | `auth/callback/route.ts:78,94` | OAuth/magic link |
| `email_verified_at` | `auth/callback/route.ts:78,94` | OAuth/magic link |

Future PRs are likely to add more keys (notification prefs, feature flags,
beta opt-ins). This lane guards the write surface BEFORE that happens.

## Audit findings — current write paths

| Verb | File | metadata posture |
|------|------|------------------|
| INSERT | `signup/route.ts:168` | full row, sets `{ accepted_tos_at, signup_source }` |
| INSERT | `auth/callback/route.ts:94` | full row, sets `{ ...existing?.metadata, email_verified, email_verified_at }` |
| UPDATE | `auth/callback/route.ts:78` | merge: `metadata` pre-built via spread of `existing.metadata` then overlay |
| INSERT | `gateway.ts:576` (lazy fallback) | **NO metadata field** — pre-metadata code path |
| UPDATE | `webhooks/stripe/route.ts:158,183,366` | NONE touch metadata (plan/customer fields only) |
| UPDATE | `settings/route.ts:187` | dynamic `update(updates)`, but ALLOWED_FIELDS (Lane 4.22) excludes metadata |
| UPDATE | `billing/setup-payment/route.ts:50` | only `stripe_customer_id` |

## Tampering surface this guard closes

1. **Wholesale clobber on UPDATE** — A future PR writes
   `update({ metadata: { only_x: y } })` and silently erases
   `email_verified`, `accepted_tos_at`, and any future keys. The merge
   pattern (`...existing.metadata`) is the load-bearing invariant; this
   guard requires the spread to remain in `auth/callback`.

2. **New file writes metadata** — A future surface (e.g., a "preferences"
   endpoint) could write to `gateway_users.metadata` directly. INSERT and
   UPDATE allow-lists force such code through one of the two known sites
   (signup, auth/callback) — or trip CI.

3. **UPSERT side-channel** — Same drift class, would bypass both INSERT
   and UPDATE allow-lists.

4. **Raw SQL** — `UPDATE gateway_users SET metadata = ...` or
   `INSERT INTO gateway_users (metadata, ...)` bypass the
   PostgREST-keyed regexes; covered by a separate raw-SQL assertion.

## Test asserts (5)

1. UPDATE call sites with `metadata` payload are file-allow-listed (only
   `auth/callback/route.ts`).
2. INSERT call sites with `metadata` payload are file-allow-listed (only
   `signup/route.ts` + `auth/callback/route.ts`).
3. No `.upsert(...)` against `gateway_users` anywhere in src/.
4. No raw SQL UPDATE/INSERT against `gateway_users.metadata` in src/.
5. `auth/callback/route.ts` UPDATE preserves existing metadata via spread —
   match `...existing*.metadata` somewhere in the file. Drift = removing
   the spread = wholesale clobber.

## Why source-file regex (not runtime import)

Memory feedback rule #59 — registry imports often pull in `createClient()`
and crash without prod env. Tests use `fs.readFileSync` + regexes; nothing
imports app code.

Regex anchors `[,{\s]metadata\s*[,:}]` so substring matches like
`user_metadata` or `*_metadata_key` don't trip the allow-list test. Caught
on first run — `gateway.ts:576` has `user.user_metadata?.full_name` (the
auth-user object's metadata, unrelated to `gateway_users.metadata`).

## Defense-in-depth (this column family)

1. **DB-layer**: Lane 4.97 REVOKE on `authenticated` writes + RLS
   service-role-only.
2. **App-layer Lane 4.22**: `settings/route.ts` ALLOWED_FIELDS whitelist
   excludes metadata — mass-assignment defense.
3. **App-layer Lane 4.130** (this PR): UPDATE+metadata file allow-list,
   INSERT+metadata file allow-list, no upsert, no raw SQL, merge invariant.
4. **Auth-layer**: every `gateway_users` UPDATE site scopes by
   `.eq("id", userId)` where userId is from `getUserFromSession()` (or
   Stripe webhook signature for billing).

## Drift-guard family progression

- 4.121 credit_balance (PR #168)
- 4.122 plan_slug (PR #169)
- 4.123 api_keys.user_id (PR #170)
- 4.124 stripe_customer_id (PR #171)
- 4.124-followup CAS guard (PR #173)
- 4.125 auto_topup_* (PR #172)
- 4.126 credit_transactions ledger (PR #174)
- 4.127 user_provider_keys (PR #175)
- 4.128 gateway_users.email (PR #176)
- 4.129 api_keys UPDATE/DELETE (PR #177)
- **4.130 gateway_users.metadata** (this PR) — closes gateway_users column family

After this PR, every `gateway_users` column has CI drift coverage
(`credit_balance`, `plan_slug`/`plan_id`, `stripe_customer_id`,
`auto_topup_*`, `email`, `metadata`). Sibling tables also fully covered:
`api_keys` (4.123 + 4.129), `credit_transactions` (4.126),
`user_provider_keys` (4.127). Next-tier candidates: RPC-level drift guards
(`add_credits`, `deduct_credits`, `validate_api_key`).
