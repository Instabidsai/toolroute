# Lane 4.83 — `redactCreds()` Coverage Gap Audit (47 adapters)

**Class**: defense-in-depth credential leakage in `gateway_usage_log.error_message`
**Severity**: MEDIUM (no live leak today; tail-risk if any provider starts echoing auth into 4xx body)
**Date**: 2026-04-28
**Sibling lanes**: 4.17 (helper introduction), 4.76 (Tavily), 4.79 (Apollo + Textbelt)
**Hard rule**: #18 (Cloudflare/provider-side error-body echo can wrap creds)

---

## Summary

`src/lib/redact-creds.ts` shipped in Lane 4.17 to scrub provider-key shapes
(`Bearer …`, `sk-…`, `xai-…`, `tr_live_…`, etc.) from any `errText` we persist
to `gateway_usage_log.error_message`. Tavily (PR #102 — Lane 4.76) and
Apollo + Textbelt (PR #104 — Lane 4.79) are the first three adapters wired up.

**Gap on `origin/master` (988d815):**

| Metric | Count |
|---|---|
| Adapters that extract `errText = await res.text()` | **47** |
| Adapters that wrap that `errText` with `redactCreds()` | **0** |

Once #102 and #104 merge that becomes 47 / 3. The remaining 44 keep the same
defense-in-depth gap: any provider that ever echoes an auth header / body
field into a 4xx or 5xx response body smuggles a master-pool key (or BYOK
key) straight into our ops log.

The `redactCreds()` patterns already cover every cred shape we use, so the
fix is mechanical: wrap the `errText` interpolation site.

---

## Classification by auth pattern (origin/master)

### Body-cred (API key in JSON body) — HIGHEST risk

If a provider ever 400s with `"echo":{"api_key":"<the key>"}` or returns the
request payload in an error envelope, the body-cred class leaks the master
key wholesale. These three are highest priority.

- `apollo-adapter.ts` — `api_key: apiKey` in body (covered by PR #104)
- `tavily-adapter.ts` — `api_key: apiKey` in body (covered by PR #102)
- `textbelt-adapter.ts` — `key: apiKey` in body (covered by PR #104)

### Bearer-auth (15 adapters) — MEDIUM

Standard `Authorization: Bearer <key>` header. Risk model: provider's own
4xx/5xx logger echoes the inbound `Authorization` header into the response
body. Several real providers do this in dev modes (Sentry, Stripe-test,
Replicate's 422 echoes have included headers historically).

`creatomate-adapter.ts`, `firecrawl-adapter.ts`, `higgsfield-adapter.ts`,
`hubspot-adapter.ts`, `notion-adapter.ts`, `openai-adapter.ts`,
`postiz-adapter.ts`, `replicate-adapter.ts`, `resend-adapter.ts`,
`sendgrid-adapter.ts`, `sentry-adapter.ts`, `sheets-adapter.ts`,
`stripe-adapter.ts`, `vapi-adapter.ts`, `whisper-adapter.ts`

### x-api-key header (7 adapters) — MEDIUM

Same risk shape as Bearer but rarer to see header echo in the wild.

`claude-adapter.ts`, `creatify-adapter.ts`, `exa-adapter.ts`,
`heygen-adapter.ts`, `outscraper-adapter.ts`, `removebg-adapter.ts`,
`shotstack-adapter.ts`

### Basic auth (2 adapters) — MEDIUM

`Authorization: Basic <base64(user:pass)>` — same echo risk.

`dataforseo-adapter.ts`, `mux-adapter.ts`

### Other / mixed (~20 adapters)

OAuth Bearer tokens (Google: `calendar`, `drive`, `sheets`), GitHub PAT,
provider-specific schemes (Twilio Account SID + Auth Token, Slack OAuth,
Twitter OAuth 1.0a, Linear key, LinkedIn OAuth, ElevenLabs xi-api-key,
Deepgram Token, DeepL DeepL-Auth-Key, Pexels Authorization header, Postiz
custom, ImageGen custom, Search custom, Shippo Token, YouTube Bearer,
PDF-adapter custom).

All carry the same defense-in-depth class. The redactor already covers
every cred shape we use — wrapping is mechanical.

---

## Why this matters even though no live leak exists today

1. **Hard Rule #18**: Cloudflare-fronted providers blocked our default UA
   and dumped the auth header into the 403 body. The redactor was added
   precisely because we observed this in the wild for one provider.
2. **Provider-side regressions**: A vendor adding a verbose-error mode in a
   point release becomes a credential-leak event for us overnight. The fix
   needs to be in our serialization path, not their behavior.
3. **BYOK class**: When a customer's BYOK key leaks into our log it's our
   incident, not the provider's — we promised not to retain plaintext keys.
4. **Audit posture**: A SOC 2 / pentest finding lands easier when the
   defense-in-depth is uniform across all 47 adapters than when it's
   spotted in three.

---

## Recommended fix — `[lane-4.83-impl]` Codex ticket

**Sequencing constraint**: must merge AFTER PRs #102 (Tavily) and #104
(Apollo + Textbelt) to avoid touching the same lines. Branch from
`origin/master` after both land.

**Mechanical change**: every adapter file with this shape

```ts
const errText = await res.text().catch(() => res.statusText);
return {
  success: false,
  error: `<provider> <op> failed: ${res.status} ${errText}`,
  provider: "<slug>",
};
```

becomes

```ts
import { redactCreds } from "../redact-creds";
// …
const errText = await res.text().catch(() => res.statusText);
return {
  success: false,
  error: redactCreds(`<provider> <op> failed: ${res.status} ${errText}`),
  provider: "<slug>",
};
```

**Adapter list (44 remaining after #102 + #104)**:

calendar, claude, creatify, creatomate, dataforseo, deepgram, deepl, drive,
elevenlabs, exa, firecrawl, github, heygen, higgsfield, hubspot,
image-gen, linear, linkedin, mux, notion, openai, outscraper, pdf, pexels,
postiz, removebg, replicate, resend, screenshot, search, sendgrid, sentry,
sheets, shippo, shotstack, slack, stripe, supabase, twilio, twitter,
unsplash, vapi, whisper, youtube.

**Drift guard** (sibling test, ride along with the impl PR):

`tests/unit/redactcreds-coverage.test.ts` — fails on master if any
adapter file matches `errText` extraction without `redactCreds` import.
Pattern: walk `src/lib/adapters/*.ts`, regex
`errText\s*=\s*await\s+res\.text` AND `error:\s*\`[^\`]*\$\{errText\}`,
require `import.*redactCreds` in the same file. Allowlist = empty after
this lane lands (currently would be `["tavily","apollo","textbelt"]`
during the PR window).

This formalizes the invariant per memory rule #59 (failing-snapshot test
as drift TODO list).

---

## Acceptance

- [ ] All 44 remaining adapters wrap their `errText` interpolation in
  `redactCreds()`.
- [ ] `tests/unit/redactcreds-coverage.test.ts` is added and passes
  with empty allowlist.
- [ ] `npm run build` clean.
- [ ] No behavioral change to success path.

## Out of scope

- Wrapping `err.message` from the outer `catch (err)` blocks. The redactor
  already covers `error instanceof Error ? err.message : String(err)` if
  needed, but `err.message` from `fetch()` rejects rarely contains creds
  (mostly DNS / TLS / connection errors). Defer to a follow-on lane only
  if a real leak is observed.
- Redacting structured `details` payloads. We don't currently surface
  upstream JSON bodies as structured fields — only the `errText` flat
  string. If that changes, redact at the new serialization site too.
