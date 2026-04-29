# Lane 4.102 — Broken-by-design master-pool class spans 12 adapters, not just stripe + supabase

**Owner:** Claude (auditor)
**Started:** 2026-04-28
**Severity:** HIGH (latent across 10 of 12; LATENT-but-active on 2 with env vars set per Lane 4.100)
**Sibling:** Lane 6.14 (stripe + supabase architectural finding) → **Lane 4.102 (full class enumeration)**

## TL;DR

Lane 6.14 surfaced an architectural finding: the Stripe + Supabase master-pool adapters are operationally broken-by-design — their operations (`list-customers`, `execute-sql`, etc.) target the **API-key-holder's own account**, so a master-pool firing returns ToolRoute's OWN customers / DDL access / etc., NOT the API caller's resources.

This memo verifies that finding generalizes to **12 of the audited master-pool adapters** (every owner-scoped adapter in the catalog, not just the 2 infrastructure providers). The class is broader than ToS-resale alone; the operational shape is fundamentally wrong wherever the upstream API is workspace/account-scoped.

## Three operational classes of master-pool adapter

### Class A — Owner/workspace-scoped (BROKEN-BY-DESIGN — 12 adapters)
Operations target "the resources of whoever holds this API key." Master-pool firing means the API caller sees ToolRoute's resources, not their own.

| Slug | Operations | What master-pool firing leaks |
|---|---|---|
| **stripe** | list-customers, create-payment-link, list-products, get-balance | ToolRoute's Stripe customer list, balance, products — PII + financial (Lane 6.14) |
| **supabase** | execute-sql, list-tables, insert, select | DDL access to gateway DB `isbratmfnnzipzyoefbo` — catastrophic (Lane 6.14) |
| **slack** | send-message, read-channel, list-channels, reply-thread | Messages posted to ToolRoute's Slack; reads ToolRoute channel content |
| **linear** | create-issue, list-issues, update-issue, list-projects | Issues created/read in ToolRoute's Linear workspace |
| **twilio** | send-sms, make-call, list-messages | SMS sent FROM ToolRoute's number; call history exposed |
| **hubspot** | create-contact, search-contacts, create-deal, list-deals | Contacts written to / read from ToolRoute's HubSpot CRM |
| **sentry** | list-issues, get-issue, list-events | ToolRoute's Sentry org error stream exposed |
| **mux** | list-assets (et al) | ToolRoute's Mux video library exposed |
| **notion** | list-pages (et al) | ToolRoute's Notion workspace exposed |
| **linkedin** | profile/post operations | Posts published to ToolRoute's LinkedIn account |
| **apollo** | search-people, etc. | ToolRoute's Apollo seat data consumed |
| **sendgrid** | send-email | Emails sent FROM ToolRoute's verified domain — **damages email reputation + SPF/DKIM/DMARC alignment** |

### Class B — Compute/inference (COGS-only leak)
Caller submits input, gets result. No account-scope leak. Master-pool firing only burns ToolRoute's billable units.

| Slug | Operations | Risk |
|---|---|---|
| claude, openai, replicate | chat / completion | COGS leak (Lane 4.100 ACTIVE) |
| tavily, exa, deepgram, deepl, firecrawl | search / translate / transcribe | COGS leak |
| heygen, shotstack, creatomate, creatify | render video | COGS leak |
| anthropic, vapi (creative ops) | misc | COGS leak |

### Class C — Public-data (no leak, rate-limit uplift only)
Master-pool token only uplifts rate limits on requests against public resources.

| Slug | Operations |
|---|---|
| github | search-repos, get-readme, list-issues (public) |
| dataforseo | SERP scraping |
| outscraper | public-data scraping |

## Why the architectural break is independent of ToS

Lane 6 ToS audit (closed at 18 forbidden + 10 ambiguous + 2 byok-permitted) caught the resale-prohibition class. **Lane 4.102 is orthogonal:** even if Stripe authorized a Connect-equivalent OAuth-per-account pattern, the **current** master-pool adapter shape would still be wrong — the operations don't carry user account_id. The architectural fix is to either:

1. **Delete the adapter** (Lane 6.14 recommendation for stripe + supabase), OR
2. **Rebuild as OAuth-per-account** (each user's BYOK = their workspace token, BYOK gate gives the right caller-scoped semantics).

Option 2 effectively means the BYOK-required gate (Lane 4.100 / Codex #23) is **necessary AND sufficient** for the owner-scoped class — the gate forces every call to carry user-scoped credentials, which is exactly what the operations need to be coherent.

## Implication for Lane 4.100 / Codex #23 priority

**Strengthens the case for #23 P0 priority:** without the BYOK gate, the 12 owner-scoped adapters are not just COGS-leak risks but **data-leak risks** the moment any of those env vars are set in prod. Per Vercel inventory (Lane 4.100):
- Currently set: ANTHROPIC_API_KEY (Class B — COGS only), OPENAI_API_KEY (Class B), STRIPE_SECRET_KEY (different code path — platform billing, not adapter), RESEND_API_KEY (byok-permitted, Class B equivalent).
- NOT set: SLACK_BOT_TOKEN, LINEAR_API_KEY, TWILIO_*, HUBSPOT_ACCESS_TOKEN, SENTRY_AUTH_TOKEN, MUX_*, NOTION_API_KEY, LINKEDIN_*, APOLLO_API_KEY, SENDGRID_API_KEY, STRIPE_PLATFORM_KEY, SUPABASE_MGMT_TOKEN — all 12 Class-A vars are LATENT.

**Latent severity ladder:**
- HIGH-LATENT: any of the 12 Class-A env vars getting set without the BYOK gate landing first = immediate data-leak class breach.
- The 16 Codex tickets pending on the BYOK gate must include "Class-A env vars NEVER get set in prod until gate ships" as a rule, sibling to the "yank ANTHROPIC + OPENAI" P0.

## SendGrid sub-finding

`sendgrid` is in Class A but worse: emails sent via `send-email` go through ToolRoute's verified sender domain (whatever DKIM/SPF is wired). If a user calls `tool:"sendgrid",operation:"send-email"`:
- Master-pool fall-through = email goes from `noreply@toolroute.ai` (or whatever's verified)
- User-supplied subject + body + recipient
- **Email reputation damage class**: spam complaints land on ToolRoute's domain, not the user's
- **Phishing class**: user could send `from: support@toolroute.ai` content to arbitrary recipients

This is also why `sendgrid` is in the 18-forbidden list (Lane 6.12 — Twilio's anti-resale clause inherits to SendGrid post-acquisition). Lane 6.12 was ToS-only; this lane adds the architectural-broken layer.

## Resend caveat (Class B vs Class A boundary)

Lane 6 classified `resend` as `byok_only` permitted. The adapter is structurally similar to sendgrid (`send-email` from a verified sender domain). So WHY is resend OK and sendgrid not?

**Answer:** because resend is a BYOK-only adapter — the BYOK key IS the user's verified-sender API key, and the master-pool fall-through is a config error (returns "no API key configured") rather than fall-through to a ToolRoute domain. Verified by reading the adapter — `getApiKey(byokKey)` returns null without env var, surfacing an explicit error.

Sendgrid's adapter has the same `byokKey || process.env.SENDGRID_API_KEY` shape — so if the env var WERE set, it would have the same email-reputation-damage class. The current state is "permitted because env var unset" — fragile, the env var is the only thing keeping it safe. The BYOK gate would harden this regardless of env-var status.

## Acceptance for this audit memo

- [x] Read 7 owner-scoped adapters to confirm pattern (slack, linear, twilio, hubspot, sentry, notion, sendgrid)
- [x] Cross-referenced Lane 6.14 (stripe + supabase architectural break) and Lane 4.100 (env-var inventory)
- [x] Three-class taxonomy (A owner-scoped / B compute-inference / C public-data) documented
- [x] SendGrid email-reputation sub-finding flagged
- [x] Resend vs SendGrid byok_only-vs-master-pool distinction explained
- [ ] Codex: ticket #23 priority bump P0 (Lane 4.100 already escalated; this lane adds Class-A data-leak class to the rationale)
- [ ] Codex: separate ticket for Lane 6.14 adapter deletion (stripe + supabase) — extend to "audit all 12 Class-A adapters' operational coherence" before keeping any of them.

## Why this matters for /loop directive

The /loop goal is "production-ready financial gateway." The COGS-leak finding (Lane 4.100) is well-documented but underplays the broader class: **once any Class-A env var is set without the BYOK gate, ToolRoute leaks owner-scoped data**, not just dollars. The Justin yank action (ANTHROPIC + OPENAI) closes the active leak path; the prohibition on setting any Class-A env var pre-gate is the **structural rule** to add to the launch-readiness checklist.

This memo is the substrate for that checklist line: **"No Class-A master-pool env var (12 listed above) gets set in prod until `src/lib/byok-slugs.ts` ships AND the gate is wired in `executeToolRequest`."**
