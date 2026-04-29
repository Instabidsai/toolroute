# Lane 4.106 — `tool_providers.auth_key_encrypted` is plaintext + anon-readable (AMBIGUOUS); sister to Lane 4.36 BYOK

**Owner:** Claude (auditor)
**Started:** 2026-04-28
**Severity:** HIGH-LATENT (column is plaintext today; table empty so anon-read returns `[]` — AMBIGUOUS per Memory rule #56)
**Sibling:** Lane 4.12 (master-key-leak audit) → Lane 4.36 (BYOK plaintext, task #51 done / #52 Codex pending) → **Lane 4.106 (master-pool side of same class)**

## TL;DR

Master-pool provider API keys are stored **plaintext** in `tool_providers.auth_key_encrypted` despite the column name. Two code paths converge on this:

1. **Write path:** `src/app/api/admin/providers/route.ts:59, 96` — POST/PATCH writes `auth_key_encrypted: api_key` directly with no encryption call.
2. **Read path:** `src/lib/gateway.ts:271-282` — gateway reads `auth_key_encrypted` and passes it as the literal `resolvedKey` to the upstream provider HTTP call.

**Live anon probe (this session):** `GET /rest/v1/tool_providers?select=auth_key_encrypted` returned `HTTP 200 []`. The `[]` is because the table is currently empty in prod, **NOT** because RLS denies the read. This is the AMBIGUOUS state from Memory rule #56 — first inserted row leaks publicly.

**Class match to Lane 4.36:** BYOK column (`user_provider_keys.api_key_encrypted`) also plaintext (task #51 closed; #52 Codex impl ticket pending). Master-pool side of same class — same fix substrate (Vault/KMS) but **different recommendation** because of Lanes 4.100/4.101/4.102/4.103/4.104/4.105 + Lane 6.14 trajectory: master-pool storage shouldn't exist post-BYOK-gate.

## File:line evidence

### Write path — `src/app/api/admin/providers/route.ts:59`
```typescript
.from("tool_providers")
.upsert({
  tool_slug,
  provider_name,
  auth_type,
  auth_key_encrypted: api_key,  // ← plaintext write
  ...
```

### Write path — same file:96 (PATCH)
```typescript
const updateBody: Record<string, unknown> = {};
if (api_key !== undefined) updateBody.auth_key_encrypted = api_key;  // ← plaintext write
```

### Read path — `src/lib/gateway.ts:271-282`
```typescript
const { data: providerRow } = await sb0
  .from("tool_providers")
  .select("auth_key_encrypted, cost_per_call, cost_model, markup_percent")
  .eq("tool_slug", slug)
  .eq("operation", op)
  .maybeSingle();
if (providerRow?.auth_key_encrypted) {
  resolvedKey = providerRow.auth_key_encrypted;  // ← plaintext passthrough as bearer
  keySource = "master";
}
```

No decrypt call between read and use. The "_encrypted" suffix is a naming lie.

### Live anon probe (2026-04-28)
```
GET https://isbratmfnnzipzyoefbo.supabase.co/rest/v1/tool_providers?select=auth_key_encrypted
Authorization: Bearer <anon-jwt>
→ HTTP 200
→ []
```

Empty body confirms PostgREST allowed the read; the result set is empty because the table currently has no rows. **Per Memory rule #56**, this is AMBIGUOUS, NOT LOCKED. The first row inserted via `/api/admin/providers` POST becomes anon-readable plaintext.

## Threat model

### Today (table empty)
- No active leak. Adapters fall through to `process.env.X_API_KEY` env vars (Lane 4.100 inventory). The DB-driven master-pool path is unused.

### After first insert (any timeframe)
- Justin or admin POSTs to `/api/admin/providers` with `{tool_slug, provider_name, api_key: "sk-..."}` to migrate one provider from env-var to DB-row config.
- Anon caller of `/rest/v1/tool_providers?select=auth_key_encrypted` gets the plaintext key in the response body.
- One row = one credential leak. N rows = N credential leaks.

### Concrete leak vector
```
curl -s 'https://isbratmfnnzipzyoefbo.supabase.co/rest/v1/tool_providers?select=tool_slug,provider_name,auth_key_encrypted' \
  -H "apikey: $TR_ANON" -H "Authorization: Bearer $TR_ANON"
```
Returns the master-pool credential pool to any caller knowing the project URL. ToolRoute's anon JWT is in `CLAUDE.md` (skill bundle) — not secret in any meaningful sense. Project URL is a subdomain of supabase.co — discoverable.

## Why this is independent of (but related to) Lane 4.36

Lane 4.36 closed the **user-controlled** plaintext (BYOK keys). The fix path there: encrypt-at-rest with Supabase Vault, store ciphertext in `user_provider_keys.api_key_encrypted`, decrypt on gateway read.

Lane 4.106 is the **provider-controlled** plaintext (master-pool keys). The fix path **diverges**:

- **Lane 4.100** P0 — yank `ANTHROPIC_API_KEY` + `OPENAI_API_KEY` from Vercel prod (Justin owns).
- **Lane 4.101** — universal BYOK gap; master-pool fall-through is broken-by-design for Class-A.
- **Lane 4.102** — 13 Class-A adapters (owner-scoped); master-pool credentials write to ToolRoute's accounts not user's.
- **Lane 4.103** — catalog amplifies the moment any Class-A env var is set.
- **Lane 4.104** — github PAT scope-ambient leak.
- **Lane 6.14** — 18/28 providers ToS-forbidden for resale; their adapters slated for deletion.

Trajectory: post-Codex #23 BYOK gate ships, master-pool storage **shouldn't exist** for the Class-A or ToS-forbidden cohorts. So encrypting `auth_key_encrypted` in-place is the wrong reflex — most rows that would land there are rows that shouldn't land there at all.

## Mitigation options

### Option 1 — Lock the table from anon (defense-in-depth, ship now)
```sql
REVOKE SELECT ON public.tool_providers FROM anon;
REVOKE SELECT ON public.tool_providers FROM authenticated;
```
Sibling to the Lane 4.96/4.97/4.98/4.99 REVOKE chain. Server-side gateway reads use service-role — unaffected. **Cheap, ships today, closes the AMBIGUOUS state.**

### Option 2 — Delete the admin POST/PATCH endpoint until BYOK-gate + Lane 6.14 land
`/api/admin/providers` is the only writer. Removing it (or returning 410 Gone) prevents accidental insertion until the post-BYOK-gate architecture clarifies whether `tool_providers` rows are ever needed.

### Option 3 — Vault encryption (mirror Lane 4.36, do AFTER #23 gate ships)
If post-gate review concludes `tool_providers` rows should still exist (compute-class adapters where master-pool is a legitimate cost-arbitrage), then encrypt the column the same way Codex #52 will encrypt the BYOK column. Single Vault key, decrypt-on-read in gateway. Heavier; deferred.

**Recommendation:** Option 1 immediately (REVOKE) + Option 2 short-term (disable admin writers). Option 3 only if the post-gate architecture preserves master-pool storage for any class.

## Why this isn't catastrophic *yet* (severity HIGH-LATENT, not HIGH)

1. **Table is empty in prod today.** Confirmed via anon SELECT returning `[]`.
2. **Master-pool fall-through path** in gateway.ts is dead-code-equivalent today — no rows means the `if (providerRow?.auth_key_encrypted)` branch never fires.
3. **Adapters use env vars**, not the DB row, for current master-pool usage (Lane 4.100 inventory: 13 adapters with env-var fall-through, 0 reading from `tool_providers`).

The **moment** any of those changes (admin endpoint POST, migration script, "let's move config to DB"), severity flips to HIGH active leak.

## Why it's still worth fixing (vs. just documenting)

1. **AMBIGUOUS → LEAK transition is a one-line POST away.** No alarm fires when Justin or a Codex agent migrates env-var config to DB rows. The "but we'll remember to encrypt before inserting" memory model has lost every battle in this codebase (BYOK: Lane 4.36).
2. **REVOKE is one-line SQL** that closes the leak class without depending on Codex #23/#52 timing.
3. **Naming lies are tech-debt magnets.** `auth_key_encrypted: api_key` will get copy-pasted as a template by future code. Defuse the column-as-plaintext today, force the next writer to confront the encryption decision.

## Acceptance for this audit memo

- [x] `src/app/api/admin/providers/route.ts` read in full — confirmed plaintext write at 59 + 96
- [x] `src/lib/gateway.ts:240-289` read — confirmed plaintext read + passthrough at 271-282
- [x] Live anon probe on `tool_providers?select=auth_key_encrypted` — HTTP 200 + `[]` (AMBIGUOUS)
- [x] Lane 4.12 prior audit cross-referenced — both columns named "_encrypted" but plaintext, Lane 4.12 acknowledged this in code-comment form, no fix shipped
- [x] Lane 4.36 (BYOK side) cross-referenced — task #51 done, #52 Codex impl pending — same class, divergent fix path
- [ ] Codex: REVOKE SELECT on `tool_providers` from anon + authenticated (one-line SQL migration, sibling to Lane 4.96-4.99 REVOKE chain)
- [ ] Codex: gate `/api/admin/providers` POST/PATCH behind 410 Gone OR feature flag until post-Codex #23 architecture review concludes master-pool storage needed
- [ ] Codex (deferred): if Option 3 chosen post-gate, mirror Codex #52 Vault encryption pattern on `tool_providers.auth_key_encrypted`

## Why this matters for /loop directive

The /loop goal is "production-ready financial gateway." A column named `auth_key_encrypted` storing plaintext is the kind of tech-debt that ships unnoticed because the naming convinces every reader the encryption is happening upstream. Lane 4.36 closed the user side of this class via Codex ticket #52. Lane 4.106 closes the provider side — but with a **different fix recommendation** because the post-BYOK-gate architecture no longer wants master-pool storage for the Class-A or ToS-forbidden cohorts.

REVOKE on anon is the cheap shim that ships in hours. The architectural cleanup (delete the endpoint, delete the column, delete the fall-through path) ships post-Codex #23.
