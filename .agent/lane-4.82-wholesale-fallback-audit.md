# Lane 4.82 — Adapter `|| data` wholesale-fallback audit (MEDIUM/metadata-leak)

> **Status:** Audit memo. Inline fix deferred to Codex impl ticket below.
> **Class:** Operational/billing metadata leak on upstream shape drift.
> **Severity:** MEDIUM. Distinct from Lane 4.12 (DB column) and Lane 4.80
> (URL-embedded master key) — those are credential-class. This is the
> wholesale-response-echo class, where adapters fall back to returning the
> entire upstream JSON when the expected nested field is missing.

## Finding

Three adapters have a `data: data.X || data` pattern in their success path.
When the expected field exists, callers get the slimmed-down result. When
upstream changes shape (or returns an error envelope on a 200), callers get
the **entire upstream response** echoed back — including operational
metadata that ToolRoute never intended to expose.

| Adapter | Op | Site | Fallback expression |
|---------|----|------|---------------------|
| `replicate-adapter.ts` | list-models | L146 | `data.results \|\| data` |
| `dataforseo-adapter.ts` | serp | L84 | `data.tasks?.[0]?.result \|\| data` |
| `dataforseo-adapter.ts` | keywords | L124 | `data.tasks?.[0]?.result \|\| data` |
| `dataforseo-adapter.ts` | backlinks | L161 | `data.tasks?.[0]?.result \|\| data` |
| `shotstack-adapter.ts` | render | L74 | `data.response \|\| data` |
| `shotstack-adapter.ts` | get-render | L106 | `data.response \|\| data` |
| `shotstack-adapter.ts` | probe | L143 | `data.data \|\| data` |

## What can leak (per provider)

### Replicate (Bearer auth)
Wholesale fallback exposes `next`/`previous` pagination URL cursors. Cursors
contain opaque tokens — they don't authorize new requests on their own, but
they expose internal IDs and may include account-scoped values.
Credential-leak risk: **none** (Bearer header, body has no creds).

### DataForSEO (Basic auth in header)
Wholesale fallback exposes:
- `cost` — our per-call billing rate (reveals our DataForSEO plan tier)
- `tasks[0].id` — internal task IDs (replayable to re-fetch)
- `tasks[0].cost` — per-task billing
- `version` — DataForSEO platform version (low value)

Credential-leak risk: **none** (Basic auth in header, response body does not
echo Authorization).

### Shotstack (`x-api-key` header auth)
Wholesale fallback exposes `success`/`message` envelopes. The `message`
field on errors-disguised-as-200 may include account-level diagnostics.
Credential-leak risk: **none** (header auth).

## Why this matters

- A future provider switch to body-cred auth on any of these endpoints
  would convert this MEDIUM finding into a HIGH finding overnight (key
  echoed in request, request potentially echoed in response wholesale).
- Even at MEDIUM, exposing our `cost` per call to callers reveals our
  COGS basis on a per-request resolution — competitors can size our
  margin precisely.
- Reveals task IDs that are sometimes replayable (DataForSEO callbacks).

## Recommended fix (Codex impl ticket lane-4.82-impl)

Replace each `|| data` with an explicit empty fallback typed for the
caller's expected shape:

```typescript
// replicate list-models
data: data.results ?? [],

// dataforseo (all 3 ops — result is documented as an array of objects)
data: data.tasks?.[0]?.result ?? [],

// shotstack render / get-render — response is an object
data: data.response ?? null,

// shotstack probe — same
data: data.data ?? null,
```

Caller integrations that relied on the wholesale echo for debugging now get
a typed empty/null. Upstream shape drift becomes a typed `[]`/`null` rather
than a leak. If upstream signaled an error in a 200 response, the adapter
should detect that case earlier (e.g. check `data.status_code` for
DataForSEO, `data.success` for Shotstack) and return `success: false`
instead of echoing.

## Drift prevention

Sibling test to Lane 4.81 (`adapter-url-cred-leak.test.ts`). Vitest scans
all adapters for the regex `data:\s*data\.[^,]+\|\|\s*data` and fails if
any new occurrence appears outside an allowlist (initially empty after the
inline fix lands).

## Codex implementation ticket

```
Title: [lane-4.82-impl] replace `|| data` wholesale-fallback in 7 sites + drift guard

Scope:
- src/lib/adapters/replicate-adapter.ts (1 site → ?? [])
- src/lib/adapters/dataforseo-adapter.ts (3 sites → ?? [])
- src/lib/adapters/shotstack-adapter.ts (3 sites: 2 → ?? null, 1 probe → ?? null)
- For DataForSEO: also detect `data.status_code !== 20000` and return success:false
  with redactCreds(data.status_message ?? "DataForSEO error")
- For Shotstack render/get-render: detect `data.success === false` and surface
  data.message via redactCreds
- Add tests/unit/adapter-wholesale-fallback-drift.test.ts asserting no
  adapter source contains the `data:\s*data\.[^,]+\|\|\s*data` pattern
  (allowlist starts empty, can be widened if a future adapter justifies it)

Validation:
- npx vitest run tests/unit/adapter-wholesale-fallback-drift.test.ts → pass
- npm run build → pass
- Existing adapter tests unchanged
- Manual: stub a 200 response with empty body for each fixed op and verify
  caller gets typed empty value, not the wholesale envelope
```

## Related

- Lane 4.10 — gateway COGS leak class (parent class)
- Lane 4.12 — master/BYOK key DB-column leak (different class, credential)
- Lane 4.80 — screenshot master access_key URL leak (credential class)
- Lane 4.81 — URL-cred-leak drift guard (sibling drift test pattern)
- Hard Rule #18 — `redactCreds()` doesn't apply here (no creds in fallback
  envelope), but the impl ticket should still wrap any error-message extract
  with `redactCreds()` per defense-in-depth.
