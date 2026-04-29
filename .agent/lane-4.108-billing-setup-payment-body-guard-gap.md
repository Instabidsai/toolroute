# Lane 4.108 — `billing/setup-payment` missed in body-size guard sweep (Lane 4.62 "last offender" claim wrong)

**Owner:** Claude (auditor)
**Started:** 2026-04-29
**Severity:** LOW (defense-in-depth drift; session-authed, no body parsing)
**Action:** Codex ticket — add `assertBodyUnder(request, BODY_LIMITS.checkout)` (or new `setup_payment` limit) to `src/app/api/v1/billing/setup-payment/route.ts:9`. Estimate <5 min.

## TL;DR

Lane 4.62 (committed 2026-04-28) was titled "body-size guard on webhooks/stripe (64KB) — last drift offender" and shipped vitest drift-prevention covering 13 POST routes. **It missed one POST route:** `src/app/api/v1/billing/setup-payment/route.ts`.

Verified by listing all `export async function POST` handlers in `src/app/api/**/route.ts` (14 files) and cross-referencing against `assertBodyUnder` callers (14 files but `settings` is PATCH, not POST). The diff is exactly one route: `billing/setup-payment` has POST but no `assertBodyUnder`.

## File:line evidence

### `src/app/api/v1/billing/setup-payment/route.ts:8-91` — the unguarded POST
```ts
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const { userId, email } = await getUserFromSession(authHeader);
    // ...no assertBodyUnder call anywhere in this handler
```

### `src/lib/body-limit.ts:3-16` — `BODY_LIMITS` registry
```ts
export const BODY_LIMITS = {
  execute: 256 * 1024,
  mcp: 256 * 1024,
  a2a: 256 * 1024,
  byok: 16 * 1024,
  keys: 4 * 1024,
  signup: 8 * 1024,
  checkout: 4 * 1024,        // could be reused
  settings: 4 * 1024,
  admin_providers: 16 * 1024,
  registry: 8 * 1024,
  check: 4 * 1024,
  stripe_webhook: 64 * 1024,
} as const;                   // <— no setup_payment entry
```

### Git history (why this slipped)
- `eb2e74d feat: add auto top-up payment setup` — route added pre-Lane 4.37
- `c81dc57 [lane-4.37] body-size DoS audit + helper + 3 high-risk routes patched (#57)` — helper landed
- Lane 4.38, 4.56, 4.57, 4.58, 4.59, 4.60, 4.61, 4.62 — sequential coverage extension. Each batch enumerated POST routes by inspection; this one fell through.

## Why severity is LOW

1. **Session-authed.** Caller must hold a valid bearer token (`getUserFromSession`). Anon DoS via large body is closed by auth middleware — Vercel still buffers bytes pre-handler, but the surface is gated.
2. **Handler doesn't parse body.** `await request.json()` is never called. A 1MB POST body is buffered by the runtime then discarded. No JSON-parse CPU spike, no shape attack.
3. **Limited blast radius.** Worst case: an authed user wastes their own bandwidth + a tiny amount of Vercel runtime to send oversized garbage. They can't escalate or exfiltrate.

But it's still a defense-in-depth gap — the helper is cheap (`Content-Length` short-circuit, no body read), the pattern is uniform everywhere else, and Lane 4.62's drift-prevention test wouldn't catch the addition of a NEW unguarded POST route if author copies this file's shape.

## Why this matters for Lane 4.62's claim

Lane 4.62 commit message: "last drift offender." That's wrong in two senses:

1. **Coverage was incomplete** — `billing/setup-payment` was always missing.
2. **The drift-prevention test (vitest) likely passes** — because the test enumerates routes from `BODY_LIMITS` keys, not from filesystem POST handlers. New POST routes that fail to add a `BODY_LIMITS` entry are invisible to the test.

Recommend Codex follow-up: **invert the test direction** — list every `export async function POST` in `src/app/**/route.ts`, assert each file references `assertBodyUnder`. That catches the inverse drift class (route added without guard).

## Codex ticket (concrete)

```
Title: Lane 4.108 — body-size guard on billing/setup-payment + invert drift test

Files to change:
- src/app/api/v1/billing/setup-payment/route.ts (add assertBodyUnder)
- src/lib/body-limit.ts (add setup_payment: 4 * 1024 — payload is empty currently, 4KB is generous headroom)
- tests/unit/body-size-drift.test.ts or similar (invert: enumerate POST handlers via fs, assert each calls assertBodyUnder)

Acceptance:
- POST /api/v1/billing/setup-payment with Content-Length: 5000 and Bearer token returns 413 body_too_large
- vitest drift-prevention test fails on master if a new POST route is added without assertBodyUnder
- existing 13 routes still pass
```

## Sibling rules / lanes

- Lane 4.37 — body-size DoS audit + helper landed
- Lane 4.38, 4.56-4.62 — sequential coverage extensions (this audit's blind spot)
- Hard Rule #59 — failing-snapshot test = drift TODO list (the inverted test would shrink to 0 failures as Codex ships the fix)
- Lane 4.107 — sibling pattern of "audit memo claimed sibling work shipped, sibling work didn't" (the inverse: this memo says sibling work claimed completeness, claim was wrong)

## Acceptance for this audit memo

- [x] Enumerated all `export async function POST` in `src/app/**/route.ts` — 14 routes
- [x] Cross-referenced against `assertBodyUnder` callers — 14 files, but `settings` is PATCH not POST → 13 unique POST routes guarded
- [x] Identified diff: `billing/setup-payment` is the missed route
- [x] Read the route — confirmed no `assertBodyUnder` and no `request.json()` call (severity bound)
- [x] Git history — confirmed route predates the helper by ~weeks of audit lanes
- [ ] **CODEX:** add guard + invert drift test (low priority; defense-in-depth)

## Process-improvement note

Lane 4.62's "last drift offender" framing is the third "claimed-complete-but-incomplete" pattern this loop has surfaced (Lane 4.16 SELECT-revoke unshipped → Lane 4.107; Lane 4.96 header line 23 false claim → Lane 4.107; this audit). The shared pattern: **commit messages assert completeness; verification is missing**. Sibling to Hard Rule #28 (depth audit after PROVEN) — completeness claims need a depth-probe (filesystem enumeration, live probe, etc.) before they can be trusted.
