# Lane 4.39 — Security headers audit + drift guard

**Branch:** `lane-4.39-security-headers-audit`
**Base:** `master`
**Scope:** `next.config.ts` global headers block, `tests/unit/security-headers.test.ts`

## Why

ToolRoute is a financial gateway (paid API, Stripe, BYOK provider keys).
The site already shipped 4 of the 6 standard hardening headers in
`next.config.ts`, but two were missing:

1. **`Content-Security-Policy`** — without it, an injected script tag, an
   embedded SVG, or a stored-XSS payload can exfiltrate session cookies or
   API keys to any external origin. CSP is the single biggest XSS
   blast-radius reducer.
2. **`Permissions-Policy`** — without it, a compromised or embedded asset
   can silently request camera/microphone/geolocation/USB. Low priority for
   our app today, but free to lock down and required for SOC 2 readiness.

There is also nothing structural enforcing that the **existing** four
headers stay configured — a stray refactor of `next.config.ts` could
silently delete `X-Frame-Options` or weaken HSTS without anyone noticing
until an external scan flagged it.

## What changed

### 1. `next.config.ts` — add CSP + Permissions-Policy to global headers

The global `source: "/(.*)"` block now ships six headers. CSP highlights:

- `default-src 'self'` — fall-through deny.
- `script-src` allows Stripe.js + Vercel insights; `'unsafe-inline'` /
  `'unsafe-eval'` retained because Next.js 16 + React 19 hydration still
  emits inline bootstrapping. Tightening to nonce-based CSP is a follow-up
  lane (4.40).
- `connect-src` whitelists Supabase (REST + realtime WSS) and Stripe.
- `frame-ancestors 'none'` — clickjacking lock (matches `X-Frame-Options:
  DENY`, but CSP supersedes the legacy header in modern browsers).
- `object-src 'none'` — blocks legacy plugin content (Flash/Java) which
  bypasses script-src on some old engines.
- `form-action 'self' https://checkout.stripe.com` — stops stored-XSS from
  redirecting form submits to attacker domains.
- `upgrade-insecure-requests` — auto-rewrites any `http://` asset
  reference to `https://`.

Permissions-Policy disables camera, microphone, geolocation, gyroscope,
accelerometer, magnetometer, USB, FLoC (`interest-cohort`). `payment` is
allowed for self + Stripe Checkout so PaymentRequest still works.

### 2. `tests/unit/security-headers.test.ts` — drift guard (12 assertions)

Per Hard Rule #59 — the test parses `next.config.ts` source and asserts:

- Each of the 6 required header keys is present in the global block.
- HSTS `max-age` ≥ 31,536,000s (1 year) and includes `includeSubDomains`.
- `X-Frame-Options` is `DENY` (not `SAMEORIGIN`).
- CSP contains `frame-ancestors 'none'` and `object-src 'none'`.
- Permissions-Policy disables camera, microphone, geolocation.
- Referrer-Policy is in the strict set
  (`no-referrer` / `same-origin` / `strict-origin` /
  `strict-origin-when-cross-origin`).

The parser is a brace-counting walker, not a runtime import — so the test
runs without bundling Next.js or executing the config function.

## What this does NOT do

- Does not move CSP to nonce-based scripts (still `'unsafe-inline'`). That
  is **Lane 4.40** — requires a `middleware.ts` that injects a per-request
  nonce and a Next.js plugin that propagates the nonce to script tags.
  Hard Rule #58 applies: server-component anon-client audit must run first.
- Does not add `Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy`
  / `Cross-Origin-Resource-Policy`. These break Stripe.js redirect flows
  if set wrong; deferred to Lane 4.41.
- Does not enforce CSP at the route level — the global `/(.*)` source
  applies everywhere, but per-route overrides in
  `next.config.ts` headers array would *append*, not replace. No route
  currently does this.
- Does not check that the headers actually ship in production responses
  (would need a Vercel preview-fetch test). The drift test is source-only.

## Threat model — what this closes

| Attack                                              | Pre-Lane 4.39        | Post-Lane 4.39 |
|-----------------------------------------------------|----------------------|----------------|
| Stored-XSS exfils `tr_live_...` to attacker domain  | Possible             | Blocked by `connect-src` |
| Injected `<form action="evil.com">` POSTs API key   | Possible             | Blocked by `form-action` |
| Compromised dependency loads remote `<object>` plugin | Possible           | Blocked by `object-src 'none'` |
| Reflected-XSS via blog post HTML                    | Possible             | Blocked by `script-src 'self'` |
| Iframe embedding (clickjacking)                     | Blocked by XFO only  | Belt-and-braces (XFO + frame-ancestors) |
| Silent camera/mic/geolocation grab on injected page | Possible             | Blocked by Permissions-Policy |
| MITM downgrade of an `http://` asset                | Possible             | Blocked by `upgrade-insecure-requests` |
| FLoC tracking ID exposure                           | Possible             | Blocked by `interest-cohort=()` |

## Drift surface — why the test matters

If anyone:
- Removes a header from the array
- Weakens HSTS below 1 year
- Changes XFO to `SAMEORIGIN`
- Drops `frame-ancestors 'none'` from CSP
- Loosens Referrer-Policy to `unsafe-url` or similar

…the unit test fails on the next CI run. No silent regressions.

## Verification

```
npx vitest run tests/unit/security-headers.test.ts   # 12/12 pass
npx vitest run tests/unit/                            # 34/34 pass
npx tsc --noEmit                                      # clean
```

## References

- Hard Rule #58 — anon-client server-component audit before any header
  change that could surface previously-hidden Supabase reads (none here).
- Hard Rule #59 — failing-snapshot drift tests as canonical fix lists.
- Lane 4.37 / 4.38 — body-size DoS guards (sibling drift-test pattern).
- OWASP Secure Headers Project — header recommendations.

## Follow-ups (do not block this PR)

- **Lane 4.40** — nonce-based CSP (`script-src 'self' 'nonce-...'`),
  middleware-injected.
- **Lane 4.41** — COOP/COEP/CORP isolation headers (Stripe-compatible).
- **Lane 4.42** — production-fetch test against `toolroute.ai/` asserting
  headers are actually served (catches Vercel CDN strip-down regressions).
