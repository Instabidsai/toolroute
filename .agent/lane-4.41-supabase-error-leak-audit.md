# Lane 4.41 — Supabase RPC error.message leak audit + drift guard

**Branch:** `lane-4.41-supabase-error-leak-audit`
**Base:** `master`
**Scope:** 3 registry routes, new `tests/unit/supabase-error-leak.test.ts`

## Why

Three registry routes returned `error.message` from Supabase RPC failures
directly to API clients:

- `src/app/api/v1/registry/challenge/route.ts:65-68`
- `src/app/api/v1/registry/request/route.ts:38-43`
- `src/app/api/v1/registry/usage/route.ts:46-51`

Pattern was:
```ts
const { data, error } = await sb.rpc("challenge_tool", {...});
if (error) {
  return NextResponse.json(
    { error: { message: error.message, code: "rpc_error" } },
    { status: 500, headers: CORS_HEADERS }
  );
}
```

Supabase RPC error messages can carry information that should not leak to
authenticated-but-untrusted API key holders:

- **Function signature mismatches** — `function challenge_tool(text, text,
  jsonb) does not exist` reveals RPC argument types and tells an attacker
  exactly what parameter shapes the brain expects.
- **RLS rejection details** — `new row violates row-level security policy
  "users_can_only_read_own"` reveals policy names and structure. The
  attacker now knows which policies exist and can target their gaps.
- **Postgres error codes** — `duplicate key value violates unique
  constraint "credit_transactions_stripe_payment_id_unique"` reveals
  table names, constraint names, and column relationships.
- **Type coercion failures** — `invalid input syntax for type uuid:
  "abc"` reveals column types.
- **Connection-pool / timeout** — `canceling statement due to statement
  timeout` reveals infrastructure characteristics.

None of these are catastrophic on their own. Together they're a recon
gold mine for an attacker mapping out the substrate before a targeted
exploit.

## What changed

### 1. Three routes — replace raw error.message with generic message

```diff
  if (error) {
+   console.error("registry/<route> RPC error:", error.message);
    return NextResponse.json(
-     { error: { message: error.message, code: "rpc_error" } },
+     { error: { message: "<Op> failed", code: "rpc_error" } },
      { status: 500, headers: CORS_HEADERS }
    );
  }
```

The full error message is preserved server-side via `console.error` so
ops still has full visibility for debugging — but the client only sees
the stable `code: "rpc_error"` plus a generic message.

Per Hard Rule #34/#35 (`redactCreds` helper, console-log redaction
audit), `error.message` is unlikely to contain credentials — it's
substrate metadata, not secrets. So `console.error(error.message)` is
safe in our log pipeline.

### 2. `tests/unit/supabase-error-leak.test.ts` — drift guard

Recursive walker over `src/app/api/**/route.{ts,tsx}` flagging any line
matching `message:\s*error\.message`. The pattern is precise:

- **Forbidden:** `message: error.message` — `error` is the destructured
  field from `const { data, error } = await sb.rpc(...)`. Always
  Supabase-shaped. Always leaks.
- **Allowed:** `message: err.message` — `err` is the catch-block
  parameter where we've already narrowed via `instanceof GatewayError`.
  Those are *our* error messages with stable codes; safe to surface.

The naming convention (`error` for Supabase, `err` for catch) is
consistent across the codebase — the test enforces it as a structural
boundary.

Smoke test: scanner found > 5 route files, guarding against a
zero-files false-pass if the API tree is moved or renamed.

## What this does NOT do

- Does **not** redact `err.message` from caught exceptions. Those go
  through `instanceof GatewayError` narrowing first, so only our crafted
  messages are returned.
- Does **not** audit non-API surfaces (server components, edge
  functions, mcp-server). The test scope is `src/app/api/`. Other
  surfaces have different leak boundaries (server components don't
  return JSON; mcp-server has its own error envelope).
- Does **not** mask Supabase auth errors (e.g., signup `auth.admin
  .createUser` errors still surface "Email already registered"). Those
  are deliberately surfaced because the user needs them for UX —
  unrelated to substrate leakage. Email-enumeration concerns there are a
  separate Lane 4.42 candidate.

## Threat model — what this closes

| Recon technique                                     | Pre  | Post |
|-----------------------------------------------------|------|------|
| Probe RPC signature via deliberate type mismatch    | ⚠️   | Blocked (generic 500) |
| Map RLS policies via crafted insert/update          | ⚠️   | Blocked |
| Enumerate constraint names by triggering uniqueness violations | ⚠️ | Blocked |
| Detect statement-timeout to identify slow paths     | ⚠️   | Blocked |
| Future contributor adds new route returning error.message | ⚠️ | Drift test fails CI |

## Drift surface — why the test matters

Today: 0 offenders (after this PR). Future contributors writing new
registry routes will copy the same `if (error) { return ... error.message }`
pattern by muscle memory. Drift test catches it on the first PR that
introduces the pattern.

## Verification

```
npx vitest run tests/unit/supabase-error-leak.test.ts   # 2/2 pass
npx vitest run tests/unit/                              # 24/24 pass
npx tsc --noEmit                                        # clean
```

## References

- Hard Rule #34/#35 — console-log redaction (precondition: full error
  text is safe to log server-side because creds are already redacted).
- Hard Rule #59 — failing-snapshot drift tests as canonical fix lists.
- Lane 4.17/4.18 — error_message audit + redactCreds helper (sibling
  effort; this lane closes the *response-side* leak that 4.18 didn't
  cover).
- OWASP ASVS V8.3.4 — Verify that error responses do not contain
  sensitive information.

## Follow-ups (do not block this PR)

- **Lane 4.42** — email-enumeration audit on signup/login/password-reset.
  The signup route deliberately returns "Email already registered"
  (`email_taken`, 409) — this is a UX trade-off needing Justin's call.
- **Lane 4.43** — mcp-server error envelope audit (separate scope —
  different surface, different rules).
