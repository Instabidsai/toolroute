---
name: Lane 4.123 — api_keys.user_id is INSERT-only drift guard
description: Audited every api_keys touch site in src/. ZERO `.update({...user_id...})` paths exist — user_id is set at INSERT (signup + key creation) and never mutated. Shipped vitest drift guard so a regression breaks CI.
type: project
---

# Lane 4.123 — api_keys.user_id INSERT-only drift guard

**Owner:** Claude (auditor + impl)
**Started/Closed:** 2026-04-29
**Severity:** LOW (no finding — confirmation that the ownership invariant holds, drift guard locks it)
**Sibling:** Lane 4.121 (credit_balance RPC-only), Lane 4.122 (plan_slug allow-listed), Lane 4.92 (RPC EXECUTE lockdown), Lane 4.97 (authenticated WRITE REVOKE)

## TL;DR

Audited the entire src/ tree for direct write paths to `api_keys.user_id`. Result: **user_id is INSERT-only.** Two files seed it at row creation (`v1/keys/route.ts` POST and `v1/signup/route.ts` default key), zero files mutate it via UPDATE. Shipped `tests/unit/api-keys-user-id-immutable.test.ts` (3/3 green) so any future PR that re-binds a key to another user fails CI.

## Why this matters

The entire api_keys ownership boundary is `.eq("user_id", userId)`. Every session-authed mutation route (revoke, rename, ownership-existence check) trusts that user_id reflects the original creator. If a future PR adds something like:

```ts
await supabaseAdmin()
  .from("api_keys")
  .update({ user_id: targetUserId })  // ← instant ownership takeover
  .eq("id", keyId);
```

…then any compromised admin/transfer/merge path becomes a way for the attacker to re-bind every victim's tr_live_ keys to themselves. Service_role bypasses GRANT and RLS (Lane 4.97 REVOKE on authenticated doesn't catch it). The only thing keeping the invariant intact today is application-layer discipline — this guard converts that into a CI gate.

## Audit method

Grep `api_keys` across src/ — 3 files:

| File | Operation | user_id touch |
|------|-----------|---------------|
| `src/lib/gateway.ts` | SELECT only (line 70-73, expires_at lookup) | none — actual validation in `validate_api_key` RPC (Lane 4.92 service_role-only) |
| `src/app/api/v1/keys/route.ts` | 1× INSERT, 2× UPDATE, 3× SELECT | INSERT seeds user_id; UPDATEs only mutate `is_active` / `name` and filter `.eq("user_id", userId)` |
| `src/app/api/v1/signup/route.ts` | 1× INSERT (default test key) | INSERT seeds user_id |

Confirmed regex sweeps:
- `\.from\(\s*["']api_keys["']\s*\)[\s\S]{0,500}?\.update\(\s*\{[^}]*user_id` → 0 hits
- `UPDATE\s+api_keys\b[\s\S]{0,200}?SET[^;]*user_id\s*=` → 0 hits
- `\.from\(\s*["']api_keys["']\s*\)[\s\S]{0,500}?\.insert\(` → exactly 2 hits, both allow-listed

## Drift guard — `tests/unit/api-keys-user-id-immutable.test.ts`

3 assertions, all green:

1. No `.from("api_keys").update({...user_id...})` chain anywhere in src/
2. No raw `UPDATE api_keys SET ... user_id =` SQL anywhere in src/
3. Only allow-listed files INSERT into api_keys (`v1/keys/route.ts` + `v1/signup/route.ts`)

Walks every `.ts`/`.tsx` file under `src/` (excluding tests, node_modules, .next). Source-file regex parser, no runtime imports.

## Why this drift guard, not the existing ones

- Lane 4.97 REVOKE on authenticated WRITE — service_role bypasses GRANT, doesn't catch.
- Lane 4.34 RLS coverage — RLS doesn't restrict service_role either.
- Lane 4.30 IDOR audit on session-authed mutations — caught the existing `.eq(user_id)` filters but doesn't lock against future regressions.

This guard fills the gap: locks the column-immutability invariant at the application layer, which is the only layer where it's enforceable for service_role surfaces.

## Pattern carry-over

This is the third drift guard in the column-write-allowlist family:
- Lane 4.121 — `credit_balance` (RPC-only)
- Lane 4.122 — `plan_slug` (allow-listed file)
- Lane 4.123 — `api_keys.user_id` (INSERT-only, allow-listed INSERTs)

Each one converts a different shape of application-layer discipline into a CI gate. Future siblings: `stripe_customer_id` on gateway_users, `user_provider_keys.encrypted_value` (post-Vault), `auto_topup_*` allow-list reinforcement.

## Acceptance

- [x] Audit every api_keys touch site in src/
- [x] Confirm zero direct `.update({...user_id...})` patterns
- [x] Confirm zero raw `UPDATE api_keys SET user_id` SQL
- [x] Confirm INSERT allow-list is exactly 2 files (keys + signup)
- [x] Drift guard ships (3/3 green)
- [x] Memo + commit

## Out of scope

- `key_hash` and `key_prefix` immutability — also INSERT-only today, but the threat model is different (no takeover surface since hash mutation just invalidates the key, doesn't reassign it). Worth a sibling guard if Codex #52 (BYOK Vault) introduces re-encryption.
- `expires_at` mutation — legitimate admin/extension surface; not locked.
- `is_active` and `name` — legitimate user-mutable fields filtered by ownership scope.
