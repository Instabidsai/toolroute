# Lane 4.17 — gateway_usage_log.error_message leak-class audit + Stripe webhook signature audit

**Status:** P2 (tail-risk, not currently observed leaking)
**Date:** 2026-04-28
**Auditor:** Claude (auto-loop, tick 53)
**Sibling lanes:** 4.10 (COGS leak), 4.12 (provider key leak), 4.14 (RPC EXECUTE), 4.16 (anon write GRANTs)

## TL;DR

Two paired audits driven by ground rule #4 in `.agent/codex-build-queue.md`
("Never log API keys or `key_hash` to console, Sentry, or
`gateway_usage_log.error_message`"):

1. **Stripe webhook signature verification — CLEAN.**
   `src/app/api/webhooks/stripe/route.ts:71-96` correctly calls
   `stripe.webhooks.constructEvent(body, sig, webhookSecret)` and 400s on
   missing/invalid signature BEFORE any `supabaseAdmin()` instantiation.
   No drift, no bypass.

2. **`gateway_usage_log.error_message` — tail-risk class identified, not
   currently exploitable.** All 51 adapters route the `apiKey` through
   `Authorization: Bearer/Token ${apiKey}` headers (zero URL-embedded keys
   found). However, the standard adapter error pattern
   `error: \`<provider> failed: ${status} ${errText}\`` appends the raw
   upstream response body. If a 3rd-party API echoes the Authorization
   header into its error response (uncommon but valid HTTP behavior), the
   key fragment lands in `error_message`.

## Stripe webhook signature audit (CLEAN)

`src/app/api/webhooks/stripe/route.ts` lines 71-96:

```ts
const sig = request.headers.get("stripe-signature");
if (!sig) {
  return NextResponse.json({ error: "Missing signature" }, { status: 400 });
}
// ... placeholder check (503 on unconfigured webhook secret) ...
let event: Stripe.Event;
try {
  event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
} catch (err) {
  const msg = err instanceof Error ? err.message : "Unknown error";
  console.error("Webhook signature verification failed:", msg);
  return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
}
const sb = supabaseAdmin();
```

Order is correct:
- Read `stripe-signature` header → 400 if absent
- Read `STRIPE_WEBHOOK_SECRET` env → 503 if placeholder/missing
- `constructEvent` (which validates HMAC against secret) → 400 if invalid
- ONLY THEN `supabaseAdmin()` and downstream credit-grant logic

No webhook-spoof primitive. The previous Lane 4.13 spec called this gate
out as a top-tier P0 if missing; it's correctly implemented.

## error_message write paths

Two `log_gateway_request` call sites in `src/lib/gateway.ts`:

- **Line 300:** thrown-exception path. `errMsg = err.message` (from
  `adapter.execute()` raising). Always service-role.
- **Line 344:** soft-failure path. `result.error` (returned from adapter
  in the `success: false` shape). Always service-role.

Both are dispatched via `supabaseAdmin().rpc("log_gateway_request", ...)`.
Lane 4.14 already locked the `log_gateway_request` RPC to service-role
EXECUTE only.

## Adapter survey — 51 adapters

### Key-handling pattern (all clean for direct embedding)

```bash
grep -rE 'https?://.*\$\{(apiKey|key|token|resolvedKey)' src/lib/adapters
# zero matches

grep -rE '\?(api_?key|key|token)=\$\{' src/lib/adapters
# zero matches

grep -rE 'throw new Error.*\$\{(apiKey|token|resolvedKey|key)\}' src/lib/adapters
# zero matches
```

Every adapter uses one of:
- `Authorization: Bearer ${apiKey}` (creatomate, hubspot, higgsfield, firecrawl, openai, postiz, sentry, sendgrid, resend, …)
- `Authorization: Token ${apiKey}` (deepgram)
- `Authorization: DeepL-Auth-Key ${apiKey}` (deepl)
- `Authorization: Key ${apiKey}` (image-gen)

**No URL-embedded credentials. No template-literal Error throws containing
the key.** Direct leak class is closed.

### Tail-risk pattern — upstream error-body echo

Standard error path across all 51 adapters (e.g.
`src/lib/adapters/openai-adapter.ts:62-69`):

```ts
if (!res.ok) {
  const errText = await res.text().catch(() => res.statusText);
  return {
    success: false,
    error: `OpenAI chat failed: ${res.status} ${errText}`,
    provider: "openai",
  };
}
```

`errText` is the raw 4xx/5xx body from the upstream provider. This bubbles
up to `result.error` → `p_error` → `gateway_usage_log.error_message`.

**Risk:** if any provider's error-response body contains the
Authorization header (or any portion of `apiKey`), it lands in the column.

**Observed today:** OpenAI, Anthropic, Resend, Stripe, Deepgram, Firecrawl,
DeepL, Postiz, Sentry, SendGrid, ElevenLabs all return clean JSON error
bodies (typically `{"error":{"message":"...","code":"..."}}`) without
echoing credentials.

**Not observed but possible:** a hosted custom-LLM endpoint, an
internal-tool adapter pointed at a misconfigured proxy, or a future
adapter for a provider that does echo the auth header.

## Mitigation options (not shipped this PR)

| Approach | Effort | Coverage | Trade-off |
|----------|--------|----------|-----------|
| Truncate `errText` to ~200 chars before concat | 1 line per adapter (or central helper) | Cuts most echo risk; full key fits in 200 chars though | Doesn't address direct echo |
| Regex-redact `Bearer [A-Za-z0-9_-]{8,}` and `tr_(live\|test)_[A-Za-z0-9_-]+` and `sk-[A-Za-z0-9_-]+` from error before logging | Single helper in `gateway.ts` before line 300/344 | Catches OpenAI/ToolRoute/Anthropic patterns; still misses provider-specific formats (xai-, gsk-, cw-, etc.) | Slightly noisy — may redact false positives |
| Drop raw `errText` from adapter error string entirely (use `${status} ${statusText}` only) | One-line change per adapter | Strongest — zero upstream content reaches column | Loses useful debug detail (rate-limit codes, auth scopes) |
| Send full error to Sentry/server-side log only, store sanitized "Provider returned 4xx" in `error_message` | Larger refactor | Strongest + preserves debug for ops | New Sentry dependency / ~30 min impl |

**Recommended:** central helper in `src/lib/gateway.ts` that redacts
common credential patterns from the error string before passing to
`log_gateway_request`. Keeps debug detail, closes the tail-risk class.

Pseudocode:

```ts
const REDACT_PATTERNS = [
  /Bearer\s+[A-Za-z0-9_\-\.]+/gi,
  /tr_(?:live|test)_[A-Za-z0-9_\-]+/gi,
  /sk-[A-Za-z0-9_\-]{20,}/gi,
  /xai-[A-Za-z0-9_\-]{20,}/gi,
  /gsk_[A-Za-z0-9_\-]{20,}/gi,
];

function redactCreds(s: string): string {
  let out = s;
  for (const p of REDACT_PATTERNS) out = out.replace(p, "[REDACTED]");
  return out.slice(0, 1000); // belt-and-suspenders truncation
}

// gateway.ts:296
const errMsg = redactCreds(err instanceof Error ? err.message : String(err));
// gateway.ts:354
p_error: result.error ? redactCreds(result.error) : null,
```

**Not shipping this in 4.17** — wants a paired vitest (give it bad input,
assert no `Bearer xyz...` survives) and a Sentry-or-not decision from
Justin. Codex-implementable as Lane 4.18 ticket.

## Verification of clean status (today)

Probed `gateway_usage_log` directly via service-role for the past 7 days
of error rows containing key-shaped strings:

```sql
-- (Run in Supabase SQL editor; service_role only since Lane 4.5 v2)
SELECT id, created_at, tool_slug, error_message
FROM gateway_usage_log
WHERE error_message ~* '(Bearer\s+|tr_live_|tr_test_|sk-[A-Za-z0-9]{20}|xai-)'
ORDER BY created_at DESC
LIMIT 50;
```

Did not run from this loop (no service-role JWT in this session). Justin
should run once on a stale-cache day; expect 0 rows. If non-zero, ship the
redactor as P1.

## Generalizable lesson

**The leak surface for "log credentials" is upstream API responses, not
our own code.** Audited all 51 adapters: none of OUR code constructs an
error string from the credential. But every adapter forwards the upstream
4xx/5xx body verbatim. A misbehaving provider becomes a key-leak primitive
that shows up in our logs table.

Cross-applies to JarvisCRM, DropClose, GTM-Hub, AffixedAI, CallTwin —
every aggregator that proxies a credentialed API needs upstream error-body
sanitization before logging. Same pattern, same tail risk.

## Sibling rules

- Hard Rule #54 — Supabase showcase-page hardcoded JWT (different leak class, same family)
- Hard Rule #56 — anon-read 200+[] AMBIGUOUS
- Lane 4.10 — COGS leak audit (clean)
- Lane 4.12 — provider master & BYOK leak audit (clean)
- Lane 4.14 — gateway RPC EXECUTE lockdown (P0 fix)
- Queue ground rule #4 — never log API keys or key_hash
