# Lane 4.36 — BYOK Plaintext Storage Audit + Codex Implementation Ticket

**Severity:** P1
**Status:** AUDIT COMPLETE — implementation pending (Codex ticket below)
**Audit date:** 2026-04-28
**Affected rows in production:** 0 (table currently empty — fix-before-first-customer window is open)

## The gap

`src/app/api/v1/byok/route.ts:28` writes user-provided provider API keys
into `user_provider_keys.api_key_encrypted` as **plaintext**:

```ts
.upsert({
  user_id: userId,
  tool_slug,
  api_key_encrypted: api_key, // TODO: encrypt with KMS
  ...
})
```

`src/lib/gateway.ts:261` reads the same column back as `resolvedKey`
without any decrypt step:

```ts
if (byokRow) {
  resolvedKey = byokRow.api_key_encrypted;
  keySource = "byok";
}
```

**The column name implies encryption. The data is plaintext.** Anyone
(or any process) reading the row gets the plaintext key.

## Threat model

| Vector | Currently mitigated? | Risk if breached |
|--------|----------------------|------------------|
| Service-role JWT leak (rule #34) | Yes — leak-class audited Lane 4.26 | Every user's OpenAI/Anthropic/Stripe/Vapi/Resend key in plaintext |
| SQL injection in any path | No injection paths currently known | Same |
| Supabase backup / snapshot leak | Implicit trust in Supabase Inc. | Same — keys in pg_dump output |
| Insider with DB read access | One employee + Supabase ops | Same |
| RLS regression | Lane 4.34 drift test catches | Same |

The blast radius is the same in every scenario: total disclosure of
every BYOK customer's third-party provider keys.

## Why this is P1 (not P0)

- Service-role key is currently **not** leaked (Lane 4.26 confirmed).
- Anon-read RLS on `user_provider_keys` is locked (Lane 4.34 confirmed
  rows=0 to anon).
- Route is auth-gated to the user.
- **0 rows currently exist** — no live customer keys at risk.

## Why this is P1 (not P3)

- Provider keys = real money (Stripe, OpenAI, etc.) and platform access.
- Once the first BYOK customer signs up, the window closes — backfill
  becomes mandatory and rotation becomes a customer-facing event.
- Every other Lane 4 audit assumes BYOK keys are encrypted at rest. If
  they aren't, the marketing copy on `/byok` and the privacy promise
  to enterprise customers is false.

## Solution menu

| Option | Pros | Cons |
|--------|------|------|
| **Supabase Vault** (pgsodium) | Native to stack; transparent at app layer; no app code changes for read path beyond join | Requires `pgsodium` extension enabled on Supabase project |
| App-level envelope encryption (AES-256-GCM + KMS) | Portable across DBs | More app code; KMS provider lock-in |
| HashiCorp Vault | Full-featured | Overkill at MVP scale |
| Stripe SetupIntent (for Stripe keys only) | Stripe-native | Doesn't cover OpenAI/Anthropic/Vapi/etc. |

**Recommendation: Supabase Vault.** Native to stack. Migration is small.
No app code changes for adapter call sites — only the BYOK
write/read paths in `byok/route.ts` and `gateway.ts`.

## Codex implementation ticket

**Ticket title:** [lane-4.36-impl] Encrypt user_provider_keys.api_key with Supabase Vault

**Branch:** `lane-4.36-impl-vault-byok`

**Scope:**

1. **Migration** (`migrations/lane-4.36-vault-byok.sql`):
   ```sql
   -- Enable Vault if not already enabled
   CREATE EXTENSION IF NOT EXISTS pgsodium;
   CREATE EXTENSION IF NOT EXISTS supabase_vault;

   -- Add secret_id column referencing vault.secrets
   ALTER TABLE user_provider_keys
     ADD COLUMN secret_id uuid REFERENCES vault.secrets(id) ON DELETE CASCADE;

   -- Drop the misleadingly named plaintext column AFTER write path is migrated
   -- (do this in a follow-up migration once 0 NULL secret_id rows remain)
   -- ALTER TABLE user_provider_keys DROP COLUMN api_key_encrypted;

   -- RLS on vault.secrets and vault.decrypted_secrets is already
   -- service-role-only by default. Confirm with:
   --   SELECT polrolname FROM pg_policies WHERE tablename='secrets' AND schemaname='vault';
   ```

2. **Write path** (`src/app/api/v1/byok/route.ts` POST):
   ```ts
   // Replace the upsert with: insert vault secret first, then upsert byok row
   const { data: secret, error: vErr } = await sb.rpc("create_byok_secret", {
     p_user_id: userId,
     p_tool_slug: tool_slug,
     p_api_key: api_key,
   });
   if (vErr) { /* return save_failed */ }
   ```

   New RPC `create_byok_secret(p_user_id uuid, p_tool_slug text, p_api_key text) returns uuid` SECURITY DEFINER:
   - Calls `vault.create_secret(p_api_key, name => format('byok_%s_%s', p_user_id, p_tool_slug))` returns secret_id
   - Upserts `user_provider_keys (user_id, tool_slug, secret_id, is_active=true, prefer_own_key=true)` ON CONFLICT (user_id, tool_slug) DO UPDATE SET secret_id = EXCLUDED.secret_id (and rotates the old vault secret via `vault.update_secret`)
   - GRANT EXECUTE ON FUNCTION create_byok_secret TO authenticated;
   - Returns the new secret_id

3. **Read path** (`src/lib/gateway.ts` resolveAdapterKey):
   ```ts
   // Replace the .from("user_provider_keys").select("api_key_encrypted") with:
   const { data: byokRow } = await sb0.rpc("get_byok_secret", {
     p_user_id: ctx.userId,
     p_tool_slug: adapter.slug,
   });
   if (byokRow) {
     resolvedKey = byokRow as string;
     keySource = "byok";
   }
   ```

   New RPC `get_byok_secret(p_user_id uuid, p_tool_slug text) returns text` SECURITY DEFINER:
   - Joins `user_provider_keys` to `vault.decrypted_secrets` on secret_id
   - Returns decrypted_secret if is_active = true AND prefer_own_key = true, else NULL
   - REVOKE EXECUTE FROM PUBLIC, anon
   - GRANT EXECUTE TO service_role only (called only from supabaseAdmin())

4. **Delete path** (`src/app/api/v1/byok/route.ts` DELETE):
   - Currently soft-deletes via `is_active = false`. Keep that.
   - **Also** call `vault.delete_secret(secret_id)` to make the plaintext
     unrecoverable. Add this to the same SECURITY DEFINER RPC pattern.

5. **Drift test** (already shipped this PR):
   `tests/unit/byok-plaintext-guard.test.ts` rejects any new file
   writing `api_key_encrypted: <plaintext>` outside the two known
   pre-fix offender files. After Codex ships the impl, the offender
   list shrinks to 0 and the test enforces forever.

6. **Verification**:
   - End-to-end: POST `/api/v1/byok` with a fake key → SELECT
     `api_key_encrypted` from anon → must return NULL.
   - SELECT `vault.secrets.secret` from anon → must return permission denied.
   - GET `/api/v1/byok` → must NOT include the key in response (column not selected — already correct).
   - Adapter call with BYOK enabled → must successfully decrypt and use.

7. **Out-of-scope for this ticket** (separate lane if needed):
   - Per-user encryption keys (tenant-scoped)
   - Key rotation UX in dashboard
   - Audit log of every decrypt event

**Estimated effort:** 3-4h for Codex (migration + 2 RPCs + 2 route patches + 1 vitest update).

## Drift prevention

`tests/unit/byok-plaintext-guard.test.ts` (2 tests):

1. Walks `src/`, looks for any `api_key_encrypted:` write outside the
   two known pre-fix files. Currently 0 offenders outside the
   allowlist → 1/1 test 1 pass. After Codex ships the impl, those
   files stop matching the pattern (they'll use `secret_id` instead),
   the allowlist shrinks, and the test enforces the new contract.
2. Stale-allowlist check: known-offender files must still exist on disk.

## Cross-references

- Hard Rule #34 — service_role JWT exposure pattern (sister threat).
- Lane 4.26 — service-role JWT bundle exposure audit (CLEAN).
- Lane 4.34 — RLS coverage on `user_provider_keys` (LOCKED).
- Lane 6.5 / 6.7 — BYOK runtime gate / verified BYOK list (the
  consumer of this storage; gate enforcement assumes encryption).
- Memory rule #59 — drift test scans source via regex.
