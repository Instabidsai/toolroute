# Lane 4.49 — `.select("*")` column-overscope audit

## Scope

Audit Supabase `.select("*")` calls in `src/app/` and `src/lib/` against
tables that contain COGS, PII, credentials, or billing state. Add a
drift guard that fails CI if a future PR introduces `.select("*")`
against any table on the sensitive list.

## Threat model

Supabase JS returns whatever columns the SELECT projects. `.select("*")`
pulls every column on the row, including COGS (`cost_to_us`,
`cost_to_user`), PII (`email`, `stripe_customer_id`, `user_id`), and
credentials (`master_api_key_encrypted`, `byok_encrypted`).

TypeScript narrows the result to the declared interface, so runtime
fields are invisible to a reader of the helper. The bug class:

1. Server Component renders `rows.map(r => <Row id={r.id}/>)`. RSC
   payload only contains the rendered JSX → safe today.
2. Future PR adds an interactive filter as a `"use client"` child and
   passes `rows` as a prop. Full row crosses the RSC boundary. COGS
   ships to every browser.
3. Or: a future PR adds `JSON.stringify(rows)` to a debug embed.

## Findings

Audited every `.select(...)` in `src/app/api/`, `src/app/`, and
`src/lib/`. Result: every API-route `.select(...)` already projects
explicit columns — no overscope on auth-gated routes.

The only `.select("*")` calls in the codebase are in `src/lib/api.ts`
(public catalog: `tools`, `tool_categories`, `category_beliefs`,
`composites`, `skills`) and `src/lib/api-server.ts`
(`inventory`, `usage_events` — registry analytics). None query a
COGS/PII/credential table.

**No live exposure.** Lane 4.49 ships only the drift guard.

## Drift guard

`tests/unit/select-star-on-sensitive-tables.test.ts` walks `src/app/`
and `src/lib/`, finds every `.from("<table>")` followed within 3 lines
by `.select("*")`, fails if `<table>` is in the SENSITIVE_TABLES list:

- `gateway_usage_log` (COGS)
- `gateway_users` (email, stripe_customer_id, credit_balance)
- `gateway_api_keys` (key_hash, allowed_tools)
- `byok_keys`, `user_byok_preferences` (BYOK creds)
- `credit_transactions` (Stripe payment ids)
- `billing_customers`, `stripe_events`
- `auth_users`, `auth_sessions`
- `providers`, `provider_master_keys` (master pool API keys)

Adding a new `.select("*")` against any of those fails CI.

## Excluded on purpose

- `usage_events` / `inventory` — registry analytics, not COGS/PII. The
  existing `.select("*")` calls match a stale TS type (`UsageEvent`
  declares `tool_slug`; the live row has `tool_id`). Tightening here
  surfaced the type-drift bug in build (filed as a separate task,
  Lane 4.50). Keeping `.select("*")` for now until the type/page
  refactor lands.
- Public catalog tables (`tools`, `category_beliefs`, etc.).

## Currently exploitable?

No — every audited route already projects explicit columns. The drift
guard prevents the class entering the codebase as new sensitive routes
are added.
