# Lane 4.136 — adapter redactCreds() coverage drift guard

## What this guards

Lane 4.18 shipped `redactCreds()` (`src/lib/redact-creds.ts`) — a regex-
based scrubber covering Bearer/Token, sk-/sk-ant-/sk-proj-/xai-/gsk_/
rk_/tvly-/tr_live_, and generic `api_key=` shapes. Three adapters
were retrofitted that lane (tavily — Lane 4.76; apollo + textbelt —
Lane 4.79).

The Lane 4.83 audit found **44 remaining adapters** still echo
`errText = await res.text()` straight into `error: \`<provider>
failed: ${res.status} ${errText}\`` without the wrap. Gateway returns
the adapter result verbatim (Lane 4.18 audit invariant), so a
misconfigured 401/403 from the upstream provider can leak the
caller's bearer / api-key back through `result.error`.

This lane ships CI enforcement so the swap PRs (one per adapter, or
one mechanical batch) have a green-light signal — and so a future
adapter added to the registry can't omit the wrap silently.

## Drift class

```ts
// BUG: raw provider error body interpolated into result.error.
const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
if (!res.ok) {
  const errText = await res.text();
  return {
    success: false,
    error: `Provider failed: ${res.status} ${errText}`,  // ← errText may echo the bearer
    provider: "<slug>",
  };
}
```

If the upstream provider's 401 body says `{"error":"invalid bearer
sk-ant-...", "echoed_header":"Authorization: Bearer sk-ant-..."}` (some
providers DO echo back the failed credential), the caller sees their
own key in `result.error` — and worse, BYOK keys belonging to other
users in the master-pool fallback path could appear.

## Mechanical fix per adapter

```ts
import { redactCreds } from "../redact-creds";
// …
return {
  success: false,
  error: redactCreds(`<provider> <op> failed: ${res.status} ${errText}`),
  provider: "<slug>",
};
```

## What the test enforces

Three assertions over `src/lib/adapters/*-adapter.ts` (excluding
`auto-adapter.ts` — meta-dispatcher whose error paths surface the
inner adapter's already-redacted result, and `index.ts` — barrel):

### 1. Sanity: ≥1 adapter file exists

Guards against a refactor that moves adapters out of
`src/lib/adapters` — the test would otherwise silently pass.

### 2. Every adapter with `errText = await res.text()` + `error:` interpolation imports redactCreds

Regex pair (both must match — adapters that only do extraction or
only build error strings without errText interpolation aren't in
the drift class):
```ts
/errText\s*=\s*await\s+res\.text\s*\(/
/error\s*:\s*`[\s\S]*?\$\{[\s\S]*?errText[\s\S]*?\}[\s\S]*?`/
```
And the import gate:
```ts
/import\s*\{[^}]*\bredactCreds\b[^}]*\}\s*from\s*["'][^"']*redact-creds["']/
```

### 3. Every adapter with the passthrough pattern wraps with `redactCreds(\`...${errText}...\`)`

The canonical wrap shape per the Lane 4.83 audit memo's prescribed
fix. Catches the case where someone imports redactCreds but uses
it on the wrong field (e.g., wraps the header instead of the body).

## Source-file regex parser

Memory rule #59 hygiene — never `import` runtime modules in
tests, they pull in `createClient()` and crash without prod env.
All assertions use `readFileSync` + regex over source text.
Comment-strip pass (block + line) before regex check so JSDoc
references like `// errText = await res.text()` in a code example
don't false-positive.

## Failing-snapshot pattern (memory rule #59)

The unguarded test fails on master with **43 violators** —
exactly the 44-adapter list from the Lane 4.83 audit minus
linear-adapter.ts (which uses `throw new Error(...)`, not
`error: \`...\``, putting it in a different drift class handled
by gateway-side error sanitization).

Per memory rule #59: failing-snapshot test as drift TODO list.
The 43-line failure output IS the canonical fix list. As each
swap PR merges, the failure count shrinks. Hits zero → CI guards
forever against regression.

**Env-gated** behind `ADAPTER_REDACTCREDS_BASELINE=skip` so CI
stays green while the mechanical wrap PR(s) ship. Sibling pattern
to Lane 4.113-test (`AUTO_ROUTE_GATE_BASELINE=skip`) and the
marketing-snippet drift test.

**Exit condition**: once the failure list hits zero, remove the
`SKIP` constant from this test file (or set the env var to a
non-skip value in CI).

## Adapter list (43 violators on master, alphabetical)

```
calendar, claude, creatify, creatomate, dataforseo, deepgram, deepl,
drive, elevenlabs, exa, firecrawl, github, heygen, higgsfield, hubspot,
image-gen, linkedin, mux, notion, openai, outscraper, pdf, pexels,
postiz, removebg, replicate, resend, screenshot, search, sendgrid,
sentry, sheets, shippo, shotstack, slack, stripe, supabase, twilio,
twitter, unsplash, vapi, whisper, youtube
```

Already compliant (Lane 4.18 / 4.76 / 4.79):
```
apollo, tavily, textbelt
```

Out of scope (different error shape):
```
linear (throw new Error — gateway-catch path)
context7, playwright, toolroute (no res.text() error path)
```

## Coverage matrix (post Lane 4.136)

| Drift class | Guard |
|---|---|
| Service-role JWT in source | Lane 4.26 + 4.132 + 4.135 |
| supabaseAdmin() in lib helper | Lane 4.132 |
| supabaseAdmin() in app/route helper | Lane 4.135 |
| RPC-callable mint surface | Lane 4.131 |
| Sensitive column WRITE drift | Lanes 4.121–4.130 |
| Sensitive table READ drift (IDOR) | Lane 4.133 |
| Route missing auth class | Lane 4.33 + 4.116 |
| Webhook signature bypass | Lane 4.20 + 4.29 |
| Admin route missing validateAdmin gate | Lane 4.134 |
| Adapter raw-error credential leak | **Lane 4.136 (this lane)** |

Sibling guards: Lane 4.18 (redactCreds definer + first 3 callsites),
Lane 4.83 (manual audit), Lane 4.81 (URL cred-leak drift guard for
GET-style adapters).
