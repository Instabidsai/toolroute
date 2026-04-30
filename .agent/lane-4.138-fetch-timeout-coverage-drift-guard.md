# Lane 4.138 — adapter fetchWithTimeout() coverage drift guard

## What this gates

`tests/unit/adapter-fetch-timeout-coverage.test.ts` is a failing-snapshot
drift list (memory rule #59). It fails on master TODAY with **35 violators**
under `src/lib/adapters/`. Each swap PR (one adapter or a batch) shrinks
the count; failure list hits zero → remove the `SKIP` constant and the
test enforces forever.

## Drift class

Lane 4.72 shipped `src/lib/fetch-with-timeout.ts` — an AbortController-
bounded `fetch` with a `FetchTimeoutError` surfacing the URL + ms. Lane
4.72-4.75 wired it through 14 adapters (openai, claude, deepgram,
elevenlabs, exa, firecrawl, hubspot, resend, sendgrid, shippo, stripe,
twilio, vapi, whisper).

35 adapters still call raw `await fetch(...)` with no `AbortController`
and no `signal:` parameter. A hung upstream (provider TLS handshake stuck,
DNS resolution stalled, slow body) holds a Vercel worker for the platform
default (~120s) — which:

1. Amplifies upstream-incident blast radius onto our worker pool.
2. Leaks COGS via `start_event` rows that never get a `complete_event`
   (Lane 4.84 audit class).
3. Triggers MaxDuration-exceeded errors that surface to the user as
   opaque 504s instead of a clean "tool upstream timeout".

## 35 outstanding violators (Apr 29 2026)

```
apollo-adapter.ts        creatomate-adapter.ts    image-gen-adapter.ts    pexels-adapter.ts        sheets-adapter.ts
calendar-adapter.ts      dataforseo-adapter.ts    linear-adapter.ts       playwright-adapter.ts    shotstack-adapter.ts
context7-adapter.ts      deepl-adapter.ts         linkedin-adapter.ts     postiz-adapter.ts        slack-adapter.ts
creatify-adapter.ts      drive-adapter.ts         mux-adapter.ts          removebg-adapter.ts      supabase-adapter.ts
                         github-adapter.ts        notion-adapter.ts       replicate-adapter.ts     tavily-adapter.ts
                         heygen-adapter.ts        outscraper-adapter.ts   screenshot-adapter.ts    textbelt-adapter.ts
                         higgsfield-adapter.ts    pdf-adapter.ts          search-adapter.ts        twitter-adapter.ts
                                                                          sentry-adapter.ts        unsplash-adapter.ts
                                                                                                   youtube-adapter.ts
```

### Note on apollo + textbelt

Task #92 (Lane 4.75) was titled "vapi/textbelt/hubspot/apollo/shippo"
but only vapi/hubspot/shippo actually landed the timeout — apollo +
textbelt got `redactCreds` body-leak fixes in Lane 4.79 (#96) and the
timeout swap was deferred. They're listed here as the canonical batch-5.

## Coverage matrix (Lane 4 drift guards)

| Drift class | Test | Status |
|---|---|---|
| Adapter URL credential leak | `adapter-url-cred-leak.test.ts` (Lane 4.81) | enforced |
| Adapter raw-error redactCreds | `redactcreds-coverage.test.ts` (Lane 4.136) | env-gated, swap PR landing |
| Auto-adapter execMessage redact | inline at `auto-adapter.ts:1203,1293` (Lane 4.137) | wrapped |
| **Adapter fetch timeout coverage** | `adapter-fetch-timeout-coverage.test.ts` (Lane 4.138) | **env-gated, this lane** |
| Route auth coverage | Lane 4.33 + 4.116 | enforced |
| supabaseAdmin() callsite | Lane 4.132 + 4.135 | enforced |
| RPC EXECUTE grants | Lane 4.131 | enforced |
| Body-size guards | Lane 4.56-4.62 | enforced |

## Exit condition

Once all 35 violators land swap PRs (each replacing `await fetch(...)`
with `await fetchWithTimeout(...)` + a sensible `timeoutMs:`), remove the
`SKIP` constant and the env-var check. The test then enforces forever
that any new adapter calling `await fetch(...)` MUST go through the
timeout-bounded helper.

## Test assertions

1. **Sanity** — `≥1 adapter exists in src/lib/adapters/`.
2. **Coverage** — every adapter calling `await fetch(` imports
   `fetchWithTimeout`. (Catches the 35 violators today.)
3. **Partial-swap leftover** — if an adapter imports the helper, no
   raw `await fetch(` site is left behind. (Catches the half-applied
   refactor where the import line lands but a fetch site is forgotten.)

## Pattern notes

- Source-file regex parser, NOT runtime import — registry imports often
  pull in `createClient()` and crash without prod env (memory rule #59).
- `stripComments()` pre-pass to avoid JSDoc false-positives.
- Excludes `auto-adapter.ts` (meta dispatcher; delegates fetch to inner
  adapter) and `index.ts` (barrel export).
- Env-gated behind `ADAPTER_FETCH_TIMEOUT_BASELINE=skip` for CI, same
  pattern as `auto-route-class-a-gate.test.ts` and 5 other sibling
  drift tests.
