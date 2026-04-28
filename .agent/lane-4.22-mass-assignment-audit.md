# Lane 4.22 — Mass-Assignment Audit (Session-Authed Mutation Routes)

**Status:** CLEAN
**Severity:** P1 if exploitable (would let attacker upgrade plan or set credit_balance from request body)
**Date:** 2026-04-28
**Scope:** All `/api/v1/**` mutation routes (PATCH/POST) that authenticate via Supabase JWT Bearer or API key.

## TL;DR

Audited 9 mutation routes for mass-assignment / parameter-tampering vectors. **No findings.** Two patterns are in use, both safe:

1. **Explicit allowlist** (`settings` PATCH) — `ALLOWED_FIELDS` set + per-field type validation, 400s on any unknown key.
2. **Destructured-by-name + literal update/insert objects** — every other route. Body fields never reach the DB by spreading; only the named fields can be updated; `user_id` is always set from session.

Financially-sensitive columns (`plan_id`, `plan_slug`, `credit_balance`, `lifetime_credits`, `lifetime_usage`, `is_active`, `key_hash`, `rate_limit_rpm`) are unreachable through any mutation route.

## Audit method

For each session-authed or API-key-authed mutation route:

1. Read body parsing — destructure-by-name vs. spread vs. `Object.entries(body)`.
2. Trace body fields through to every `.update()` / `.insert()` / `.upsert()` / `.rpc()` call.
3. Verify (a) ownership filters use session-derived ids, (b) sensitive columns are never assigned from body, (c) update/insert object literals contain only known-safe fields.

## Findings per route

### 1. `src/app/api/v1/settings/route.ts:71` — PATCH (gateway_users)

**Pattern:** Explicit allowlist (cleanest).

```ts
const ALLOWED_FIELDS = new Set([
  "auto_topup_enabled", "auto_topup_threshold",
  "auto_topup_amount_cents", "display_name",
]);
for (const [key, value] of Object.entries(body)) {
  if (!ALLOWED_FIELDS.has(key)) return 400;
  switch (key) { /* per-field type + range validation */ }
  updates[key] = value;
}
```

`updates` only ever contains validated whitelisted fields. `.eq("id", userId)` filter from session. **CLEAN.**

### 2. `src/app/api/v1/keys/route.ts:212` — PATCH (api_keys)

```ts
const { key_id, name } = await request.json();
await sb.from("api_keys")
  .update({ name })  // literal — no spread
  .eq("id", keyId).eq("user_id", userId);
```

Only `name` reachable. IDOR-filtered by session `userId`. **CLEAN.**

### 3. `src/app/api/v1/byok/route.ts:5` — POST (byok_keys upsert)

```ts
const { tool_slug, api_key } = await request.json();
await sb.from("byok_keys").upsert({
  user_id: userId,         // session
  tool_slug,
  api_key_encrypted: encrypted,
  // status/metadata — server-controlled
});
```

`user_id` from session. Only `tool_slug` + key material from body. **CLEAN.**

### 4. `src/app/api/v1/checkout/route.ts:31` — POST (Stripe checkout)

```ts
const { type, amount, plan } = await request.json();
// CREDIT_PRICES = { 5, 10, 25, 50, 100 } — closed enum
// PLAN_PRICES = { pro, enterprise } — closed enum
```

`type`/`amount`/`plan` whitelist-validated against closed enums. `userId`/`email` from session. Stripe metadata uses session-derived `user_id`. **CLEAN.**

### 5. `src/app/api/v1/signup/route.ts:85` — POST (gateway_users insert)

```ts
const { email, password, accepted_tos } = await request.json();
await sb.from("gateway_users").insert({
  id: authUserId,           // server-controlled
  email,
  plan_slug: "free",        // literal
  credit_balance: 0,        // literal
  lifetime_credits: 0,      // literal
  lifetime_usage: 0,        // literal
  rate_limit_rpm: 10,       // literal
  // ...
});
```

Every financial field is a literal. Body cannot influence plan/credit/rate-limit. **CLEAN.**

### 6. `src/app/api/v1/billing/setup-payment/route.ts:8` — POST

No body read. All fields from session. **CLEAN.**

### 7. `src/app/api/v1/registry/usage/route.ts:5` — POST (record_usage RPC)

```ts
const { tool_slug, company, action, outcome, duration_ms } = await request.json();
// outcome ∈ ["success","failure","degraded","partial"] — whitelist-validated
```

API-key-authed. All RPC args destructured + outcome whitelisted. **CLEAN for mass-assignment.**

> **P3 follow-up (Lane 4.17 sibling):** line 48 echoes raw `error.message` from the RPC response. Out of scope for this audit; tracked for next observability/error-handling lane.

### 8. `src/app/api/v1/registry/challenge/route.ts:16` — POST (challenge_tool RPC)

```ts
const { challenger_slug, sub_category, scores } = await request.json();
const SCORE_DIMS = ["capability","protocols","cost","maturity",
                    "resale","reliability","ecosystem","agent_native"];
for (const dim of SCORE_DIMS) {
  const v = scores[dim];
  if (typeof v !== "number" || v < 1 || v > 10) return 400;
}
```

Each of 8 score dimensions validated 1-10. **CLEAN.**

### 9. `src/app/api/v1/registry/request/route.ts:5` — POST (log_tool_request RPC)

```ts
const { requested_by, company, need } = await request.json();
```

Three named fields, no spread. **CLEAN.**

## Why this matters

Mass-assignment is the third leg of the auth-stool the gateway sits on:

- **Authn** — Bearer JWT (Lane 4.0+).
- **Authz / IDOR** — `.eq("user_id", session.userId)` filters (Lanes 4.1-4.7).
- **Mass-assignment** — only the fields the route author intends should reach the DB. *(this lane)*

Without it, an attacker who passes Authn + Authz can still hit `PATCH /api/v1/settings` with `{plan_slug: "enterprise", credit_balance: 999999}` and have the DB write it — if the route does `.update(body)` or destructures spread.

**Sibling rule:** RLS would also block most of these writes if the column-grants are tight (Lane 4.6/4.8), but defense-in-depth at the route layer prevents accidental drift if RLS gets relaxed in a future migration.

## Drift prevention — vitest

`tests/unit/mass-assignment-shape.test.ts` enforces:

1. `settings` PATCH still has `ALLOWED_FIELDS` allowlist with the 4 expected keys.
2. No mutation route under `src/app/api/v1/` does `.update(body)` or `.insert(body)` (raw spread of request body).
3. No mutation route assigns `plan_slug`, `plan_id`, `credit_balance`, `lifetime_credits`, `is_active`, or `rate_limit_rpm` from a destructured body field (only literal values allowed for these columns).
4. `keys` PATCH still has `.eq("user_id", userId)` ownership filter.

Test fails master if anyone introduces:
- `await sb.from("X").update(body)` — spread-from-body
- `const { plan_slug } = await request.json()` followed by `.update({ plan_slug })` — body-controlled financial field
- Removal of the `ALLOWED_FIELDS` allowlist on settings

Per Hard Rule #59 — the test is the canonical drift TODO list. CI guards forever once green.

## Cross-applies to

Same audit — destructure-by-name + literal update objects, NEVER spread — should be run on every Justin product with PATCH/POST endpoints:

- **CallTwin** — Vapi config / Twilio number provisioning routes
- **DropClose** — call config / lead routing routes
- **AffixedAI** — template + customer config routes
- **JarvisCRM** — the entire generated-CRM API surface (highest risk — auto-generated routes are most likely to spread)
- **PureUSPeptide2** — checkout customization routes
- **PeptideAI** — inventory / batch routes

10-minute audit per product: grep for `.update(body)`, `.insert(body)`, `.upsert(body)`, then spot-check named-field destructuring patterns.

## Conclusion

ToolRoute mutation surface is mass-assignment-safe today. The drift test locks the property forever. Two patterns are in use — both correct. Recommend the `ALLOWED_FIELDS` allowlist pattern (settings route) as the default for any new mutation route since it makes the intent explicit and rejects unknown keys with a useful error message rather than silently dropping them.
