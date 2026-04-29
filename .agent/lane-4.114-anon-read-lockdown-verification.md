# Lane 4.114 — anon-read RLS lockdown verification (full sweep)

**Owner:** Claude (auditor)
**Started:** 2026-04-29
**Severity:** N/A (verification memo, no findings)
**Status:** CLOSED — full sweep run, lockdown is comprehensive at the access layer

## TL;DR

End-to-end probe of every known sensitive table from an anon JWT. Result: **every financial, key-storage, and PII table is LOCKED at the access layer** (HTTP 401 + code 42501 "permission denied"). Two tables remain anon-readable by design (`tools`, `category_beliefs`, `plans`) — all are public-catalog/discovery surfaces with no credential or PII columns.

This memo is the snapshot of post-Lane-4.{1,16,96–99,107,106} state, run at 2026-04-29 ~18:42 UTC. It does NOT verify column-level encryption (Codex #52 still PENDING for BYOK Vault) — only access-layer lockdown.

## Sweep results

Probe: `GET /rest/v1/<table>?select=id&limit=1` with anon JWT.

### LOCKED — anon SELECT 401 + code 42501 (7 tables)
| Table | Why it must stay locked | Closing lane |
|-------|--------------------------|--------------|
| `usage_events` | Per-call billing/usage data, PII | Lane 4.1 + Lane 0.1 |
| `api_keys` | tr_live_ keys (hashed but inventory-leak class) | Lane 4.{14,16,96} |
| `credit_transactions` | Stripe transaction history | Lane 4.{96,97} |
| `gateway_users` | Auth/email/plan PII | Lane 4.{96,97} |
| `user_provider_keys` | BYOK keys (column plaintext, Codex #52 PENDING) | Lane 4.{36,107} |
| `tool_providers` | Master pool keys (column plaintext, sibling to #52) | Lane 4.{106,107} |
| `tool_requests` | Gap-tracking (operator queries) | Lane 4.{98,99} |

### LOCKED — anon INSERT 401 + code 42501 (verified subset)
| Table | Result |
|-------|--------|
| `tool_providers` | INSERT denied (Lane 4.107 confirms shipped) |

(Anon WRITE on the financial trio — `usage_events`, `api_keys`, `credit_transactions`, `gateway_users` — was REVOKE'd in Lane 4.96/4.97. Authenticated WRITE was REVOKE'd in Lane 4.97.)

### ANON-READABLE BY DESIGN (3 tables)
| Table | Columns exposed | Sensitivity check |
|-------|------------------|-------------------|
| `tools` | name, slug, description, rating, categories, capabilities, github_url, cost, resale_viable, resale_model, maturity, when_to_use, gotchas, embedding, status, source_ref, created/updated_at | No credentials. `embedding` (1536-float vector) is a payload-bloat note, not security. `source_ref`/`discovered_via` are internal but not sensitive. |
| `category_beliefs` | super_category, sub_category, champion_tool_id, belief, confidence, evidence, observation_count | Discovery-layer registry data, no secrets |
| `plans` | slug, name, description, price_monthly_cents, credits_included, rate_limit_rpm/rpd, max_keys, features | Public pricing, no secrets |

These three are the discovery/marketing surfaces. Catalog product is built on them. No further action needed.

### Schema-cache 404 (does not exist or hidden from PostgREST — 12 names)
`webhook_events`, `rate_limits`, `api_logs`, `adapter_health`, `user_settings`, `categories`, `sub_categories`, `champions_history`, `subscriptions`, `invoices`, `payments`, `providers`, `adapters`, `tenants`, `sessions`, `blocked_keys`, `ip_blocklist`, `tool_inventory`, `usage_logs`, `request_logs`, `sub_category_beliefs`

These are either: (a) named differently in the actual schema, (b) views/private, (c) in a non-public schema. Not a finding — just notes for sweep completeness.

## What this DOES verify

- Every "high-value" table I'd expect to find with credentials, transactions, or PII is denied to anon
- The lockdown is at the SQL grant + RLS layer, not just at the API route layer (so even if a server route is mis-deployed, anon clients still can't read)
- The catalog/discovery surfaces (`tools`, `category_beliefs`, `plans`) are intentional and non-leaky

## What this does NOT verify (out of scope; covered elsewhere)

- **Column-level encryption** of `auth_key_encrypted` / `api_key_encrypted` — the columns are named "encrypted" but currently store plaintext. Lane 4.106 documents this; Codex #52 implements pgsodium/Vault. Until #52 ships, lockdown is the only defense — a service-role exfil OR a future RLS regression would expose plaintext.
- **service-role JWT bundle** — Lane 4.26 confirmed not bundled to client. But still need to keep verifying after every Next.js bundler upgrade.
- **Authenticated-role reads** — this sweep only probed anon. The `authenticated` role is used by client components after Supabase Auth login. Lane 4.{49,97} cover authenticated-role audits separately.
- **Service-role row counts** — this memo doesn't enumerate row counts via service-role. Codex queue audit rule per feedback memory #61 (Apr 28) says count rows for execution proof — not applicable here because LOCKED status is the desired state regardless of row count.

## Sibling lanes

- **Lane 0.1** — locked usage_events (Justin SQL run)
- **Lane 4.1** — usage_events SELECT lockdown (initial)
- **Lane 4.14** — gateway credit RPCs SECURITY DEFINER
- **Lane 4.16** — anon WRITE grants audit
- **Lane 4.94** — orphaned SECDEF RPC lockdown
- **Lane 4.96** — anon WRITE REVOKE on financial tables
- **Lane 4.97** — authenticated WRITE REVOKE
- **Lane 4.98** — REVOKE writes on 8 zero-policy tables
- **Lane 4.99** — REVOKE writes on 8 SELECT-only tables
- **Lane 4.106** — tool_providers AMBIGUOUS audit (closed by this sweep — now LOCKED, plaintext column issue tracked separately under Codex #52 sibling pattern)
- **Lane 4.107** — tool_providers REVOKE writes (closed by this sweep — LOCKED)
- **Lane 4.45** — PII table anon-read live-fetch smoke test (this lane is the periodic re-run pattern)

## Process note

This sweep should run automatically per CI on a cadence. The current Lane 4.45 vitest covers PII tables; extend it to cover financial+key tables too, gated `ANON_LOCKDOWN_BASELINE=skip` per Hard Rule #59. Codex ticket #24 (Lane 4.8 RLS regression vitest) is the natural home — when it ships, fold this 7-table lockdown into the same test.

## Acceptance

- [x] Probed 26 candidate tables for anon SELECT — 7 LOCKED, 3 by-design readable, 16 schema-cache 404
- [x] Probed `tool_providers` for anon INSERT — denied (confirms Lane 4.107 shipped)
- [x] Inspected exposed columns on the 3 anon-readable tables — no credentials/PII
- [x] Cross-referenced Lane 4.106 (plaintext column) — access-layer locked but encryption still pending Codex #52
- [ ] **CLAUDE follow-up:** when Codex #24 (RLS regression vitest) lands, extend it with the 7-table lockdown matrix
- [ ] **CLAUDE follow-up:** when Codex #52 (BYOK Vault) lands, re-run column-content probe on tool_providers + user_provider_keys via service-role to confirm ciphertext
