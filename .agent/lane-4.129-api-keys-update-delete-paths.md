# Lane 4.129 — api_keys UPDATE/DELETE write-paths drift guard

## What this guards (relative to Lane 4.123)

Lane 4.123 (PR #170) covered `api_keys.user_id` immutability (INSERT-only file
allow-list + no UPDATE rebinds user_id). This lane extends to the rest of the
write surface:

- Which files may UPDATE api_keys (today: only `keys/route.ts`)
- Which columns may be UPDATEd (today: `is_active`, `name`)
- The absence of DELETEs and UPSERTs anywhere in src/

## Audit findings — current write paths

| Verb | File | Payload | Scope |
|------|------|---------|-------|
| INSERT | `signup/route.ts:191` | full row at user creation | session userId |
| INSERT | `keys/route.ts:55` | full row when creating a key | session userId |
| UPDATE | `keys/route.ts:186` | `{ is_active: false }` (revoke) | `.eq("user_id", userId)` |
| UPDATE | `keys/route.ts:276` | `{ name }` (rename) | `.eq("user_id", userId)` |

`last_used_at` is read-only across src/ — only TypeScript types, dashboard
render, and SELECT column lists. Bumps happen via SECDEF RPC under the
application layer (out of regex reach).

`key_hash` and `key_prefix` never appear in any UPDATE payload — INSERT-only
fields by construction.

## Tampering surface this guard closes

1. **is_active flip on someone else's key** — un-revokes a previously
   compromised key, or revokes a victim's working key. Mitigated by the
   `.eq("user_id", userId)` scope today; this guard prevents drift to a new
   file that forgets the scope.
2. **last_used_at rewrite** — audit-log poisoning. Rewrite to NULL ("never
   used") to hide attacker activity, or to arbitrary recent timestamp to
   hide a slumbering attacker key. Today no .update() in src/ touches this;
   guard prevents drift to a new direct-write path.
3. **Hard DELETE** — silently removes the row + breaks
   `credit_transactions` / `usage_events` back-references. Revocation is
   soft via `is_active=false`. Hard delete would break the forensic chain.
4. **UPSERT side-channel** — would bypass both Lane 4.123's INSERT
   allow-list and this lane's UPDATE allow-list.
5. **key_hash / key_prefix mutation** — key_hash is the bcrypt-checked
   authentication material; key_prefix is the public identifier. Mutating
   either means the row either replaces a key behind users' backs or
   impersonates another row.

## Test asserts (6)

1. UPDATE call sites against api_keys are file-allow-listed (only `keys/route.ts`).
2. No DELETE against api_keys anywhere in src/.
3. No UPSERT against api_keys anywhere in src/.
4. No UPDATE payload against api_keys mutates `last_used_at`.
5. No UPDATE payload against api_keys mutates `key_hash` or `key_prefix`.
6. No raw SQL UPDATE/DELETE against api_keys in src/.

## Why source-file regex (not runtime import)

Memory feedback rule #59 — registry imports often pull in `createClient()`
and crash without prod env. Tests use `fs.readFileSync` + regexes; nothing
imports app code.

## Defense-in-depth (this column family)

1. **DB-layer**: Lane 4.97 REVOKE on `authenticated` writes + RLS
   service-role-only.
2. **App-layer Lane 4.123**: INSERT allow-list (signup, keys), no UPDATE
   rebinds user_id.
3. **App-layer Lane 4.129** (this PR): UPDATE allow-list, column allow-list
   (is_active/name only), no DELETE/UPSERT, no last_used_at/key_hash/key_prefix
   mutation.
4. **Auth-layer**: every UPDATE site scopes by `.eq("user_id", userId)`
   where userId is from `getUserFromSession()`.

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
- **4.129 api_keys UPDATE/DELETE** (this PR) — closes audit-tampering surface

After this PR, the api_keys table has full INSERT (4.123) + UPDATE/DELETE
(4.129) drift-guard coverage. Next-tier candidates: `gateway_users.metadata`
(grab-bag JSON column), and table-level RPC drift guards.
