# ToolRoute Provider Deep-Dive Register

Status: active operating register
Owner: ToolRoute launch operator
Last updated: 2026-05-01

## Purpose

This is the durable place to save findings for every service ToolRoute offers.
The product pivot is not "we hold one upstream key and let every agent use it."
The launch-safe product is:

1. Every agent/customer gets one ToolRoute account boundary.
2. ToolRoute issues separate management keys and execution keys.
3. Provider credentials are isolated per ToolRoute user and provider.
4. ToolRoute-funded provider pools are allowed only after contract, partner, or
   written provider approval.
5. The catalog must tell agents what they can do now, what setup is required,
   and what is blocked.

This register is intentionally reviewable in git. Operational APIs expose the
current launch verdict through:

- `GET /api/v1/tools`
- `GET /api/v1/provider-requirements`
- `GET /api/v1/agent/manifest`

## Agent Isolation Model

The one-key promise is one ToolRoute key per agent/account, not one shared
provider key for everyone.

Isolation boundaries:

- Tenant root: `gateway_users.id`.
- ToolRoute key ownership: `api_keys.user_id`; key reassignment is forbidden.
- Key scopes: management keys manage account setup; execution keys call tools.
- Provider credential ownership: `user_provider_keys.user_id + tool_slug`.
- Billing ownership: `credit_transactions.user_id` and `gateway_usage_log.user_id`.
- Execution ownership: every gateway call resolves a `GatewayContext` before
  provider selection, BYOK lookup, rate limit, credit deduction, and usage log.
- Cross-agent data rule: no agent can read, use, mutate, or infer another
  agent's provider keys, balances, usage, tasks, or billing state.

Provider credential modes:

- `native`: ToolRoute-owned/internal capability; no external credential.
- `customer_byok`: customer/agent provides a provider key through `/api/v1/byok`.
- `customer_oauth`: customer/provider consent is required; not fully humanless
  until OAuth or connected-account APIs exist.
- `pool_contract_required`: ToolRoute-funded pooled execution needs partner,
  reseller, marketplace, OEM, or written provider approval first.
- `unavailable`: do not offer until waiver, legal decision, implementation, or
  adapter removal is complete.

## Definition Of Good

A provider is "production-good" only when every item below is true:

1. Catalog truth: `GET /api/v1/tools` has the correct `offerability` verdict.
2. Setup truth: `GET /api/v1/provider-requirements` tells an agent the exact
   required setup path and blockers.
3. Credential isolation: provider keys/tokens are stored per `user_id` and are
   never pooled unless contract-approved.
4. Execution isolation: runtime uses only the caller's ToolRoute key, user id,
   provider key, credits, rate limits, and allowed tool scope.
5. Billing attribution: every paid call logs ToolRoute cost, customer cost,
   key source, user id, API key id, provider, and request id.
6. Failure behavior: missing key, missing OAuth, insufficient balance,
   unavailable provider, and upstream failure all return clear machine-readable
   errors without leaking secrets.
7. Provider terms: resale/pooling verdict has source evidence and a recheck
   date.
8. Agent UX: an agent can discover, fund, set up, execute, and inspect usage by
   API without needing a dashboard except where provider payment/OAuth requires
   browser consent.
9. Verification: at least one smoke or unit guard proves the setup verdict and
   execution path cannot silently drift.

## Deep-Dive Template

Use this block when refreshing a provider:

```md
### <adapter_slug>

- Launch verdict:
- What this provider does:
- ToolRoute value:
- Agent setup path:
- Credential owner:
- Isolation design:
- Billing model:
- Rate/quota model:
- Data handling:
- Failure modes:
- Provider terms evidence:
- Contract/OAuth/partner work needed:
- Production smoke:
- Remaining blocker:
- Next review date:
```

## Current Provider Register

| Adapter | Launch class | Credential owner | Agent setup path | Isolation design | Evidence source | Next deep dive |
|---|---|---|---|---|---|---|
| `apollo` | unavailable | none | contact support | blocked at catalog/runtime | lane-6.7 verified BYOK list | decide remove vs waiver |
| `auto` | native | ToolRoute internal | none | caller context dispatch only | source grep and internal adapter | verify billing attribution |
| `calendar` | customer_oauth | customer/provider OAuth | OAuth consent required | token per user/provider | lane-6.7 verified BYOK list | design OAuth connection API |
| `claude` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | lane-6.7 verified BYOK list | refresh Anthropic terms |
| `context7` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | lane-6.7 verified BYOK list | verify Upstash terms |
| `creatify` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | lane-6.7 verified BYOK list | source current ToS |
| `creatomate` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | lane-6.7 verified BYOK list | source current ToS |
| `dataforseo` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | lane-6.7 verified BYOK list | verify search resale limits |
| `deepgram` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | lane-6.7 verified BYOK list | verify partner path |
| `drive` | customer_oauth | customer/provider OAuth | OAuth consent required | token per user/provider | lane-6.7 verified BYOK list | design OAuth connection API |
| `elevenlabs` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | lane-6.7 verified BYOK list | verify OEM path |
| `exa` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | lane-6.7 verified BYOK list | refresh terms |
| `firecrawl` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | lane-6.7 verified BYOK list | confirm paid resale option |
| `github` | customer_oauth | customer/provider OAuth | OAuth consent required | token per user/provider | lane-6.7 verified BYOK list | design GitHub App flow |
| `heygen` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | lane-6.7 verified BYOK list | verify API-interface limits |
| `higgsfield` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | lane-6.7 verified BYOK list | refresh terms |
| `hubspot` | customer_oauth | customer/provider OAuth | OAuth consent required | token per user/provider | lane-6.7 verified BYOK list | design HubSpot app flow |
| `image` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | lane-6.7 verified BYOK list | verify Fal terms |
| `linear` | customer_oauth | customer/provider OAuth | OAuth consent required | token per user/provider | lane-6.7 verified BYOK list | design Linear OAuth flow |
| `linkedin` | customer_oauth | customer/provider OAuth | OAuth consent required | token per user/provider | lane-6.7 verified BYOK list | decide if launchable |
| `mux` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | lane-6.7 verified BYOK list | verify anti-resale terms |
| `notion` | customer_oauth | customer/provider OAuth | OAuth consent required | token per user/provider | lane-6.7 verified BYOK list | design Notion OAuth flow |
| `openai` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | lane-6.7 verified BYOK list | refresh OpenAI sharing terms |
| `outscraper` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | lane-6.7 verified BYOK list | source current ToS |
| `pdf` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | lane-6.7 verified BYOK list | verify Html2PDF terms |
| `pexels` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | lane-6.7 verified BYOK list | verify media redistribution |
| `playwright` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | lane-6.7 verified BYOK list | clarify Thum.io dependency |
| `postiz` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | lane-6.7 verified BYOK list | verify white-label limits |
| `removebg` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | lane-6.7 verified BYOK list | verify competing-product clause |
| `replicate` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | lane-6.7 verified BYOK list | verify service-bureau limits |
| `resend` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | lane-6.7 verified BYOK list | verify sender-domain mechanics |
| `screenshot` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | lane-6.7 verified BYOK list | verify ScreenshotOne terms |
| `search` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | lane-6.7 verified BYOK list | verify Brave Search resale path |
| `sendgrid` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | lane-6.7 verified BYOK list | verify Twilio/SendGrid terms |
| `sentry` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | lane-6.7 verified BYOK list | verify org/project isolation |
| `sheets` | customer_oauth | customer/provider OAuth | OAuth consent required | token per user/provider | lane-6.7 verified BYOK list | design OAuth connection API |
| `shippo` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | lane-6.7 verified BYOK list | pursue partner program |
| `shotstack` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | lane-6.7 verified BYOK list | verify anti-pooling terms |
| `slack` | customer_oauth | customer/provider OAuth | OAuth consent required | token per user/provider | lane-6.7 verified BYOK list | design Slack app flow |
| `stripe` | customer_oauth | customer/provider OAuth | OAuth consent required | token per user/provider | lane-6.7 verified BYOK list | design Stripe Connect flow |
| `supabase` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | lane-6.7 verified BYOK list | verify management-token scope |
| `tavily` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | lane-6.7 verified BYOK list | confirm paid resale option |
| `textbelt` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | lane-6.7 verified BYOK list | verify 10DLC obligations |
| `toolroute` | native | ToolRoute internal | none | caller context only | source grep and internal adapter | verify usage logging |
| `translate` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | lane-6.7 verified BYOK list | verify DeepL terms |
| `twilio` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | lane-6.7 verified BYOK list | verify end-user carveout |
| `twitter` | customer_oauth | customer/provider OAuth | OAuth consent required | token per user/provider | lane-6.7 verified BYOK list | decide if launchable |
| `unsplash` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | lane-6.7 verified BYOK list | verify developer app boundary |
| `vapi` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | lane-6.7 verified BYOK list | verify commercial-exploit terms |
| `whisper` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | lane-6.7 verified BYOK list | inherits OpenAI review |
| `youtube` | customer_oauth | customer/provider OAuth | OAuth consent required | token per user/provider | lane-6.7 verified BYOK list | design Google OAuth flow |
