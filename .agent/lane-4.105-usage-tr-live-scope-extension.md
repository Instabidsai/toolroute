# Lane 4.105 — `/api/v1/usage` GET dual-auths tr_live_ + session; outlier vs. peer endpoints, extends leaked-key blast radius

**Owner:** Claude (auditor)
**Started:** 2026-04-28
**Severity:** MEDIUM (privilege-scope drift; tr_live_ holder's own data; no cross-tenant leak)
**Sibling:** Lane 4.30 (mutation-route IDOR audit) → Lane 4.33 (route auth coverage) → **Lane 4.105 (read-route auth-mode drift)**

## TL;DR

`/api/v1/usage` GET is the **only session-authed read endpoint** that ALSO accepts `tr_live_`/`tr_test_` API keys. Every other session-authed endpoint (`byok` GET, `keys` GET, `settings` GET, `checkout` POST, `billing/setup-payment` POST, `signup` POST) is session-only. This asymmetry extends the blast radius of a leaked `tr_live_` key from "execute tools (cost real money)" to "read full audit trail of customer integrations."

**Operational meaning:** when a customer's `tr_live_` key leaks (env-var pushed to GitHub, agent log scraped, prompt-injection exfil) the attacker today gets `/api/v1/execute` access. Adding `/api/v1/usage` GET to the leak's reachable surface gives them: every tool the customer has called, which provider routed each call, latency profile, dollar costs, and `error_message` content — i.e., a near-complete map of what the customer is automating.

## File:line evidence

### `src/app/api/v1/usage/route.ts:10-21` — dual-auth resolver
```typescript
async function resolveUserId(request: NextRequest): Promise<string> {
  const authHeader = request.headers.get("authorization");
  const rawToken = authHeader?.slice(7) ?? "";

  if (rawToken.startsWith("tr_live_") || rawToken.startsWith("tr_test_")) {
    const ctx = await validateRequest(authHeader);
    return ctx.userId;
  }

  const { userId } = await getUserFromSession(authHeader);
  return userId;
}
```

### Comparison — peer endpoints are session-only

| Endpoint | Auth pattern | File:line |
|---|---|---|
| `/api/v1/byok` GET/POST/DELETE | `getUserFromSession` only | `byok/route.ts:8, 68, 103` |
| `/api/v1/keys` GET/POST/DELETE/PATCH | `getUserFromSession` only | `keys/route.ts:14, 105, 144, 215` |
| `/api/v1/settings` GET/PATCH | `getUserFromSession` only | `settings/route.ts:9, 74` |
| `/api/v1/checkout` POST | `getUserFromSession` only | `checkout/route.ts:34` |
| `/api/v1/billing/setup-payment` POST | `getUserFromSession` only | `billing/setup-payment/route.ts:11` |
| **`/api/v1/usage` GET** | **`tr_live_` OR session** | **`usage/route.ts:10-21` (outlier)** |

Single endpoint outlier — clear privilege-scope drift.

### Data exposed via tr_live_ path

`usage/route.ts:43-49`:
```typescript
.from("gateway_usage_log")
.select(
  "id, tool_slug, provider_used, response_status, latency_ms, cost_to_user, error_message, created_at"
)
.eq("user_id", userId)
.order("created_at", { ascending: false })
.range(offset, offset + limit - 1);
```

- `limit` clamped 200, `offset` clamped 100,000 → effectively unlimited paging.
- Filterable by `tool_slug`, `start_date`, `end_date`.
- No `prefer_own_key`/BYOK fields — narrow column shape, but full audit trail.

## Concrete leak scenarios

### Scenario A — leaked tr_live_ in agent code
Customer ships an OpenAI Functions integration; their CI logs the bearer token once during setup. Attacker scrapes GitHub Actions logs, recovers `tr_live_xxx`, calls:
```
GET /api/v1/usage?limit=200&offset=0
GET /api/v1/usage?limit=200&offset=200
... (paginate through entire history)
```
Returned: every tool the customer integrated (slug names map to product capabilities), provider routing decisions, error_message contents (post-redactCreds — Lane 4.18 — but still includes generic adapter failure modes which leak integration topology).

**Without `/api/v1/usage` GET dual-auth:** attacker can only call `/api/v1/execute` (drains credits). With it: attacker maps the customer's full automation footprint before stealing credits.

### Scenario B — competitive intelligence
A leaked tr_live_ key from a competitor reveals: "they call `tool:claude` 10K times/day for `op:chat`, then `tool:tavily` for `op:search`, then `tool:resend` for `op:send-email`" — competitive-intel-grade signal even without payload content.

### Scenario C — error_message leak class
Lane 4.18 ships `redactCreds()` covering credential-shaped tokens, but `error_message` can still contain:
- Internal repo names mentioned in adapter errors (e.g., GitHub adapter 404 with `{owner}/{repo}` echoed)
- Webhook URLs / SSRF probe responses
- Customer-supplied data in error contexts (e.g., user IDs, API endpoints they're hitting)

A session-authed endpoint already exposes this to the user, but extending to `tr_live_` widens the leak vector.

## Why this isn't catastrophic (severity MEDIUM, not HIGH)

1. **No cross-tenant leak.** `eq("user_id", userId)` properly binds — only the key holder's own data.
2. **error_message redaction.** Lane 4.18 `redactCreds()` removes credential shapes before persistence.
3. **Tr_live_ keys are paid-plan gated.** Lane 4.3 already gates `tr_live_` creation; `tr_test_` is the hobby tier (limited blast radius).
4. **The data is user-owned.** It's not a confidentiality breach — it's a privilege-scope drift where leaked-key blast radius widens.

## Why it's still worth fixing (vs. just documenting)

1. **Pattern asymmetry == latent bug magnet.** Future engineer copies `/api/v1/byok` GET as a template, sees it's session-only, and now has two patterns to choose from. Drift compounds.
2. **`/api/v1/keys` GET (lists tr_live_ key metadata) is intentionally session-only** — adding tr_live_ auth to `/api/v1/usage` while keeping `/api/v1/keys` session-only is internally inconsistent. If the principle were "tr_live_ can read its own data," `/api/v1/keys` should accept tr_live_ auth too (it doesn't, by design).
3. **Customer-grade observability is better served by a dedicated `/api/v1/me/usage` (tr_live_-only, scoped) endpoint** than by overloading `/api/v1/usage` (session-design dashboard endpoint).

## Mitigation options

### Option 1 — make `/api/v1/usage` session-only (matches peers)
Drop the `resolveUserId` helper, replace with `const { userId } = await getUserFromSession(authHeader);`. One-line patch. Minor breaking change for any agent-code callers using tr_live_ on this endpoint.

### Option 2 — split into two endpoints
- `/api/v1/usage` — session-only (dashboard use)
- `/api/v1/me/usage` — tr_live_-only (programmatic use)

Cleaner semantics; allows scope claims later. Heavier change.

### Option 3 — formalize tr_live_ scope claims
Extend the `api_keys.allowed_tools` field to include scope claims (`read:usage`, `write:execute`, etc.). Default to `{execute}` for new keys; require opt-in for `read:usage`. Most defensible long-term posture.

**Recommendation:** Option 1 for now (one-line revert to session-only matches peer pattern + closes the asymmetry). Option 3 is the right long-term move tied to the BYOK gate ticket scope (Codex #23) — when adding scope-aware checks, do it everywhere.

## Acceptance for this audit memo

- [x] All 6 session-authed v1 routes read; only `/api/v1/usage` accepts tr_live_
- [x] Peer-endpoint comparison table built from grep evidence
- [x] Data-shape exposure documented (7 columns, filterable, paginated)
- [x] redactCreds() coverage cross-referenced (Lane 4.18) — error_message redaction confirmed
- [x] Three leak scenarios traced
- [ ] Codex: Option 1 patch — one-line replace `resolveUserId(request)` → `getUserFromSession(authHeader)`. OR
- [ ] Codex: tie to Lane 4.36-impl/Codex #23 scope-claims rework (Option 3, heavier).

## Why this matters for /loop directive

The /loop goal is "production-ready financial gateway." Privilege-scope asymmetries between peer endpoints are the kind of thing that ships unnoticed because nothing fails — every endpoint works. They surface only when (a) someone audits the matrix or (b) a key leaks and the post-mortem asks "why was usage data reachable from a leaked tr_live_?"

This memo is the audit-matrix view: 6 session-authed read endpoints, 1 outlier, named.
