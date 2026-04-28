# Lane 4.24 — Open-Redirect Audit on Auth/Checkout Callbacks

**Status:** 1 P3 patched (signup verify URL), 3 already CLEAN, drift test shipped.
**Severity:** P3 — class is account-takeover via verify-link redirect, but exploitable only if Supabase redirect-URL allowlist is wildcarded.
**Date:** 2026-04-28

## TL;DR

Audited 4 redirect-class call sites in `/api` and `/auth`. Three already use hardcoded `"https://toolroute.ai"` as the origin (matching the established codebase pattern — see `health/route.ts`, `stripe-dunning.ts`). One — `signup/route.ts` — was using `new URL(request.url).origin` to build the magic-link verify URL. Patched to match.

## Sites audited

| Site | URL kind | Origin source | Status |
|------|----------|---------------|--------|
| `src/app/api/v1/checkout/route.ts:51` | Stripe `success_url` / `cancel_url` | `const origin = "https://toolroute.ai"` (hardcoded) | CLEAN |
| `src/app/api/v1/billing/setup-payment/route.ts:6` | Stripe `success_url` / `cancel_url` | `const CHECKOUT_ORIGIN = "https://toolroute.ai"` (hardcoded) | CLEAN |
| `src/app/api/v1/signup/route.ts:192` (before) | Supabase `auth.admin.generateLink → redirectTo` | `new URL(request.url).origin` (request-derived) | **P3 — patched** |
| `src/app/auth/callback/route.ts:14,19,39` | Internal `NextResponse.redirect` after auth exchange | `requestUrl.origin` for path joining only — destination paths are hardcoded literals (`/dashboard`, `/login?...`) | CLEAN — same-origin path joining is safe |

## Why signup was P3 (not P1)

Three things must align for exploit:
1. Attacker must reach `POST /api/v1/signup` from a host they control (Vercel preview, custom CNAME pointed at the project, or DNS-rebound subdomain).
2. Supabase project's "Redirect URLs" allowlist must include that host (wildcards like `*.vercel.app` or `*` make this trivial).
3. Attacker must convince a target to sign up via the attacker-controlled host.

If any of those fails, the magic link still goes out — but it either redirects to toolroute.ai (Supabase rewrites to default) or fails entirely.

The fix removes step 1 — the verify URL is always `https://toolroute.ai/auth/callback` regardless of what host the API request came from.

## What changed

`src/app/api/v1/signup/route.ts`:

```diff
-function getRequestOrigin(request: NextRequest) {
-  return new URL(request.url).origin;
-}
+const VERIFY_ORIGIN = "https://toolroute.ai";
+
+function getVerifyOrigin(_request: NextRequest) {
+  return VERIFY_ORIGIN;
+}
```

```diff
   const verifyUrl = await generateVerifyUrl(
     sb,
     email,
-    `${getRequestOrigin(request)}/auth/callback`
+    `${getVerifyOrigin(request)}/auth/callback`
   );
```

Function signature kept (still takes `_request: NextRequest`) so callers don't need updating and the indirection is preserved if we ever need env-aware origin selection (production vs. staging).

## Sibling check Justin should verify (out of scope here)

Even with this patch, the Supabase redirect-URL allowlist is the second line of defense. Justin: confirm in the Supabase dashboard (Authentication → URL Configuration) that:

- **Site URL** = `https://toolroute.ai`
- **Redirect URLs** allowlist contains ONLY `https://toolroute.ai/**` and (if needed) explicit dev URLs. **Not** `*` or `*.vercel.app`.

If the allowlist is wildcarded and someone reverts this patch in a future PR, the takeover path reopens. The drift test ships in this PR; the allowlist tightness is one Justin-side dashboard check.

## Drift prevention — vitest

`tests/unit/open-redirect-shape.test.ts` (Hard Rule #59) asserts:

1. **No v1 route uses request-derived host data with a redirect sink.** Specifically: no file that has `success_url`/`cancel_url`/`redirectTo`/`generateLink`/`emailRedirectTo` may also have `new URL(request.url).origin`, `request.headers.get("host")`, or `request.headers.get("x-forwarded-host")`.
2. **Checkout** still has `const origin = "https://toolroute.ai"` and uses it for both Stripe URLs.
3. **Setup-payment** still has `const CHECKOUT_ORIGIN = "https://toolroute.ai"` and uses it.
4. **Signup** still has `const VERIFY_ORIGIN = "https://toolroute.ai"` and does NOT use `new URL(request.url).origin`.

Test fails master if anyone reintroduces request-host trust on a redirect-class endpoint.

## Cross-applies to

Same audit on every Justin product that uses Supabase magic links or Stripe checkout:

- **CallTwin** — magic-link signup
- **DropClose** — magic-link signup
- **AffixedAI** — Stripe checkout flows
- **JarvisCRM** — auto-generated signup pages (highest risk — generators tend to copy `request.url`)
- **PureUSPeptide2** — checkout + customer account verify
- **PeptideAI** — internal auth flows

5-min audit per product:
```bash
grep -rn 'new URL(request\.url)\.origin\|request\.headers\.get("host")' src/app/api src/app/auth | \
  grep -lE 'success_url|cancel_url|redirectTo|generateLink|emailRedirectTo'
```

Any file that matches BOTH gets a hardcoded-origin replacement.

## Conclusion

Open-redirect exposure on the financial-gateway auth/checkout surface is closed. The drift test prevents reintroduction. The Supabase allowlist remains as a sibling check Justin can verify.
