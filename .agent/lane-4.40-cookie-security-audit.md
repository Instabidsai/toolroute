# Lane 4.40 — Cookie security helper + drift guard

**Branch:** `lane-4.40-cookie-security-audit`
**Base:** `master`
**Scope:** new `src/lib/cookie-security.ts`, refactor `src/app/auth/callback/route.ts`, new `tests/unit/cookie-security.test.ts`

## Why

Today the only call site that sets browser cookies is the OAuth callback at
`src/app/auth/callback/route.ts`, where it forwards Supabase SSR's `setAll`
payload directly to `response.cookies.set(name, value, options)`. The
`options` object comes from the `@supabase/ssr` library — and while
@supabase/ssr ≥ 0.5 *currently* sets `httpOnly`, `secure`, and `sameSite`
in production, that is a runtime characteristic of an upstream dependency:

- A future @supabase/ssr release could change defaults.
- A future call site (logout, "remember device", csrf token, settings flag)
  could land calling `response.cookies.set()` directly with looser flags.
- Reviewing every PR that touches cookies is brittle; a structural rule
  enforced by CI is not.

If `sb-access-token` ships without `httpOnly`, any stored-XSS in the app
can read it via `document.cookie` and exfiltrate the session — converting
an XSS into full account takeover. Without `secure`, MITM on any non-HTTPS
subdomain can grab it. Without `sameSite`, third-party POSTs can ride the
session.

## What changed

### 1. `src/lib/cookie-security.ts` — new helper

Two functions, both forcing the secure baseline regardless of caller:

```ts
setSecureCookie(response, name, value, options)
  → response.cookies.set with:
      httpOnly: true               (always — JS can't read)
      secure: options.secure ?? IS_PROD   (Vercel always HTTPS;
                                           local dev keeps cookies usable)
      sameSite: options.sameSite ?? "lax" (works for OAuth redirect-back)
      path: options.path ?? "/"
      ...all other caller options (domain, expires, maxAge) preserved

deleteSecureCookie(response, name, options)
  → response.cookies.set with maxAge:0, httpOnly:true, secure (in prod)
```

Lax (not Strict) is deliberate — Strict breaks OAuth redirect-back from
external IdPs, breaks magic-link verify from email clients, and breaks
Stripe Checkout success-page returns. Lax allows top-level cross-site
GETs to carry the cookie, which is the OAuth flow needs.

### 2. `src/app/auth/callback/route.ts` — refactor

```diff
+ import { setSecureCookie } from "@/lib/cookie-security";

  setAll(cookiesToSet) {
    cookiesToSet.forEach(({ name, value, options }) => {
-     response.cookies.set(name, value, options);
+     setSecureCookie(response, name, value, options);
    });
  },
```

Drift surface eliminated: even if @supabase/ssr ships a regression that
removes `httpOnly` from its options, our cookies still go out hardened.

### 3. `tests/unit/cookie-security.test.ts` — drift guard (4 assertions)

- `setSecureCookie` helper exists and contains httpOnly:true,
  sameSite:"lax" fallback, path:"/" fallback, secure:options.secure
  fallback.
- `deleteSecureCookie` helper exists, forces maxAge:0 + httpOnly:true.
- **No `.cookies.set(` call site anywhere in `src/` outside
  `src/lib/cookie-security.ts`.** Recursive walker scans `*.ts`/`*.tsx`,
  reports offending files with line numbers. Forces all future cookie
  writes through the helper.
- Auth callback route imports the helper and calls it.

## What this does NOT do

- Does **not** harden cookies that Supabase clients write client-side
  (e.g., `@supabase/supabase-js` without `@supabase/ssr`). Those run in
  the browser and we can't intercept their `document.cookie` writes.
  Acceptable: those tokens are scoped to the browser tab anyway and
  Supabase already sets reasonable flags in their browser SDK.
- Does **not** add CSP-level cookie protections (no `__Host-` prefix
  enforcement). `__Host-` would require dropping `domain` entirely,
  which conflicts with multi-subdomain Vercel preview URLs.
- Does **not** enforce `sameSite: "strict"` — Lax is required by the
  OAuth redirect-back flow.

## Threat model — what this closes

| Attack                                              | Pre  | Post  |
|-----------------------------------------------------|------|-------|
| Stored-XSS reads `sb-access-token` from `document.cookie` | ⚠️   | Blocked (httpOnly) |
| MITM on attacker-controlled http subdomain steals cookie  | ⚠️   | Blocked in prod (secure) |
| Cross-site CSRF rides session cookie on POST          | ⚠️   | Blocked (sameSite=lax — top-level GET only) |
| Future contributor adds `setLooseCookie()` call site  | ⚠️   | Drift test fails CI |
| @supabase/ssr regression removes httpOnly default     | ⚠️   | Belt-and-braces — helper still forces it |

## Drift surface — why the test matters

Today: 1 cookie call site (OAuth callback). Tomorrow: logout, device
trust, CSRF token, settings persistence, A/B test bucket, etc. Without
the test, every reviewer must manually check that each new
`response.cookies.set(...)` call passes httpOnly + secure + sameSite. With
the test, **only `cookie-security.ts` is allowed to call
`.cookies.set(`** — anywhere else fails CI with a precise file:line
report.

## Verification

```
npx vitest run tests/unit/cookie-security.test.ts   # 4/4 pass
npx vitest run tests/unit/                          # 26/26 pass on this branch
npx tsc --noEmit                                    # clean
```

## References

- Hard Rule #59 — failing-snapshot drift tests as canonical fix lists.
- Lane 4.37/4.38 — body-size DoS guards (sibling drift-test pattern).
- Lane 4.39 — security headers (the response-side companion to this
  cookie-side hardening).
- OWASP Session Management Cheat Sheet — cookie attribute recommendations.

## Follow-ups (do not block this PR)

- **Lane 4.41** — Cross-Origin isolation headers (COOP/COEP/CORP) once
  Stripe.js + Vercel preview compatibility verified.
- **Lane 4.42** — production-fetch test asserting `Set-Cookie` lines on
  `/auth/callback` actually carry the hardened flags (catches CDN
  strip-down regressions).
