# Lane 4.31 — SSRF audit on adapters that fetch user-supplied URLs

**Status:** P1 finding + 1 P2-by-design + fix shipped
**Severity if exploited:** P1 (probe internal Vercel/cloud network, hit metadata endpoints, scan localhost services)
**Audited:** all 51 adapters in `src/lib/adapters/*.ts`

## Why this audit

Server-Side Request Forgery (SSRF) is the class where a server fetches a URL on behalf of a client AND the URL is fully or partially attacker-controlled. The classic attack chain:

1. Attacker calls `POST /api/v1/execute` with `{tool: "X/Y", input: {url: "http://169.254.169.254/..."}}`
2. ToolRoute's serverless function fetches the URL using its own egress IP / network identity
3. Response body returned to attacker — exposes cloud metadata, internal services, private network state

ToolRoute's gateway is a high-value SSRF target because it's *expected* to make outbound calls and its Vercel functions may have privileged network paths (or future internal-network access if migrated to a VPC).

## Audit method

Grepped `src/lib/adapters/` for `await fetch(url, ...)` and `fetch(input.url`, then traced each match to determine whether `url` is:
- (A) hardcoded BASE_URL + user-supplied path/query → SAFE (attacker can't redirect host)
- (B) ${BASE_URL} + user-supplied path segment with no traversal → SAFE
- (C) directly `input.url` or `${input.X_url}` → SSRF SURFACE

## Findings

| Adapter | Operation | url source | Class | Severity |
|---------|-----------|-----------|-------|----------|
| **playwright** | `scrape-text` | `input.url` direct | C | **P1** |
| supabase | insert/select/update | `input.project_url` | C (by design) | P2 |
| outscraper | google-maps/reviews/contacts | `${BASE_URL}/...` | A | ✅ |
| sentry | issues/events/projects | `${BASE_URL}/...` | A | ✅ |
| stripe | various | `${BASE_URL}/...` | A | ✅ |
| replicate | list-models | `${BASE_URL}/models/${owner}` | B (segment, no traversal escapes URL host) | ✅ |
| screenshot | capture/fullpage | passes URL as path-segment to thum.io / ScreenshotOne | provider-side | ✅ |
| playwright | screenshot/pdf | passes URL to thum.io | provider-side | ✅ |
| firecrawl, whisper, mux, removebg, image-gen, youtube, creatify, deepgram, etc. | various | passes URL to provider API as JSON body | provider-side | ✅ |

### F-1: P1 — playwright/scrape-text direct fetch

**Before fix** (`src/lib/adapters/playwright-adapter.ts:59`):
```ts
const url = input.url as string;
// ... missing field check ...
const res = await fetch(url, {
  headers: { "User-Agent": "Mozilla/5.0 (compatible; ToolRoute/1.0; ...)" },
});
const html = await res.text();
// ... HTML→text strip ...
return { success: true, data: { text: text.slice(0, 50000), ... } };
```

ToolRoute's serverless function executes `fetch(url)` with NO validation. Response body returned to caller (HTML stripped to first 50K chars). Attack payloads that worked in principle:
- `http://169.254.169.254/latest/meta-data/` — AWS/cloud instance metadata
- `http://[fd00::1]/` — IPv6 unique-local
- `http://10.0.0.1/admin` — RFC1918 private network probe
- `http://localhost:5432/` — local Postgres if any
- `file:///etc/passwd` — Node fetch may block file: but worth defending
- `gopher://...` — protocol smuggling

Cost per probe: $0.002. Effectively free reconnaissance.

**Fix shipped:** added `src/lib/ssrf-guard.ts` with `assertSafePublicUrl(url)` — blocks:
- `http:`/`https:` only (no file/data/ftp/gopher)
- IPv4 ranges: 10.0.0.0/8, 127.0.0.0/8, 169.254.0.0/16, 172.16.0.0/12, 192.168.0.0/16, 0.0.0.0/8
- IPv6: ::1, fc00::/7, fe80::/10, ::ffff:V4 mapped
- Hostnames: `localhost`, `metadata.google.internal`, `metadata.goog`, `instance-data`

Patched playwright-adapter scrape-text to call `assertSafePublicUrl(url)` BEFORE `fetch(url, ...)`. SSRFError → returns `{success: false, error: "Refused to fetch: ..."}` with no data leak.

### F-2: P2-by-design — supabase adapter projectUrl

`supabase-adapter.ts` accepts `input.project_url` for insert/select/update operations (L126/L170/etc.). The user is supplying their OWN Supabase project URL with their OWN anon_key — this is the documented BYOK pattern for the supabase tool.

Risk if abused: user can probe internal network with their own Supabase anon_key set as Authorization. The response body returns to them. Material risk:
- They use their OWN anon key — no ToolRoute secret leaks
- They get error responses or HTML from non-Supabase endpoints
- ToolRoute's egress IP visible in target logs (mild reputational risk)

Recommended (deferred — not blocking):
- Validate `projectUrl` matches `^https://[a-z0-9]+\.supabase\.co$` regex
- Or: route supabase BYOK calls through `assertSafePublicUrl` AFTER allowlist check

Not gated as P1 because:
1. Attacker uses their own creds (no ToolRoute secret exposure)
2. Probe surface = whatever the user's OWN anon_key can authenticate to
3. Vercel egress is shared regardless

### F-3 through F-N: CLEAN

Every other adapter uses `${BASE_URL}/...` with user input only as query string or path segment. Path traversal via `${owner}/${model}` cannot escape the URL host (already past the `://host/` boundary). User-supplied URLs that pass through to provider APIs (firecrawl, whisper, mux, removebg, etc.) are the provider's SSRF problem, not ToolRoute's.

## Drift-prevention test

`tests/unit/ssrf-guard.test.ts` — 27 tests:
- 20 unit tests of `assertSafePublicUrl` covering IPv4 ranges, IPv6 special addresses, schemes, malformed inputs
- 5 positive tests for safe public URLs (cloudflare, openai, etc.)
- 2 drift tests asserting playwright/scrape-text contains `assertSafePublicUrl` BEFORE the `fetch(url, ...)` call (per memory rule #65 — per-handler block extraction)

If a future PR removes the guard or moves the fetch above the guard, the drift test fails.

## Cross-applies

- **CallTwin** webhook URL config — same SSRF pattern if user-supplied webhook URLs are validated by callbacks
- **DropClose** any URL-fetching feature (link previews, etc.)
- **JarvisCRM** auto-generated handlers that fetch external resources — generators frequently emit `fetch(input.url)` patterns
- **VibeArmor** scanner targets — already validated (different threat model)
- Future ToolRoute adapters that accept user URLs — must `import { assertSafePublicUrl } from "@/lib/ssrf-guard"` and call BEFORE fetch

## Recommendations (deferred — not blocking)

- **R-1 (P3):** Apply `assertSafePublicUrl` regex-allowlist mode to supabase-adapter project_url (allowlist `*.supabase.co`)
- **R-2 (P3):** Add `assertSafePublicUrl` to twilio-adapter L101 (status callback URL — currently passed to Twilio API as a parameter, but Twilio could in theory fetch it)
- **R-3 (P3):** Consider DNS-rebinding defense — fetch dance with IP pinning (high engineering cost, low payoff for current threat model)
- **R-4 (P3):** Egress IP logging in `gateway_usage_log` for forensics on suspicious URL patterns

## Sibling lanes

- 4.17 (error_message leak audit, CLEAN) — SSRF response body could leak via error_message tail; fix-shipped errors say "Refused to fetch: <reason>" not the URL itself
- 4.21 (CSRF, CLEAN) — distinct attack class, no overlap
- 4.30 (IDOR, CLEAN) — distinct
