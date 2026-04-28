# Lane 4.42 — `NEXT_PUBLIC_*` envvar discipline audit

**Status:** CLEAN. All `NEXT_PUBLIC_*` references in `src/` are in the safe allowlist (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `STRIPE_PUBLISHABLE_KEY`). Drift guard added so a future `NEXT_PUBLIC_OPENAI_KEY` (or similar) fails CI.
**Severity:** P0 leak class if violated (NEXT_PUBLIC_* ships to client bundle, so any secret prefixed this way is public).
**Date:** 2026-04-28
**Sibling lanes:** 4.12 (master/BYOK key leak), 4.32 (hardcoded creds), 4.35 (console redaction), 4.36 (BYOK plaintext storage).

## Threat model

Next.js inlines every `process.env.NEXT_PUBLIC_*` reference into the static client bundle at build time. Any secret prefixed `NEXT_PUBLIC_` is therefore:
- visible in browser DevTools → Network → JS chunks
- visible in the `.next/static/` bundle on disk
- visible in any Vercel preview deployment URL
- impossible to rotate without rebuilding

The class of mistake is "developer copies a server envvar, mistypes the prefix, and ships a P0." This audit pins which `NEXT_PUBLIC_*` vars are intentionally public; everything else is a leak.

## Allowlist

| Var | Why public is correct |
|-----|------------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL is public; RLS gates row access. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon JWT is designed to be public — Supabase's RLS model assumes attacker has it. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe's `pk_live_*` / `pk_test_*` is designed for client-side; it can only create payment methods, not move money. |

## Inventory

`grep -rn 'NEXT_PUBLIC_' src/` → 12 references across 7 files. Every reference is in the allowlist. No `process.env.NEXT_PUBLIC_OPENAI_KEY`, `NEXT_PUBLIC_RESEND_KEY`, `NEXT_PUBLIC_FIRECRAWL_KEY`, etc.

`.env.local` shipped vars match: only the 3 allowlisted entries.

## Drift guard

`tests/unit/next-public-envvar-allowlist.test.ts` — walks `src/**/*.{ts,tsx}`, regexes every `process.env.NEXT_PUBLIC_<NAME>`, asserts `<NAME>` is in the allowlist. Adding a new `NEXT_PUBLIC_FOO_API_KEY` reference fails CI loudly with the variable name and file path.

To add a new public var: edit the `ALLOWED` set at the top of the test, justify why public is correct, ship the change.

## What this audit does NOT cover

- Whether server-only envvars (`STRIPE_SECRET_KEY`, `OPENAI_API_KEY`, etc.) are accidentally referenced in client components — that's a separate "server-only fence" audit.
- Whether `next.config.ts` `env:` block exposes server vars under public names — checked manually, currently empty.
- Vercel project envvar classification (Production/Preview/Development scoping). Manual review only.

## Verification

```bash
npx vitest run tests/unit/next-public-envvar-allowlist.test.ts
# Test Files  1 passed (1)
# Tests       1 passed (1)
```

## Sibling rules
- Hard Rule #54 — Supabase showcase-page hardcoded-JWT pattern (different class — JWTs in source, not envvars)
- Hard Rule #59 — failing-snapshot test as drift TODO
