# Lane 4.38 — Body-Size Guards Extended to Remaining 11 Routes

**Severity:** P2 (cost amplification + admin defense-in-depth)
**Status:** All 12 high-traffic body-parsing routes now guarded.
**Audit date:** 2026-04-28
**Stacked on:** Lane 4.37 (PR #57)

## What this PR does

Lane 4.37 shipped the `assertBodyUnder` helper + `BODY_LIMITS` map and
guarded the 3 highest-risk public routes (`/execute`, `/mcp`, `/a2a`).

This PR closes the rest of the per-route limit table from that audit:

| Route | Limit | Why this size | Body parser |
|-------|-------|---------------|-------------|
| POST/DELETE `/api/v1/byok` | 16 KB | tool_slug + api_key | `request.json()` ×2 |
| POST/DELETE/PATCH `/api/v1/keys` | 4 KB | name + allowed_tools list | `request.json()` ×3 |
| POST `/api/v1/signup` | 8 KB | email + password + flags | `request.json()` |
| POST `/api/v1/checkout` | 4 KB | type + plan slug | `request.json()` |
| PATCH `/api/v1/settings` | 4 KB | auto-topup config keys | `request.json()` |
| POST `/api/admin/providers` | 16 KB | provider config row + key | `request.json()` |
| POST `/api/v1/registry/usage` | 8 KB | usage_event row | `request.json()` |
| POST `/api/v1/registry/request` | 8 KB | tool-request row | `request.json()` |
| POST `/api/v1/registry/challenge` | 8 KB | 8-dim score map | `request.json()` |
| POST `/api/check` | 4 KB | task description | `request.json()` |
| POST `/api/webhooks/stripe` | 64 KB | Stripe-signed payload | `request.text()` |

## Threat model

The Lane 4.37 doc covered the public/api-key routes. These follow-up
routes are session-authed or admin-authed except for two:

1. **`/api/v1/signup`** — anonymous-callable. Cost amplifier here is
   the Supabase auth.admin.createUser → gateway_users insert →
   api_keys insert sequence + a Resend email send. Cap at 8 KB.
2. **`/api/webhooks/stripe`** — Stripe-signed. Forged bodies are
   rejected at signature verification, so this is defense-in-depth
   only. Stripe webhook payloads are ~10 KB typical, ~32 KB
   pathological. 64 KB cap leaves headroom.
3. **`/api/admin/providers`** — admin-only (timingSafeEqual on
   `x-admin-secret`). Insider-threat / leaked-secret defense.
4. **`/api/v1/registry/*`** — paid API key + `checkRateLimit` already
   gates these. Adding a body cap closes the cost-per-row inflation
   vector (a stolen key spamming GiB-sized usage events would burn
   through `record_usage` RPC time).

## Drift test changes

Replaced single-route check in `tests/unit/body-size-guard.test.ts`
with a 14-entry `REQUIRED_GUARD_ROUTES` table and a smarter assertion:

- Old: assert one `assertBodyUnder` exists before one `request.json()`.
- New: assert `count(assertBodyUnder) >= count(body-parse)` per file
  AND first guard precedes first parse. Now catches a multi-handler
  route where someone adds a 4th handler that parses a body without
  guarding it.

The test now also matches `request.text()` and `request.formData()`,
not just `request.json()`. That's how the Stripe webhook is covered.

## Vitest result

```
Test Files  1 passed (1)
     Tests  18 passed (18)
```

3 helper tests + 14 per-route tests + 2 functional tests.

## TypeScript

`npx tsc --noEmit` — clean.

## Cross-references

- Lane 4.37 (PR #57) — original helper + 3 high-risk routes.
- Hard Rule #59 — drift test scans source via regex, only the 2
  functional tests dynamic-import the helper module (no prod-env
  dependency).
- Hard Rule #58 — pre-lockdown audit of anon-client server reads (the
  body cap is a sibling defense — limits cost per request, RLS limits
  what a stolen key can read).

## Next concrete follow-ups (out of scope for this PR)

- Lane 4.39 — security headers audit (CSP/HSTS/X-Frame-Options) on
  next.config.ts middleware.
- Lane 4.40 — TOCTOU audit on credit deduction (already partially
  closed by Lane 4.23 UNIQUE on credit_transactions).
- Lane 4.41 — integer-overflow / negative-amount audit on
  add_credits / deduct_credits RPCs.
