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

## Agent Equipment Priority Stack

ToolRoute's wedge is not model resale. The highest-value providers are gated
agent equipment: things agents need to act in the world, but that are hard to
provision, isolate, scale, or keep compliant one account at a time.

Priority order:

1. Live web retrieval and browser access: `firecrawl`, `search`, `tavily`,
   `exa`, `playwright`, `screenshot`, `pdf`. These unlock research, site
   extraction, competitor monitoring, docs ingestion, and hard dynamic pages.
2. Messaging, identity, and human contact: `resend`, `sendgrid`, `twilio`,
   `textbelt`, `vapi`, `deepgram`, `elevenlabs`. These are high-value because
   sender reputation, phone numbers, 10DLC, opt-out rules, and voice minutes are
   operationally painful.
3. Creative production: `image`, `replicate`, `higgsfield`, `heygen`,
   `shotstack`, `creatomate`, `removebg`, `pexels`, `unsplash`. Agents need
   media outputs, but model/provider rights and per-generation costs vary a lot.
4. Lead and market data: `apollo`, `outscraper`, `dataforseo`, `exa`. This is
   valuable, but riskier: Apollo is currently unavailable, and any contact-data
   path needs privacy, consent, anti-spam, and no-FCRA guardrails.
5. Authenticated work systems: `slack`, `github`, `notion`, `hubspot`,
   `linear`, `drive`, `calendar`, `sheets`, `stripe`. These are essential but
   usually need OAuth or connected-account consent, not a pooled key.
6. Infrastructure and operational APIs: `supabase`, `sentry`, `shippo`, `mux`,
   `translate`, `context7`, `postiz`. These become useful once agents are doing
   real work and need deployment, monitoring, shipping, translation, or posting.

For each priority provider, "good" means: agent-discoverable setup, isolated
credential ownership, clear compliance limits, per-call billing attribution,
concurrency/rate-limit handling, and a live smoke path when a real test key or
OAuth consent is available.

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
| `firecrawl` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | official terms reviewed 2026-05-01 | modernize adapter to Firecrawl v2 |
| `github` | customer_oauth | customer/provider OAuth | OAuth consent required | token per user/provider | lane-6.7 verified BYOK list | design GitHub App flow |
| `heygen` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | lane-6.7 verified BYOK list | verify API-interface limits |
| `higgsfield` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | lane-6.7 verified BYOK list | refresh terms |
| `hubspot` | customer_oauth | customer/provider OAuth | OAuth consent required | token per user/provider | lane-6.7 verified BYOK list | design HubSpot app flow |
| `image` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | lane-6.7 verified BYOK list | verify Fal terms |
| `linear` | customer_oauth | customer/provider OAuth | OAuth consent required | token per user/provider | lane-6.7 verified BYOK list | design Linear OAuth flow |
| `linkedin` | customer_oauth | customer/provider OAuth | OAuth consent required | token per user/provider | lane-6.7 verified BYOK list | decide if launchable |
| `mux` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | lane-6.7 verified BYOK list | verify anti-resale terms |
| `notion` | customer_oauth | customer/provider OAuth | OAuth consent required | token per user/provider | lane-6.7 verified BYOK list | design Notion OAuth flow |
| `novita` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | lane-6.9 ambiguous default (no ToS resale audit yet, same default posture as openai) | full ToS resale audit before considering pooling |
| `openai` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | official terms reviewed 2026-05-01 | modernize chat path to Responses API |
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
| `textbelt` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | official terms reviewed 2026-05-01 | add inbound reply webhook route |
| `toolroute` | native | ToolRoute internal | none | caller context only | source grep and internal adapter | verify usage logging |
| `translate` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | lane-6.7 verified BYOK list | verify DeepL terms |
| `twilio` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | lane-6.7 verified BYOK list | verify end-user carveout |
| `twitter` | customer_oauth | customer/provider OAuth | OAuth consent required | token per user/provider | lane-6.7 verified BYOK list | decide if launchable |
| `unsplash` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | lane-6.7 verified BYOK list | verify developer app boundary |
| `vapi` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | lane-6.7 verified BYOK list | verify commercial-exploit terms |
| `whisper` | customer_byok | customer BYOK | `/api/v1/byok` | key per user/provider | lane-6.7 verified BYOK list | inherits OpenAI review |
| `youtube` | customer_oauth | customer/provider OAuth | OAuth consent required | token per user/provider | lane-6.7 verified BYOK list | design Google OAuth flow |

## Provider Deep Dives

### firecrawl

- Launch verdict: `customer_byok`. Firecrawl is a top-priority agent equipment
  provider for web search, scrape, crawl, extraction, and interact workflows.
  ToolRoute can launch it as BYOK now. ToolRoute-funded pooled access should
  stay contract-gated until Firecrawl explicitly authorizes commercial pooling
  and resale.
- What this provider does: converts web pages and sites into agent-usable
  markdown, HTML, screenshots, links, metadata, and structured JSON; supports
  scrape, crawl, map/search-style discovery, and browser interaction workflows.
  The current ToolRoute adapter exposes `scrape`, `crawl`, and `map`.
- ToolRoute value: one ToolRoute key lets an agent route web extraction through
  a stable API, keep Firecrawl credentials isolated, meter per page/job, redact
  upstream errors, and combine Firecrawl with search, Playwright, PDF, and
  downstream summarization without the agent managing provider accounts in every
  runtime.
- Agent setup path: create or use a ToolRoute management key, fund the ToolRoute
  account, save the agent/customer Firecrawl key through `POST /api/v1/byok`
  with `tool_slug: "firecrawl"`, mint or use an execution key, then call
  `firecrawl/scrape`, `firecrawl/crawl`, or `firecrawl/map`.
- Credential owner: the customer or agent's Firecrawl team owns the upstream
  API key, plan, credits, concurrency limits, and upstream bill. ToolRoute owns
  only the ToolRoute key, routing policy, usage ledger, and platform/routing
  fee.
- Isolation design: every request must resolve the caller's ToolRoute
  `GatewayContext.userId`; BYOK lookup must be scoped to
  `user_provider_keys.user_id + tool_slug = firecrawl`; usage must log
  `user_id`, `api_key_id`, `provider_used`, `key_source`, operation, request id,
  and unit count. A missing Firecrawl BYOK key should fail closed unless a
  contract-approved ToolRoute pool is explicitly enabled.
- Billing model: Firecrawl charges against the customer's Firecrawl plan in
  BYOK mode. ToolRoute charges credits for routing, metering, reliability,
  logs, and any agreed platform markup. For future pooled access, ToolRoute
  needs per-page/job cost controls, concurrency throttles, cache policy, and a
  provider-approved resale or partner agreement.
- Rate/quota model: Firecrawl plan limits include request rate, concurrent
  browser limits, queued-job limits, and credits. ToolRoute should pre-check
  ToolRoute balance/rate limits, pass upstream 429s through as redacted
  machine-readable errors, and eventually expose queue/backoff guidance to
  agents.
- Data handling: URLs, prompts, extraction schemas, page content, screenshots,
  and interaction instructions can contain customer or third-party data.
  ToolRoute must avoid logging secrets or full page payloads by default, respect
  customer retention settings, and keep scraping use cases away from prohibited
  contact-data, background-check, eligibility, law-enforcement, privacy-law, or
  FCRA-covered workflows.
- Failure modes: missing BYOK key, invalid Firecrawl key, exhausted Firecrawl
  credits, upstream 429/concurrency queue timeout, blocked target site, timeout,
  invalid URL/SSRF rejection, payload too large, and unsupported v1/v2 endpoint
  drift. All errors must redact provider and ToolRoute credentials.
- Provider terms evidence: Firecrawl's terms say the service is an API for
  converting websites into LLM-friendly data, require credentials to remain
  confidential, restrict unauthorized commercial use, and prohibit modifying,
  renting, leasing, selling, distributing, or creating derivative works from the
  service without permission. Source:
  https://www.firecrawl.dev/terms-of-service. Firecrawl's current docs show v2
  scrape at `https://api.firecrawl.dev/v2/scrape`, plus crawl, agent, extract,
  account usage, queue status, and interact surfaces. Source:
  https://docs.firecrawl.dev/api-reference/endpoint/scrape. Firecrawl rate
  limits are plan-based and include concurrent browser limits and API requests
  per minute. Source: https://docs.firecrawl.dev/rate-limits.
- Contract/OAuth/partner work needed: no OAuth is needed for BYOK. Pooled access
  needs a Firecrawl commercial agreement, plus explicit rules for caching,
  resale, prohibited scraping categories, and customer responsibility for target
  site rights.
- Production smoke: no live Firecrawl BYOK scrape was run in this pass because
  no customer Firecrawl test key was provided. Production provider requirements
  should continue to expose `customer_byok`, `/api/v1/byok`, and
  `pool_contract_required: true`.
- Remaining blocker: update the adapter from Firecrawl v1 endpoints to current
  v2 endpoints, add `extract`/`interact` only after cost and abuse controls are
  defined, contract-gate the shared `FIRECRAWL_API_KEY` fallback, and run a live
  BYOK smoke against a benign URL once a test key exists.
- Next review date: 2026-06-01, or immediately if Firecrawl terms, v2 endpoint
  behavior, pricing, concurrency, or ToolRoute pooling strategy changes.

### openai

- Launch verdict: `customer_byok`. ToolRoute can launch OpenAI as a customer-key
  provider, but ToolRoute-funded pooled OpenAI execution is contract-blocked
  until OpenAI gives written enterprise, partner, reseller, or marketplace
  approval.
- What this provider does: text/chat generation, image generation, embeddings,
  and moderation. The current adapter exposes `chat`, `image`, `embeddings`,
  and `moderation`.
- ToolRoute value: one ToolRoute key for the agent, normalized tool discovery,
  setup guidance, per-agent credential isolation, credits/rate limits, request
  logging, redacted upstream errors, and a stable MCP/REST surface over OpenAI.
- Agent setup path: create or use a ToolRoute management key, fund the ToolRoute
  account, save the agent/customer OpenAI key through `POST /api/v1/byok` with
  `tool_slug: "openai"`, mint an execution key, then call `openai/chat`,
  `openai/image`, `openai/embeddings`, or `openai/moderation`.
- Credential owner: the customer or agent's own OpenAI organization owns the
  upstream API key and upstream OpenAI bill. ToolRoute owns only the ToolRoute
  key, usage ledger, routing policy, and platform/routing fee.
- Isolation design: every call must resolve `GatewayContext.userId` from the
  caller's ToolRoute key; BYOK lookup must be scoped to
  `user_provider_keys.user_id + tool_slug = openai`; usage must be logged with
  the caller's `user_id`, `api_key_id`, `provider_used`, `key_source`, and
  request id. A missing BYOK key must fail closed instead of falling back to a
  shared pool unless that pool has explicit approval.
- Billing model: OpenAI charges the customer-owned OpenAI account for upstream
  usage in BYOK mode. ToolRoute charges credits for routing, metering, support,
  convenience, and any agreed platform markup. Future ToolRoute-funded pooling
  needs a contract plus per-model cost and margin controls before launch.
- Rate/quota model: upstream model access, spend limits, and rate limits belong
  to the customer's OpenAI key; ToolRoute still enforces ToolRoute API-key rate
  limits and credit checks before dispatch. Upstream 401/403/429/insufficient
  quota errors should return machine-readable, redacted errors to the agent.
- Data handling: prompts, images, embedding inputs, and moderation inputs are
  sent to OpenAI under the customer's key. ToolRoute must not log provider
  secrets and should minimize stored prompt/output content unless a customer
  explicitly asks for retention. OpenAI's platform data controls page says API
  inputs and outputs are not used to train by default, with default abuse
  monitoring retention depending on endpoint and account settings.
- Failure modes: missing BYOK key, invalid OpenAI key, upstream rate limit,
  upstream insufficient quota, unsupported model, insufficient ToolRoute credits,
  adapter timeout, and model/API deprecation. All must avoid leaking the full
  OpenAI key or ToolRoute key in `gateway_usage_log.error_message`.
- Provider terms evidence: OpenAI's Services Agreement effective 2026-01-01
  allows customers to integrate the API into customer applications for end
  users, but also prohibits buying, selling, or transferring API keys with a
  third party. Source: https://openai.com/policies/services-agreement/.
  OpenAI's Responses API migration guide says Responses is the future direction
  for building agents and recommends migration. Source:
  https://platform.openai.com/docs/guides/migrate-to-responses.
- Contract/OAuth/partner work needed: no OAuth is needed for BYOK. A pooled
  ToolRoute master key for all agents requires an OpenAI contract or written
  approval before it is represented in the catalog as ToolRoute-funded access.
- Production smoke: no live OpenAI BYOK execution smoke was run in this pass
  because no customer OpenAI key was provided to this session. Source review
  confirms the adapter can execute only after BYOK setup because catalog/runtime
  offerability classifies OpenAI as `customer_byok`.
- Remaining blocker: modernize the `chat` operation from `/v1/chat/completions`
  to `/v1/responses`, decide whether the `OPENAI_API_KEY` fallback should be
  removed or contract-gated, and add a redacted BYOK smoke once a test OpenAI
  key is available.
- Next review date: 2026-06-01, or immediately if OpenAI terms, model access,
  Responses API requirements, or ToolRoute pooling strategy changes.

### textbelt

- Launch verdict: `customer_byok`. Textbelt is a strong first simple-SMS
  provider because setup is lightweight: a customer buys quota, gets a key, and
  saves it in ToolRoute. It should launch as BYOK, not as a shared ToolRoute SMS
  pool for arbitrary agents.
- What this provider does: sends SMS, checks delivery status, and can receive
  replies for paid U.S. keys through `replyWebhookUrl`. The current ToolRoute
  adapter exposes `send-sms` and `check-status`.
- ToolRoute value: one ToolRoute key lets an agent send simple SMS through an
  isolated customer Textbelt key while ToolRoute enforces consent attestation,
  sender identity, STOP opt-out language, redacted errors, billing attribution,
  and eventually inbound-reply routing.
- Agent setup path: create or use a ToolRoute management key, fund the ToolRoute
  account, save the agent/customer Textbelt key through `POST /api/v1/byok` with
  `tool_slug: "textbelt"`, then call `textbelt/send-sms` with `phone`,
  `message`, `sender`, and `consent_confirmed: true`.
- Credential owner: the customer or agent owns the Textbelt key, quota, and
  recipient consent records. ToolRoute owns the ToolRoute key, routing policy,
  usage ledger, and platform/routing fee.
- Isolation design: every send resolves `GatewayContext.userId`; BYOK lookup is
  scoped to `user_provider_keys.user_id + tool_slug = textbelt`; usage logs must
  include user id, API key id, provider, operation, key source, request id, and
  unit count. No agent may send with another agent's Textbelt quota.
- Billing model: Textbelt charges the customer-owned key quota in BYOK mode.
  ToolRoute charges credits for routing, compliance guardrails, logs, and
  optional reply handling. Pooled SMS requires provider approval plus ToolRoute
  sender reputation, opt-out, abuse, and carrier-compliance controls.
- Rate/quota model: Textbelt quota is per key; sends can fail for exhausted
  quota, invalid keys, prohibited content, URL activation, or filtering. ToolRoute
  should pre-check ToolRoute credits and expose Textbelt quota remaining when
  returned.
- Data handling: phone numbers and SMS content are sensitive. ToolRoute should
  not store full phone/message payloads by default, must redact credentials, and
  should support inbound reply verification before storing or routing replies.
- Failure modes: missing BYOK key, missing `sender`, missing
  `consent_confirmed: true`, invalid phone, Textbelt quota exhausted, prohibited
  content, unactivated URL sending, webhook URL rejection, and downstream
  delivery failure.
- Provider terms evidence: Textbelt documents simple SMS sending without account
  configuration or recurring billing, supports `_test` keys, `sender`,
  `replyWebhookUrl`, and `webhookData`, and says business identity plus STOP
  opt-out language are required where applicable. Source:
  https://docs.textbelt.com/. Textbelt terms require recipients to opt in,
  sender identification, opt-out instructions for recurring SMS, no
  impersonation, no spam/bulk advertising, and no drug/cannabis, gambling,
  phishing, fraud, or other prohibited content. Source:
  https://textbelt.com/tos/.
- Contract/OAuth/partner work needed: no OAuth is needed for BYOK. ToolRoute
  pooled SMS requires a business/compliance decision, Textbelt approval if
  needed, abuse controls, sender-domain/brand rules, opt-out suppression, and
  clear customer responsibility for consent records.
- Production smoke: no live SMS was sent in this pass. The adapter now supports
  `test_mode: true`, which appends `_test` to the Textbelt key so a future smoke
  can validate send shape without spending quota.
- Remaining blocker: build a `replyWebhookUrl` receiver that verifies
  `X-textbelt-signature` and `X-textbelt-timestamp`, persists inbound replies
  owner-scoped to the original user/request, and enforces STOP suppression.
- Next review date: 2026-06-01, or immediately if Textbelt terms, webhook
  signature rules, SMS compliance posture, or ToolRoute pooling strategy changes.
