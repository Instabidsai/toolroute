# Lane 4.35 — Console Log Redaction Audit + Drift Test

**Status:** CLEAN — no credential or env-var leaks via `console.*` calls
**Audit date:** 2026-04-28

## Threat model

Vercel runtime logs are persisted ~7 days and readable by every team
member. Any `console.log`/`warn`/`error`/`info`/`debug` call that
interpolates a credential, JWT, bearer token, or `process.env.*_KEY`
becomes a long-lived disclosure to anyone with team access.

This sits next to:
- Lane 4.17 — `error_message` returned to API caller (CLEAN)
- Lane 4.18 — `redactCreds()` helper for outbound error bodies
- Hard Rule #34 — service_role JWT exposure pattern

`console.*` is the third leakage surface (after response body + DB
error_message column).

## Method

1. Static — grep `console\.(log|warn|error|info|debug)\(` across `src/`.
   33 call sites found.
2. Per-call inspection — what's interpolated/passed in the argument
   list?
3. Drift test — `tests/unit/console-redaction.test.ts` rejects any new
   call whose args reference a risky identifier (`apiKey`, `token`,
   `jwt`, `secret`, `password`, `bearer`, `authHeader`, `service_role`,
   `master_key`, etc.) as a bare reference, or any
   `process.env.*_KEY/SECRET/TOKEN`.

## Findings (33 call sites reviewed)

### What's actually logged

| Pattern | Count | Verdict |
|---------|-------|---------|
| `console.error("X error:", err)` (catch block) | 18 | SAFE — logs `Error` / `PostgrestError` objects, no creds |
| `console.error("X failed:", error.message)` | 4 | SAFE — Supabase RPC error.message |
| `console.error("X failed:", error)` | 2 | SAFE — Supabase error object (no row data) |
| `console.log(\`...${userId}...\`)` (webhook) | 7 | PII — user UUIDs + Stripe customer IDs (acceptable) |
| `console.log("Already processed payment:", session.payment_intent)` | 1 | SAFE — Stripe payment IDs (already in webhook payload) |
| `console.error("Stripe not configured")` | 1 | SAFE — static string |

### What's NOT logged

- ❌ No `process.env.*_KEY` interpolation
- ❌ No bearer token / `Authorization` header
- ❌ No `api_key` / `apiKey` value
- ❌ No JWT bodies
- ❌ No Stripe secret keys
- ❌ No request bodies containing credentials
- ❌ No password values

### Acceptable PII (noted, not flagged)

- **User UUIDs** — `userId` printed in webhook handlers for revenue
  debugging. Internal IDs, low risk on Vercel logs.
- **Stripe customer IDs** (`cus_...`) — printed in webhook handlers.
  Already visible to Stripe dashboard team.
- **Stripe payment IDs** — same.

These are acceptable for production debugging and consistent with
Stripe SDK's own logging behavior. If GDPR/CCPA scope grows, replace
`userId` with a shorter hash.

## Drift prevention

`tests/unit/console-redaction.test.ts` (1 test, regex-only per Hard
Rule #59):

- Walks all `.ts/.tsx/.js/.jsx` in `src/`.
- Captures every `console.*(...)` call's argument list with multi-line
  regex.
- Per call, checks for:
  - Direct `process.env.<RISKY_VAR>` reference (9 known env vars).
  - Bare identifier match (word-boundary) against 21 risky names:
    `apiKey`, `api_key`, `apikey`, `API_KEY`, `jwt`, `JWT`, `token`,
    `TOKEN`, `secret`, `SECRET`, `password`, `bearer`, `Bearer`,
    `authHeader`, `auth_header`, `service_role`, `SERVICE_ROLE`,
    `master_key`, `supabaseKey`, `anon_key`, `encryptionKey`.
- Fails with file:line + reason for every match.

Currently 0 findings → 1/1 pass on master.

## Cross-references

- Hard Rule #34 — `redactCreds()` for response bodies.
- Memory rule #59 — drift tests scan source via regex.
- Lane 4.17 — error_message audit (response-body equivalent).
- Lane 4.32 — hardcoded credential audit (source-tree equivalent).

## Note for future work (NOT in scope of this audit)

`src/app/api/v1/byok/route.ts:28` — `api_key_encrypted: api_key`
stores plaintext with `// TODO: encrypt with KMS`. This is a separate
finding (DB-at-rest encryption gap), not a logging gap. Track under a
new lane.
