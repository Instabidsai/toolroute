# Lane 4.64 — Starter credit policy drift audit (OAuth-vs-password path)

**Date:** 2026-04-28
**Author:** Claude (lane-4.64)
**Severity:** MEDIUM — small per-account financial leak ($1) + brand/policy inconsistency
**Sister lane:** Lane 6 (marketing copy honesty class)

## Finding

The starter-credit value granted to a new free-tier user is **defined in five places with three different values**:

| Source | Value | Path |
|--------|-------|------|
| `src/app/signup/page.tsx:230` (UI disclaimer) | "No starter credit grant while rate limiting is under audit" | The intended current policy |
| `src/app/api/v1/signup/route.ts:162` (password signup endpoint) | `credit_balance: 0` | Password signup ✓ matches policy |
| Welcome email body (`route.ts:85`) | "New accounts start with $0 credits" | Welcome email ✓ matches policy |
| `src/lib/gateway.ts:509` (OAuth auto-provision) | `credit_balance: 1.00` | **OAuth signup ✗ violates policy** |
| `src/app/pricing/page.tsx:128, 311` (marketing) | "$1 starter credits" | **Marketing ✗ violates policy** |
| `src/content/positioning-v2.md:42, 90, 235` (positioning copy) | "$1 starter credits" | **Marketing ✗ violates policy** |

## Why two paths

- **Password signup**: `/api/v1/signup` POST → handled by `src/app/api/v1/signup/route.ts` → explicit `credit_balance: 0` insert
- **OAuth signup** (Google via `/login` page): `supabase.auth.signInWithOAuth` → `/auth/callback` → first session-authed request triggers `getUserFromSession` in `gateway.ts` → if `gateway_users` row missing, auto-provision with `credit_balance: 1.00`

## Concrete user-impact

1. User reads `/pricing` claim "$1 starter credits"
2. User signs up via password form → gets $0 → confused, files support ticket OR
3. User signs up via Google OAuth → gets $1 → policy disclaimer on `/signup` was wrong for OAuth users
4. Two users on the same plan have different starting balances based purely on auth method — explainable as a bug, not as policy

## Financial leak math (small but real)

Even at $1/account, an attacker who scripts OAuth signups (Google accepts ~unlimited variations of `name+digit@gmail.com`, `name+digit2@gmail.com`, etc.) farms $1 of usable master-pool credit per account. At 10K signups → $10K of master-pool COGS exposure. The `is_active: true` API key from password signup is `tr_test_` prefix (not master-pool eligible) — but the OAuth gateway_users row doesn't restrict the API keys created from it the same way.

This is the same severity class as Lane 4.20 (idempotency) but smaller per-instance.

## Recommended fix

**Justin's call** which direction to align — but they MUST align. Two options:

### Option A — Tighten policy to $0 (matches signup-page disclaimer + welcome email)
1. `src/lib/gateway.ts:509`: change `credit_balance: 1.00` → `credit_balance: 0`
2. Update `src/app/pricing/page.tsx:128, 311`: remove "$1 starter credits" claim
3. Update `src/content/positioning-v2.md:42, 90, 235`: remove "$1 starter credits"
4. Add drift-prevention vitest (failing-snapshot, Hard Rule #59) asserting both signup paths grant equal amounts AND match the value in `STARTER_CREDIT_AMOUNT` constant

### Option B — Loosen policy to $1 (matches marketing)
1. `src/app/api/v1/signup/route.ts:162`: change `credit_balance: 0` → `credit_balance: 1.00`
2. `src/app/api/v1/signup/route.ts:85`: update welcome email text "$0" → "$1"
3. `src/app/signup/page.tsx:230`: remove "No starter credit grant" disclaimer
4. Same drift-prevention vitest as Option A

## Defense-in-depth additions (independent of A/B choice)

- **Single source of truth**: extract `STARTER_CREDIT_AMOUNT` constant to `src/lib/gateway-constants.ts` and import from both signup paths + welcome email
- **OAuth ToS gate**: password signup requires `accepted_tos: true`; OAuth signup auto-provisions `gateway_users` without recording assent. Per recent online-contract case law (Specht v. Netscape line) auto-provisioning without assent is legally weaker. Add a one-time post-OAuth ToS acceptance gate before first key issuance.
- **OAuth disposable-email check**: password signup runs `isDisposableEmail()` — OAuth path doesn't. Less abusable (Google doesn't issue email-only-disposable accounts) but still a class gap.

## Out-of-scope tail considerations

- **Existing OAuth users with $1 grant**: do not retroactively claw back; new policy is forward-only
- **Pricing-page edit**: Lane 6 marketing-copy domain — coordinate with /pricing rewrite if other claims are also being audited
- **Drift test fixtures**: parse the source files (regex/AST), do NOT import runtime modules — runtime modules would pull in `createClient` and crash without prod env (Hard Rule #59 / Lane 4.56 pattern)

## Status

- [x] Audit complete (this doc)
- [ ] Justin decides Option A or B
- [ ] Single-source-of-truth refactor (`gateway-constants.ts`)
- [ ] Drift-prevention vitest
- [ ] Marketing copy alignment (deferred to Lane 6)
- [ ] OAuth ToS gate (deferred — separate scope)
