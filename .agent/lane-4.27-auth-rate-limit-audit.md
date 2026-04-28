# Lane 4.27 — Auth/Signup Endpoint Rate-Limit Audit

**Status:** P3 finding — application-level rate limit absent on `POST /api/v1/signup`. Mitigated by Supabase platform throttling (admin createUser is rate-limited at the project level), Vercel edge DDoS protection, and zero-credit free accounts (no direct $-loss vector). Drift test pins existing input-validation gates so they cannot regress while a follow-up adds IP rate limiting.
**Severity:** P3 (no live $-loss vector; Resend send is gated post-account-creation, free credits = 0).
**Date:** 2026-04-28
**Sibling lanes:** 4.21 (CSRF immunity), 4.24 (open-redirect), 4.26 (service-role bundle).

## Auth surface

| Route | Method | Auth | Mutates? | Notes |
|-------|--------|------|----------|-------|
| `/api/v1/signup` | POST | none | yes (createUser + gateway_users + api_keys + Resend send) | Brute-force surface |
| `/auth/callback` | GET | code in querystring | yes (gateway_users upsert) | Single-use code; Supabase enforces |

No `/api/v1/login`, no `/api/v1/password-reset`. Supabase client SDK handles those flows directly from the `/login` page (browser → Supabase Auth REST). Browser-direct flows inherit Supabase's per-IP throttling for `signInWithPassword` / `resetPasswordForEmail`. Out of scope for this audit because there's no application-level surface to harden.

## Findings

### F-1 — `/api/v1/signup` has no application-level IP rate limit

```ts
// src/app/api/v1/signup/route.ts L85
export async function POST(request: NextRequest) {
  let body: SignupBody;
  try {
    body = (await request.json()) as SignupBody;
  } catch {
    return jsonError("Invalid JSON body", "invalid_json", 400);
  }
  // ... validation gates ...
  const sb = supabaseAdmin();
  const { data: authData, error: authError } =
    await sb.auth.admin.createUser({ ... });
```

No rate-limit check before `sb.auth.admin.createUser`. An attacker can:

1. **Email-enumerate** registered users via 409 `email_taken` vs 500 `auth_create_failed` differentiation (response codes leak existence).
2. **Bloat `auth.users`** with thousands of fresh accounts (mitigated by Supabase project-level admin rate limit, but admin endpoints often have higher ceilings than user-facing `signUp`).
3. **Burn Resend send-quota** (only AFTER successful auth.users insert — attacker controls only their own email if anything).

### F-2 — Email enumeration via response-code differentiation

```ts
// L132-142
if (lowerMessage.includes("already")) {
  return jsonError("Email already registered", "email_taken", 409);
}
if (lowerMessage.includes("password")) {
  return jsonError(message, "weak_password", 400);
}
return jsonError("Failed to create account", "auth_create_failed", 500);
```

`409 email_taken` distinguishes registered emails from unregistered. Standard anti-enumeration pattern is to return identical 200 OK + "if this email isn't already registered, we sent a verify link" regardless of registration status. ToolRoute trades this enumeration vector for clearer UX (toast: "Email already registered"). Documented as deliberate trade-off — drift test pins behavior so any future change is intentional.

### F-3 — Resend send is properly gated

```ts
// L189-195
const verifyUrl = await generateVerifyUrl(sb, email, ...);
await sendWelcomeEmail(email, verifyUrl).catch(() => false);
```

Email is sent ONLY after `createUser` + `gateway_users` insert + `api_keys` insert all succeed. An attacker cannot trigger emails to arbitrary third-party addresses by spamming this endpoint — the email is always sent to the address being registered. Bounce/complaint pressure stays self-targeted. ✅

### F-4 — No `/api/v1/login` to brute-force

Verified via grep: zero `signInWithPassword`, `resetPasswordForEmail`, `signInWithOtp` calls under `src/app/api/`. Login flows hit Supabase Auth REST directly from `/login` page. Supabase platform rate-limits these per-IP (~30/hour on signInWithPassword by default). Out of scope.

### F-5 — Existing front-line defenses pin behavior

The route's only protection layers today are:
- Email shape validation (`EMAIL_PATTERN`)
- Disposable-email blocklist (`isDisposableEmail`)
- Password length ≥ 8
- TOS-accepted boolean check
- Supabase platform rate limit on `auth.admin.createUser` (external)
- Vercel edge DDoS / abuse detection (external)

Drift test (Hard Rule #59) pins all 4 in-source gates so any future PR that removes one fails master.

## Threat model

| Threat | Today | After F-1 fix |
|--------|-------|---------------|
| Brute-force email enumeration via 409 | Yes (F-2) | Yes (intentional UX trade-off) |
| auth.users bloat | Mitigated by Supabase admin rate limit | Hard-stopped at IP layer |
| Resend send-quota abuse | Self-targeted only (F-3) | Self-targeted only |
| Disposable email floods | Blocked at app layer | Blocked at app layer |
| Weak-password account creation | Blocked at app layer | Blocked at app layer |
| Spam-account credit drain | $0 (free plan starts at 0 credits) | $0 |

Net: no live $-loss vector. P3 because the bloat + enumeration vectors are real but bounded.

## Recommended follow-up (out of scope for this PR)

**Codex ticket:** `lane-4.27-impl-ip-rate-limit-on-signup`

Add a DB-backed IP rate limit table:

```sql
CREATE TABLE signup_attempts (
  ip_address inet NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  outcome text NOT NULL CHECK (outcome IN ('success','validation_fail','auth_fail','rate_limited'))
);
CREATE INDEX signup_attempts_ip_recent_idx
  ON signup_attempts (ip_address, attempted_at DESC);
```

Then in route handler:
```ts
const ip = getClientIP(request); // x-forwarded-for first hop or x-real-ip
const { count } = await sb.from("signup_attempts")
  .select("*", { count: "exact", head: true })
  .eq("ip_address", ip)
  .gte("attempted_at", new Date(Date.now() - 5 * 60_000).toISOString());
if ((count ?? 0) > 5) {
  await sb.from("signup_attempts").insert({ ip_address: ip, outcome: "rate_limited" });
  return jsonError("Too many signup attempts. Try again in 5 minutes.", "rate_limited", 429);
}
```

Alternative path: Vercel Edge Middleware + KV — less infra in DB, but adds Vercel KV dep. DB path keeps everything in Supabase + observable in admin dashboard.

Out of scope for this audit because:
1. F-1 is a P3 finding — Supabase platform throttling + Vercel edge cover the catastrophic case.
2. Adding a `signup_attempts` table + observability dashboard is its own PR with schema migration + admin view + alerting.
3. This audit's job is to lock the property "input-validation gates exist" before ANY future PR can quietly remove them. F-1 fix is recommendation-only.

## Drift prevention — vitest

`tests/unit/auth-rate-limit-shape.test.ts` (Hard Rule #59) asserts:

1. **Input-validation gates exist on `/api/v1/signup`** — email pattern check, disposable email block, password length, TOS acceptance.
2. **Auth route count is bounded** — only `/api/v1/signup` exists as an unauthenticated mutation; if a new auth-class route is added (login/password-reset/etc.) the test must be updated to cover it.
3. **No `/api/v1/login` route exists** — drift catches accidental introduction of a login endpoint without rate-limiting.
4. **Resend send stays gated behind successful account creation** — `sendWelcomeEmail` call site appears AFTER `createUser` + `gateway_users` insert.

Test fails master if anyone:
- Removes the disposable-email blocklist
- Removes the email shape regex
- Reduces password minimum below 8
- Drops the TOS check
- Adds a login/password-reset/OTP route under `src/app/api/v1/` without updating the audit
- Moves `sendWelcomeEmail` call before `createUser` (would let attackers spam emails to arbitrary addresses)

## Cross-applies to

Same audit on every Justin product with public signup:
- **CallTwin** — magic-link signup endpoint
- **DropClose** — signup + Vapi onboarding
- **AffixedAI** — Stripe-customer signup flow
- **JarvisCRM** — auto-generated signup/onboarding
- **PureUSPeptide2** — WooCommerce checkout (different threat model — payment gates rate)
- **PeptideAI** — admin signup
- **VibeArmor** — bug-bounty / paid scan signup

10-min audit per product:
```bash
grep -rln "auth.admin.createUser\|signInWithPassword\|resetPasswordForEmail" src/app/api
# For each match: verify rate limit before the call, OR document the trade-off + drift-test the validation gates.
```

## Conclusion

`/api/v1/signup` lacks application-level IP rate limiting but is structurally defended by Supabase platform throttling, disposable-email blocklist, and zero-credit free plan. P3 — no live $-loss vector. Drift test pins front-line input gates so future regressions fail CI. F-1 fix tracked as Lane 4.27-impl Codex ticket.
