# Lane 4.56 — Body-Size Guard Coverage Audit

**Date:** 2026-04-28
**Lane:** 4.56 (RLS hardening track — body-size DoS guard coverage drift)
**Author:** Claude (operator session)
**Pattern:** Hard Rule #59 — failing-snapshot test as drift TODO list

## Summary

`src/lib/body-limit.ts` defines `BODY_LIMITS` for 12 routes and exports
`assertBodyUnder()` to enforce them. Only **3 routes actually call the
guard** (`execute`, `mcp`, `a2a`). Every other body-parsing route is
**unbounded** — a 100MB JSON body will be parsed in-process before any
auth/RLS check runs. This is a DoS class.

## Regression context — this gap was supposed to be closed

Lane 4.38 (PR #58, commit `3048268`) was titled "body-size guards on
remaining 11 routes (stacked on 4.37)" and the commit message claims
all 11 routes patched. But `git log master -- src/app/api/v1/byok/route.ts`
shows master only has Lane 4.48 (Cache-Control) + the original
transform commit — **the Lane 4.38 patches never reached master**.
The squash-merge commit lives on `origin/lane-4.37-body-size-dos-audit`
but a downstream rebase or force-push appears to have orphaned it.

This is exactly the failure mode Hard Rule #59 prevents: "shipped" in
PR-state diverges from "shipped" in master-state, drift goes unnoticed
for ~10 lanes, and the security gap re-opens silently. The drift test
in this PR catches it on master regardless of how it got that way.

## What's guarded (3 routes, working pattern)

| Route | Limit Key | Bytes |
|-------|-----------|-------|
| `src/app/api/v1/execute/route.ts` | `execute` | 256 KB |
| `src/app/mcp/route.ts` | `mcp` | 256 KB |
| `src/app/api/a2a/route.ts` | `a2a` | 256 KB |

Working pattern (from `execute/route.ts` line 14):

```ts
import { assertBodyUnder, BODY_LIMITS } from "@/lib/body-limit";

export async function POST(request: NextRequest) {
  try {
    assertBodyUnder(request, BODY_LIMITS.execute);
    // ... validateRequest, then await request.json() ...
```

`assertBodyUnder` reads `Content-Length` and throws `GatewayError` with
HTTP 413 + code `body_too_large` before the body is buffered.

## What's NOT guarded (11 routes, fix list)

The vitest `tests/unit/body-limit-coverage.test.ts` failing assertion
**IS the canonical fix list**:

| Route file | BODY_LIMITS key to use | Existing limit |
|------------|------------------------|----------------|
| `api/admin/providers/route.ts` | `admin_providers` | 16 KB |
| `api/check/route.ts` | `check` | 4 KB |
| `api/v1/byok/route.ts` | `byok` | 16 KB |
| `api/v1/checkout/route.ts` | `checkout` | 4 KB |
| `api/v1/keys/route.ts` | `keys` | 4 KB |
| `api/v1/registry/challenge/route.ts` | `registry` | 8 KB |
| `api/v1/registry/request/route.ts` | `registry` | 8 KB |
| `api/v1/registry/usage/route.ts` | `registry` | 8 KB |
| `api/v1/settings/route.ts` | `settings` | 4 KB |
| `api/v1/signup/route.ts` | `signup` | 8 KB |
| `api/webhooks/stripe/route.ts` | `stripe_webhook` | 64 KB |

All 12 BODY_LIMITS keys already exist. The remediation is purely:
import `assertBodyUnder, BODY_LIMITS`, call `assertBodyUnder(request,
BODY_LIMITS.<key>)` as the first line of `POST(request)`, before the
existing `await request.json()` (or `request.text()` for the Stripe
webhook).

## Why this is a DoS class

Without a Content-Length guard, an attacker can:

1. Send `Content-Length: 100000000` + 100MB body to `/api/v1/keys`
   (auth-gated, cheap to attempt with a stolen-but-revoked API key)
2. Next.js / Node buffers the entire body into RAM before the route's
   own auth check runs
3. With ~50 concurrent requests, an unauthenticated attacker can OOM
   the serverless function or burn the Vercel concurrency quota

The 256KB execute limit is appropriate for tool inputs. The 4-16KB
limits on auth/billing routes mean a 100MB body is **6,000x to
25,000x** the legitimate ceiling — this is the gap.

## Drift guard (this PR)

`tests/unit/body-limit-coverage.test.ts` source-walks `src/app`,
identifies every `route.ts` that parses request bodies (via regex on
`await request.json()` or `await request.text()` or `await req.json()`),
and asserts each calls `assertBodyUnder(`. It's gated behind
`BODY_LIMIT_BASELINE=skip` env var so CI stays green while sibling
lanes ship — matches the pattern from Lane 6.10 (dashboard tier drift)
and the marketing-drift baseline.

The test also asserts `BODY_LIMITS` defines ≥12 keys so reviewers can't
silently shrink coverage.

## Remediation strategy (follow-up PRs)

Per Hard Rule #59, this PR ships the **failing test** first. The 11
offending routes get their guards added in follow-up PRs (Lanes 4.57+).
Each follow-up:

1. Adds the import + one `assertBodyUnder()` call
2. Removes its entry from the test offender count
3. Eventually the test passes — at which point we delete the env var
   gate and let the test run unconditionally on master

Recommended sequencing (highest blast-radius first):

- **4.57** — `byok` + `keys` + `signup` (auth boundary, hit by
  stolen-key replay)
- **4.58** — `checkout` + `settings` (billing surface)
- **4.59** — `registry/*` (3 routes, share `registry` key)
- **4.60** — `admin/providers` (admin-secret gated, lower priority but
  still a DoS class)
- **4.61** — `check` (catalog probe, low-stakes)
- **4.62** — `webhooks/stripe` (uses `.text()` for HMAC verification —
  needs `assertBodyUnder` *before* `request.text()`, plus signature
  verification stays unchanged)

## Cross-references

- **Hard Rule #59** — failing-snapshot test as drift TODO list,
  env-var skip gate
- **Lane 4.50–4.55** — sibling RLS hardening drift guards (PRs 71-76)
- **Lane 6.5-impl** (Codex) — runtime BYOK gate; once it ships, the
  per-route body-limit guards become especially important on `byok`
  (the most-attacked auth-write route)

## Verification

```bash
# Default — produces fix list (test fails, listing 11 unguarded routes)
npx vitest run tests/unit/body-limit-coverage.test.ts

# Skip gate — all 3 tests skipped, CI stays green
BODY_LIMIT_BASELINE=skip npx vitest run tests/unit/body-limit-coverage.test.ts
```

Each of the 11 follow-up PRs should re-run the default mode and
confirm the offender list shrunk by 1.
