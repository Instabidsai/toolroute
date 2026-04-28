# Lane 4.80 — Screenshot adapter master access_key in returned URL (HIGH/COGS)

> **Status:** UNFIXED — Codex implementation ticket follows.
> **Class:** Master-pool credential exposure on response wire.
> **Severity:** HIGH — unbounded COGS exposure if master pool is used.

## Finding

`src/lib/adapters/screenshot-adapter.ts` constructs a ScreenshotOne URL
with the master `access_key` embedded as a query parameter, and returns
the URL verbatim to the caller as `data.image_url`:

```typescript
// src/lib/adapters/screenshot-adapter.ts:38–73 (capture op)
const params = new URLSearchParams({
  access_key: apiKey,          // <-- master pool key
  url,
  viewport_width: String(width),
  ...
});
const screenshotUrl = `${SCREENSHOTONE_URL}?${params}`;
const res = await fetch(screenshotUrl, { method: "HEAD" });
...
return {
  success: true,
  data: { image_url: screenshotUrl, ... },   // <-- CRED ON THE WIRE
  ...
};
```

Same pattern duplicated in the `fullpage` op (lines 92–127).

## Why this matters

`apiKey = byokKey || process.env.SCREENSHOTONE_API_KEY`. When no BYOK
key is provided, the gateway uses ToolRoute's master pool key. The URL
returned to the caller therefore contains **our** master access_key in
plaintext.

ScreenshotOne's `access_key` alone authorizes screenshot requests up to
the account quota. A caller (or anyone who later sees the URL — logs,
referer headers, browser history, embedded image src) can:

- Generate arbitrary screenshots against any URL on our quota
- Burn through our prepaid credits / monthly quota
- Trigger rate-limit blocks that affect legitimate paying customers

This is a **direct generalization of Lane 4.12** (master & BYOK key
leak-class audit), but in a different surface. Lane 4.12 audited the
`auth_key_encrypted` *DB column* and confirmed it never reaches the
response wire. This finding is `process.env.SCREENSHOTONE_API_KEY`
reaching the response wire via URL embedding — a different propagation
path the prior audit did not consider.

## BYOK callers are safe

When the caller provides a BYOK key, that key is theirs — returning it
to them in `image_url` is a no-op (they already have it). Only the
master-pool path leaks.

## Comparable adapters checked — clean

| Adapter | Pattern | Verdict |
|---------|---------|---------|
| `playwright-adapter.ts` | Returns thum.io URL — no key in URL | ✅ SAFE |
| `pdf-adapter.ts` | URLSearchParams used internally for fetch, response data does not include the URL | ✅ SAFE (verify in Codex impl) |
| `pexels-adapter.ts` | Header auth, no URL embedding | ✅ SAFE |
| `youtube-adapter.ts` | URL embedding for fetch only | ✅ SAFE |
| Header-auth adapters (claude, exa, elevenlabs, etc.) | `x-api-key` header, never in URL | ✅ SAFE |

Screenshot is the **only** adapter with this leak class.

## Fix options (Codex ticket)

### Option A — HMAC-signed URLs (preferred)

ScreenshotOne supports HMAC-signed URLs via a `signature` parameter.
Signing locks the URL parameters; an attacker who sees the URL can only
re-fetch the same screenshot, not generate new ones.

Requires new env var `SCREENSHOTONE_SECRET_KEY`. Sign each URL
server-side before returning. Best UX (caller still gets a working
direct URL).

```typescript
// pseudo-code
const signature = crypto
  .createHmac("sha256", process.env.SCREENSHOTONE_SECRET_KEY)
  .update(params.toString())
  .digest("hex");
params.set("signature", signature);
```

### Option B — Server-side proxy

Server-side fetch the image, return base64 or a ToolRoute-CDN URL.
Master access_key never leaves our server. Adds bandwidth cost on us
and breaks the "image_url for embedding" UX.

### Option C — Force BYOK

Refuse master-pool use for the screenshot adapter. Gate it behind
"BYOK required". Worst UX, simplest implementation.

**Recommendation:** Option A. Single new env var. Caller UX preserved.
Master-pool blast radius bounded to the signed image's parameter set.

## Codex implementation ticket

```
Title: [lane-4.80-impl] HMAC-sign ScreenshotOne URLs to close master-key-on-wire leak

Scope:
- Add `SCREENSHOTONE_SECRET_KEY` to Vercel env (production + preview)
- Update `src/lib/adapters/screenshot-adapter.ts` capture + fullpage ops:
  - Compute HMAC-SHA256(params, SCREENSHOTONE_SECRET_KEY)
  - Append signature param before HEAD probe + return
  - If SCREENSHOTONE_SECRET_KEY is unset AND apiKey == process.env value
    (master), refuse with explicit error pointing to BYOK
  - BYOK path unchanged (signature optional — customer's key, customer's blast radius)
- Add unit test: assert returned image_url contains `signature=` param
  when master pool is used
- Drift guard: vitest that fails if a future refactor returns image_url
  without signature in the master-pool path

Validation:
- Local: stub SCREENSHOTONE_API_KEY + SCREENSHOTONE_SECRET_KEY, run capture
  op, verify image_url has signature param
- Prod: ScreenshotOne dashboard should show signed-request count climbing
  after deploy
```

## Related

- Lane 4.12 — master/BYOK key DB-column leak audit (CLEAN). This finding
  extends the audit surface to runtime URL embedding.
- Lane 4.10 — gateway COGS leak class. Same risk family (unbounded
  upstream consumption), different propagation path.
- Hard Rule #18 — `redactCreds()` helps for error_message column, but
  `image_url` is a successful-response field — redaction would break
  the user-facing URL. Signing is the right primitive here.
