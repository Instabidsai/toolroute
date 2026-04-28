# Lane 4.44 — Timing-safe secret comparison audit

**Status:** Production CLEAN. Public docs snippet shipped insecure `===` for HMAC verify — fixed in this PR. Drift test pins the fix.
**Severity:** P2 on docs sample (customers copy-paste the published pattern); P5 in production code (no exploitable timing surface).
**Date:** 2026-04-28
**Sibling lanes:** 4.17 (Stripe sig verify), 4.20 (Stripe idempotency), 4.28 (admin auth), 6.4.4 (marketing snippet validity).

## Threat model

Non-constant-time string comparison (`===`, `==`, `Buffer.compare()` early-return) leaks secret content via response timing:
- Compare aborts at first mismatch, so each correct prefix byte takes longer
- Repeated probes + statistical analysis recover the secret byte-by-byte
- Exploitable when (a) attacker controls the comparand and (b) timing variance dominates network noise

Production surface is small here because:
- API key validation uses SHA-256 hash → DB index lookup. Input space (256-bit random) is not attacker-constructable byte-by-byte; an attacker can't forge a partial-match hash to extract the next byte.
- Stripe webhook verification uses `stripe.webhooks.constructEvent` — the Stripe SDK uses `crypto.timingSafeEqual` internally.
- Admin auth uses `validateAdmin()` (src/lib/admin-auth.ts) which already uses `timingSafeEqual` after length check.

## Findings

### F-1 — Docs sample teaches non-constant-time HMAC compare (FIXED)

`src/app/docs/page.tsx:2004` published this snippet under "Verify webhook signatures":

```ts
return signature === `sha256=${expected}`;
```

Every ToolRoute customer who copy-pastes this into their webhook handler ships a timing-attack surface. Their attacker controls `signature` directly (HTTP header), can probe at scale, and the HMAC compare is the ONLY thing standing between forged events and their backend.

**Fix shipped:** updated snippet to `crypto.timingSafeEqual` with length pre-check (the canonical Node.js pattern):

```ts
import { createHmac, timingSafeEqual } from "crypto";

function verifyWebhook(body: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(body, "utf-8").digest("hex");
  const expectedBuf = Buffer.from(`sha256=${expected}`);
  const receivedBuf = Buffer.from(signature);
  if (expectedBuf.length !== receivedBuf.length) return false;
  return timingSafeEqual(expectedBuf, receivedBuf);
}
```

### F-2 — Gateway API key compare goes through Postgres index (no exploitable surface)

`validateRequest()` in `src/lib/gateway.ts:24-49` SHA-256 hashes the bearer key client-side, sends the hash to `validate_api_key` RPC, which `SELECT WHERE key_hash = $1`. Postgres B-tree compare is not constant-time, but:
- Hash is 64 hex chars (256-bit random)
- Attacker can't construct a SHA-256 preimage to match a target prefix byte-by-byte
- Even if they could measure timing, network jitter + DB roundtrip variance dominates the few-nanosecond byte-compare difference

No fix needed.

### F-3 — Admin secret already uses `timingSafeEqual` (CLEAN)

`src/lib/admin-auth.ts:15-21` validates `x-admin-secret` header with proper length check + `timingSafeEqual`. Single canonical implementation per Lane 4.11.

## Drift guard

`tests/unit/timing-safe-docs-snippets.test.ts` — greps published doc snippets in `src/app/docs/page.tsx` and `src/app/blog/`. Fails if any HMAC/signature verification example uses `===` or `==`. Forces future authors to either use `timingSafeEqual` or document the snippet as deliberately illustrative-only.

## Verification

```bash
npx vitest run tests/unit/timing-safe-docs-snippets.test.ts
# Test Files  1 passed (1)
# Tests       1 passed (1)
```

Type-check:
```bash
npx tsc --noEmit
```

## Sibling rules
- Hard Rule #59 — failing-snapshot test as drift TODO
- Hard Rule #54 — showcase-page anti-pattern (this is the docs equivalent)
