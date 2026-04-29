# ToolRoute — Codex Build Queue

> **You are the Codex build agent. Justin and Claude are using the APEX builder/auditor pattern: you build, Claude audits each PR, Justin merges.**
> Created: 2026-04-27. Source-of-truth audit memo and build plan are in this file. Work top-to-bottom unless dependencies say otherwise.

## Pre-flight (read before Lane 1.1)

**A. First PR is housekeeping, not Lane 1.1.** Commit `.agent/codex-build-queue.md` and investigate `src/content/` (untracked). For `src/content/`: `git status --short src/content/` then `head` a sample file. If it's clearly part of the existing app (blog/marketing copy), commit it. If it's unfamiliar, leave it and note in PR description — Justin or Claude will explain. PR title: `[lane-0.0] track build queue + investigate src/content`.

**B. Production is currently live and demo-ready.** A working demo runbook lives at `.agent/demo-runbook.md` and there's a real demo API key with $4.99 balance (`tr_live_e8e4f6c7...`). Do NOT break:
- `POST /mcp` (public MCP Streamable HTTP)
- `POST /api/v1/execute`
- `GET /api/v1/tools`
- `GET /api/v1/key`
After every PR build, smoke-test these four endpoints and confirm in PR description.

**C. Critical schema gotchas (will silently 400 if you forget):**
- `api_keys.key_prefix` (NOT `prefix`).
- `api_keys` has NO `plan_slug` column — `plan_slug` lives on `gateway_users`.
- The user table is `gateway_users`, NOT `users` or `profiles`. Both don't exist.
- `gateway_usage_log.cost_to_user` is the column for billing (NOT `cost`, NOT `amount`).
- `usage_events` is a separate registry-side table — don't write to it from gateway code.
- Always verify columns via `mcp__supabase` introspection before any insert/select.

**D. Rate limiting is currently broken in production** (Claude is fixing in Lane 2). Until that lands, your Lane 1 signup must enforce these guardrails so attackers can't farm free credits the moment signup goes live:
- New `gateway_users` rows: `credits = 0` and `plan_slug = 'free'`. **No free credit grant.** The demo key's $4.99 balance is a legacy carve-out, not policy.
- Lane 1.2 mints `tr_test_*` keys only on signup (NOT `tr_live_`). `tr_live_` is reserved for keys that have completed at least one paid Stripe checkout.
- Add an email-domain disposable-blocklist check (use a small static list, e.g. mailinator.com / guerrillamail.com / 10minutemail.com — full list at https://github.com/disposable-email-domains/disposable-email-domains, copy a snapshot into `src/lib/disposable-domains.ts`).

**E. Stripe account is shared with peptideai, vibearmor, jarvissdk, myjarvisbrain.** When you create products/prices for Lane 3.1, prefix names with `ToolRoute — ` (e.g. `ToolRoute — Credits $5`). Do NOT modify or delete any product whose name doesn't start with `ToolRoute — `.

**F. Coordination cadence with Claude (auditor):**
- Open one PR at a time per lane. Don't stack 6 unaudited PRs.
- After PR open, append a one-liner to BLOCKERS as `[REVIEW-WAIT] lane-N.M @ <iso> | <PR url>` so Claude sees it.
- If audit kicks back, fix in same branch (no new PR).
- If audit is silent > 4 hours, post `[AUDIT-IDLE]` blocker and move to the next un-blocked task.

**G. Where to find things you'll need:**
- Supabase project ref: `isbratmfnnzipzyoefbo`. Service role key is on Vercel as `SUPABASE_SERVICE_ROLE_KEY` and locally in `.env.local`. Use `mcp__supabase` for SQL/introspection — don't `psql` directly.
- Vercel team: `justins-projects-e2daa9e4`. Use `vercel env ls` and `vercel env add KEY production` (NOT a `.env` checked in).
- Resend API key: already on Vercel as `RESEND_API_KEY`. For local dev, copy from `~/CallTwin/calltwin/.env.local` (cross-project shared, per global memory rule #17). Cloudflare blocks default python UA — if you use python anywhere, send a browser User-Agent header (global memory rule #18).
- Stripe webhook signing secret: on Vercel as `STRIPE_WEBHOOK_SECRET`. To re-trigger a webhook locally: `stripe listen --forward-to localhost:3014/api/webhooks/stripe`.

**H. Hard "no" list (different from the per-rule list — these are repo-level taboos):**
- No `npm run dev` ever. Verify with `npm run build` only (global memory rule #8).
- No skipping Husky/pre-commit hooks (no `--no-verify`).
- No installing new package managers (no pnpm/yarn switch — repo is npm).
- No new top-level Next.js layout — keep current App Router structure.
- No telemetry/analytics/3rd-party scripts (PostHog/Segment/etc.) without Justin's OK.

**I. When you finish each lane, update `.agent/scope.md`** to reflect what's now in scope vs out (e.g. after Lane 1: "signup is in scope, KYC/SSO is not").

## Ground rules (read first, never violate)

1. **Never edit `src/lib/gateway.ts` `validateRequest()` lines 27-96 without explicit approval.** That is the API-key authentication path; a bug there opens free credit grants.
2. **Never edit `scripts/lockdown-anon-writers.sql`** — it's the security baseline.
3. **Never disable RLS on any table.** Add policies, don't remove them.
4. **Never log API keys or `key_hash` to console, Sentry, or `gateway_usage_log.error_message`.** Redact `tr_live_*` / `tr_test_*` to first-8-chars + `...`.
5. **Never commit secrets.** `.env.local` and `~/.claude/secrets/` only. `vercel env add` for production.
6. **Never push to `main`.** Open a PR per task. Title format: `[lane-N.M] short title`.
7. **Run `npm run build` before opening any PR.** Do NOT run `npm run dev` (kills the machine — see global rule #8).
8. **Tests are mandatory.** No "tests will be added later." Per audit-pattern rule #2, Claude greps for actual test files. If you say "tested", a test file must exist.
9. **Report format on every PR description:**
   ```
   Task: [lane-N.M]
   Files changed: <list>
   Tests added: <paths to test files>
   Manual verification: <exact curl/CLI commands you ran + responses>
   Build status: npm run build → <pass/fail>
   Known limitations: <anything degraded>
   ```
10. **If blocked, post to the queue's BLOCKERS section at the bottom of this file with timestamp + what you tried + what you need.** Do NOT spin for >20 min.
11. **Schema authority:** read live schema via the `mcp__supabase` tool (project ref `isbratmfnnzipzyoefbo`) before writing any SQL or Postgres-client query. Do NOT trust column names from documentation.
12. **Existing tables you will work with** (verified 2026-04-27):
    - `gateway_users` — user table (NOT `users`/`profiles`). Has `id`, `email`, `stripe_customer_id`, `credits`, `plan_slug`, `auto_topup_enabled`, `auto_topup_amount`, `auto_topup_threshold`.
    - `api_keys` — has `key_prefix` (NOT `prefix`), `key_hash`, `name`, `is_active`, `request_count`, `user_id`, `created_at`, `expires_at`. NO `plan_slug` column here.
    - `gateway_usage_log` — usage ledger. Has `user_id`, `api_key_id`, `tool_slug`, `provider_used`, `response_status`, `cost_to_us`, `cost_to_user`, `latency_ms`, `used_byok`, `error_message`, `key_source`.
    - `credit_transactions` — Stripe idempotency via `stripe_payment_id`.
    - `usage_events` — RLS currently lets anon SELECT (Lane 4 fixes this).
13. **Do NOT modify** `tools` / `tool_categories` / `category_beliefs` / `composites` schemas — those are the registry brain and Claude owns them.

---

## Lane 0 — Justin-blocked (skip; track only)

Codex does NOT do these. Listed for visibility:

- 0.1 ~~Justin runs `scripts/lockdown-anon-writers.sql`~~ **DONE 2026-04-28 by Claude via Supabase Mgmt API.** Ran v1 (`lockdown-anon-read-leaks.sql`) + v2 (`lockdown-anon-read-leaks-v2.sql`). All 8 sensitive tables locked: usage_events / inventory / tool_requests / api_keys / user_provider_keys → blanket REVOKE. gateway_users / gateway_usage_log / credit_transactions → owner-scoped RLS (auth.uid() filter). Anon-read probe confirmed: 401 on usage_events / api_keys / inventory.
- 0.1b **NEW DONE 2026-04-28 by Claude:** Added `gateway_users.role text NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin'))` + index. Unblocks Codex Lane 8.1 (admin/health dashboard auth gate).
- 0.2 Justin funds Tavily / Firecrawl / ElevenLabs / Deepgram / Replicate / Anthropic.
- 0.3 Justin picks pricing model: master-pool / BYOK / hybrid (default: hybrid).
- 0.4 Justin reviews legal pages from Lane 7.

---

## Lane 1 — Signup + Auth (CRITICAL — start here)

**Why first:** zero revenue path exists. `/login` has no signup link, no `/signup` route. Pricing CTAs all 404.

### 1.1 — Build `/signup` page
- **File:** `src/app/signup/page.tsx`
- **Spec:**
  - Email + password fields, ToS checkbox (link to `/terms` placeholder OK for now).
  - Mirror `/login` styling (Tailwind v4 tokens already in repo).
  - On submit → POST `/api/v1/signup`, redirect to `/dashboard?welcome=1` on success.
  - Inline errors (email taken, weak password).
- **Acceptance:** Playwright test `tests/e2e/signup.spec.ts` covering happy path + email-taken error.
- **Estimate:** 2 hr.

### 1.2 — Signup API route
- **File:** `src/app/api/v1/signup/route.ts`
- **Spec:**
  - Validate body: `{ email, password, accepted_tos: true }`.
  - Call `supabaseAdmin().auth.admin.createUser({ email, password, email_confirm: false })`.
  - Insert row in `gateway_users` with `id=auth.user.id`, `email`, `credits=0`, `plan_slug='free'`.
  - Mint a `tr_test_*` API key in `api_keys` (sha256 hash, `key_prefix` = first 12 chars of token).
  - Send Resend welcome email with verify link (Resend key in Vercel env).
  - Return `{ user_id, api_key, key_prefix }` (full key returned ONCE; never logged).
- **Acceptance:** Vitest unit test asserting `gateway_users` row created and `api_keys` row inserted; Playwright E2E.
- **Estimate:** 2 hr.

### 1.3 — Auth callback / verify route
- **File:** `src/app/auth/callback/route.ts`
- **Spec:**
  - Handle Supabase magic-link / email-verify exchange.
  - Mark `gateway_users.email_verified=true`.
  - Redirect to `/dashboard`.
- **Estimate:** 1 hr.

### 1.4 — Wire signup links
- **Files:** `src/app/login/page.tsx` (add "Create account" link), `src/app/pricing/page.tsx` (lines 32, 49, 69, 350 — change `ctaHref` from `/login` to `/signup?plan=<slug>`).
- **Acceptance:** Manual visit each pricing card → click → land on `/signup?plan=...`.
- **Estimate:** 0.5 hr.

### 1.5 — Dashboard page
- **File:** `src/app/dashboard/page.tsx`
- **Spec:**
  - Server component, requires session.
  - Show: credit balance (`gateway_users.credits`), 7-day usage chart from `gateway_usage_log`, "Buy credits" button → `/api/v1/checkout`, key list with usage counts.
  - Use Recharts (already in deps if present, else add).
- **Estimate:** 4 hr.

### 1.6 — Key management
- **File:** `src/app/dashboard/keys/page.tsx`
- **Spec:**
  - List keys (mask: show only `key_prefix`, never the full token).
  - Create key (name input, returns full token in a one-time toast).
  - Revoke (sets `is_active=false`).
- **Acceptance:** E2E test creating + revoking a key.
- **Estimate:** 2 hr.

---

## Lane 2 — Rate limiting (CLAUDE OWNS — do not touch)

Claude is fixing the `check_rate_limit` RPC. Do not modify `src/lib/gateway.ts` rate-limit code paths.

---

## Lane 3 — Stripe end-to-end

**Why:** webhook handler exists at `src/app/api/webhooks/stripe/route.ts` but has never fired in production.

### 3.1 — Verify Stripe price IDs
- **Spec:** In Stripe dashboard, ensure these env vars exist on Vercel production: `STRIPE_PRICE_CREDITS_5`, `_10`, `_25`, `_50`, `_100`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_ENTERPRISE`. Create any missing prices in Stripe (one-time for credits, recurring monthly for plans).
- **Output:** Comment in PR with the Stripe price IDs you used.
- **Estimate:** 0.5 hr (no code).

### 3.2 — End-to-end Stripe test
- **Spec:** Manually run signup → buy $5 credits via `/api/v1/checkout` → confirm webhook fires → confirm `gateway_users.credits=5.00` → make an OpenAI chat call → confirm balance decrements.
- **Output:** PR description includes the webhook payload (redact secrets), the `gateway_users` row before/after, the `credit_transactions` row.
- **Estimate:** 1 hr.

### 3.3 — Auto-top-up settings UI
- **File:** `src/app/dashboard/billing/page.tsx`
- **Spec:**
  - Toggle for auto-top-up.
  - Inputs for `auto_topup_threshold` and `auto_topup_amount`.
  - Save → PATCH `/api/v1/settings` (already exists per CLAUDE.md endpoint table).
  - Saved-card display via Stripe SetupIntent.
- **Estimate:** 2 hr.

### 3.4 — Invoice history
- **File:** same `dashboard/billing/page.tsx`
- **Spec:** Read from `credit_transactions` joined to Stripe invoice IDs; show date, amount, status.
- **Estimate:** 1 hr.

### 3.5 — Failed-payment dunning
- **File:** `src/app/api/webhooks/stripe/route.ts` (extend existing)
- **Spec:** Handle `invoice.payment_failed` and `payment_intent.payment_failed`. Send Resend email with retry link. Log to `credit_transactions` with status=`failed`.
- **Estimate:** 1.5 hr.

---

## Lane 4 — Security hardening (CLAUDE OWNS — do not touch)

Claude is auditing RLS policies, financial-flow correctness, silent-error classes, and drift guards. Do not modify SQL migrations or `src/lib/gateway.ts`.

### 4.4 — RLS regression guard (DONE 2026-04-27)
- **File:** `scripts/verify-rls-lockdown.mjs`
- **What:** Probes Supabase REST with anon key. Asserts (a) sensitive tables refuse SELECT (or are empty), (b) public catalog tables still serve rows.
- **How to run:** `node scripts/verify-rls-lockdown.mjs` — exits 1 on any leak.
- **Result of first run:** 2 confirmed leaks (`usage_events`, `inventory`); 5 permissive-but-empty (`tool_requests`, `gateway_usage_log`, `api_keys`, `user_provider_keys`, `gateway_users`).
- **Follow-up Lane 4.5 needed:** Existing lockdown SQL only covers 3 of the 8 sensitive tables. Need to extend `scripts/lockdown-anon-read-leaks.sql` (or new file) to also lock `api_keys`, `user_provider_keys`, `gateway_usage_log`, `gateway_users`. A single row in any of those leaks key hashes / billing data / PII to the public internet.

### Lane 4 progress since 4.4 (PRs #71–#92, awaiting Codex review)

**Status as of 2026-04-28:** 22 Claude-owned PRs open against master. Lane 0.1 anon probe still returns HTTP 200 — Justin has not yet run the lockdown SQL, so `usage_events` continues to leak.

#### Drift / type-safety guards
- **#71 [4.50]** UsageEvent TS type drift: `tool_slug` → `tool_id`
- **#72 [4.51]** estimateCost drift guard against return-0 bypass
- **#73 [4.52]** credit deduction TOCTOU audit + Codex inspection ticket
- **#74 [4.53]** actual_cost adapter dead-path audit + drift guard
- **#75 [4.54]** honor `provider.max_price` + audit unimplemented billing-control claim
- **#76 [4.55]** fix stale cogs-leak-audit assertion post Lane 4.11 refactor
- **#79 [4.56]** body-size guard coverage drift guard + Lane 4.38 missing-merge audit
- **PR #70 (merged)** [4.49] drift guard banning `.select("*")` on COGS/PII/credential tables

#### Body-size guards (full surface coverage, per Hard Rule #59)
- **#80 [4.57]** byok + keys + signup (auth boundary trio)
- **#81 [4.58]** checkout + settings (billing surface)
- **#82 [4.59]** registry trio (admin)
- **#83 [4.60]** admin/providers (16KB)
- **#84 [4.61]** api/check (4KB)
- **#85 [4.62]** webhooks/stripe (64KB) — last drift offender

#### Silent-error sweep (supabase-js `.rpc/.insert/.update` returning `{data, error}`)
- **#89 [4.65]** Stripe webhook: 4 `add_credits` call sites now capture errors + return 500. Prevents silent revenue loss when Stripe charged but credits not granted.
- **#90 [4.66]** auth/callback: gateway_users insert/update errors. **Discovered third signup path** — Lane 4.64 audit had only modeled two.
- **#91 [4.67]** getUserFromSession: gateway_users select+insert error capture (lazy auto-provision path)
- **#92 [4.68]** api/v1/byok DELETE: capture errors + verify affected rows (returns 404 if not found, 500 on DB error)

#### Audits (findings flagged, fixes pending Justin decision)
- **#86 [4.63]** Stripe refund/dispute clawback gap (HIGH financial leak) — needs Justin: Codex ticket vs Claude impl
- **#87 [4.64]** starter-credit policy drift across OAuth-vs-password paths — needs Justin: Option A ($0 everywhere) vs Option B ($1 everywhere). Note: post-#90 the audit needs updating to reflect 3 signup paths, not 2.

### 4.5 — Lockdown SQL extension (BLOCKED on Justin)
- **File:** `scripts/lockdown-anon-read-leaks-v2.sql` (delivered prior)
- **Status:** Justin must execute in Supabase SQL editor with service-role JWT. Probe re-run every loop tick; HTTP 200 → still leaks.

---

## Lane 5 — Adapter coverage

**Why:** 35 of 38 adapters are dead in production because their env vars don't exist on Vercel. Goal: only show adapters that work.

### 5.1 — Adapter env-var matrix
- **File:** `.agent/adapter-env-matrix.md` (new)
- **Spec:** For every file in `src/lib/adapters/*-adapter.ts`, extract every `process.env.X` reference. Output a table: adapter slug | required env vars | optional env vars.
- **Estimate:** 0.5 hr.

### 5.2 — Add funded provider keys to Vercel
- **Depends on:** Lane 0.2 (Justin funded providers).
- **Spec:** After Justin reports back keys for Tavily / Firecrawl / ElevenLabs / Deepgram / Replicate, run `vercel env add` for each (production env). Redeploy.
- **Estimate:** 0.5 hr.

### 5.3 — Adapter smoke test
- **File:** `scripts/smoke-test-adapters.mjs` (new)
- **Spec:**
  - For every adapter with required env vars now set, call `/api/v1/execute` with a minimal valid input.
  - Record pass/fail in `gateway_usage_log` and dump a markdown report to `.agent/adapter-smoke-report.md`.
- **Estimate:** 2 hr.

### 5.4 — Hide dead adapters from `/tools`
- **File:** `src/app/api/v1/tools/route.ts` (or wherever the catalog query is)
- **Spec:** Filter out tools whose adapter has missing required env vars in production. Add a `status: 'available' | 'coming_soon'` field. Don't return broken tools as available.
- **Acceptance:** `curl https://toolroute.ai/api/v1/tools | jq '[.tools[] | select(.status=="available")] | length'` returns the actual working count.
- **Estimate:** 1 hr.

### 5.5 — Cost-table audit
- **File:** `.agent/cost-table-audit.md` (new)
- **Spec:** For every adapter, compare `estimateCost` in code vs the provider's published price (visit the provider pricing page). Flag any divergence > 10%. Do NOT change costs without Justin's approval — just report.
- **Estimate:** 2 hr.

---

## Lane 6 — Resale rights audit (CLAUDE OWNS — do not touch)

Claude is reading provider ToS for resale clauses, gating the gateway accordingly, and auditing public copy for false claims about provider coverage.

### Lane 6 progress (PRs #77/#78/#88, awaiting Codex review)

#### Per-provider gating (Lane 6.5–6.7)
- **6.5/6.6** Tier-A/B/C provider classification: rentable, BYOK-required, prohibited
- **6.7** BYOK-required provider list enforced in execute path; tier-copy on `/dashboard/providers`. Initial implementation had a stale URL — fixed in PR #78.

#### Operational guardrails
- **#77 [6.8.1]** Extract Lane 6.7 BYOK slug Sets to shared TS data module (single source of truth)
- **#88 [6.8.2]** Quarterly ToS recheck checklist (doc-only) — schedules systematic re-reads to catch ToS changes that flip a provider from rentable → BYOK
- **#78 [6.10]** `/dashboard/providers` tier-copy drift guard (failing-snapshot test pattern, Hard Rule #59) + Lane 6.7 URL fix

#### Pending Justin decision
- **Lane 5.2 / 6.8.3** Funded provider keys (Tavily / Firecrawl / ElevenLabs / Deepgram / Replicate) — Justin needs to provide. Deepgram needs sales-channel access for resale rights.
- **Lane 6.9** Build-vs-delete decision on false billing-control claims surfaced by Lane 4.54 audit
- **Lane 6.10 D13/D14** Pre-launch copy audit findings (per shared feedback memory `feedback_pre_launch_copy_audit_for_tiered_gates.md`)

---

## Lane 7 — Customer-facing legal & support

### 7.1 — Legal pages
- **Files:** `src/app/terms/page.tsx`, `src/app/privacy/page.tsx`, `src/app/aup/page.tsx`, `src/app/refunds/page.tsx`.
- **Spec:** Use a reputable template (e.g., Termly-style, but copy-pastable text only — do NOT embed third-party scripts). Customize for ToolRoute. Add a banner: "Last updated 2026-04-27".
- **Acceptance:** All four routes return 200 with real content, not lorem ipsum. Justin approves the text before merge.
- **Estimate:** 2 hr.

### 7.2 — Status page
- **File:** `src/app/status/page.tsx`
- **Spec:** Server component showing per-adapter 24h uptime % from `gateway_usage_log`. No third-party embed.
- **Estimate:** 1 hr.

### 7.3 — Support inbox
- **Spec:** Create `support@toolroute.ai` Gmail forward (Justin sets DNS). Add `mailto:support@toolroute.ai` link to footer. (No code beyond footer link if Justin handles DNS.)
- **Estimate:** 0.25 hr.

### 7.4 — Abuse report form
- **File:** `src/app/abuse/page.tsx` + `src/app/api/v1/abuse/route.ts`
- **Spec:** Public form (no auth) → POST → Resend email to admin. Rate-limit by IP (10/hr).
- **Estimate:** 1 hr.

---

## Lane 8 — Observability & alerting

### 8.1 — Admin health dashboard
- **File:** `src/app/admin/health/page.tsx` + `src/app/api/admin/health/route.ts`
- **Spec:**
  - Auth: require `gateway_users.role='admin'` (add column if missing — coordinate with Lane 4).
  - Show per-adapter 24h: total calls, success %, p50/p99 latency, total revenue.
- **Estimate:** 1.5 hr.

### 8.2 — Error-rate alerts
- **File:** `src/app/api/cron/check-error-rates/route.ts` + `vercel.json` cron entry
- **Spec:** Every 15 min, query `gateway_usage_log` for last hour. If any adapter's error % > 20%, send Resend email to admin. De-dupe via in-memory or Redis.
- **Estimate:** 1 hr.

### 8.3 — Daily revenue digest
- **File:** `src/app/api/cron/daily-digest/route.ts` + cron entry
- **Spec:** Daily 9am PT email: yesterday's revenue, top 5 customers, top 5 tools, error count.
- **Estimate:** 1 hr.

### 8.4 — Spend anomaly alert
- **File:** `src/app/api/cron/check-spend-anomalies/route.ts` + cron entry
- **Spec:** Hourly. Per user, if last-24h spend > $50 AND > 5x their 7-day avg, email admin.
- **Estimate:** 1 hr.

---

## Lane 9 — Public proof / launch surface

### 9.1 — `/agents` page
- **File:** `src/app/agents/page.tsx`
- **Spec:** Big "How AI agents use ToolRoute" page. Three tabs: curl, MCP HTTP config, OpenAI Functions format. Live tool count from `/api/v1/tools`. Copy-paste-friendly code blocks.
- **Estimate:** 1 hr.

### 9.2 — `llms.txt` + `.well-known/ai-plugin.json`
- **Files:** `public/llms.txt`, `public/.well-known/ai-plugin.json`
- **Spec:** Per Hard Rule #8 (universal pattern #1). `llms.txt` lists the API surface in markdown. `ai-plugin.json` is the OpenAI plugin manifest pointing to `/api/v1/openapi.json` (create that route too if not present).
- **Estimate:** 0.5 hr.

### 9.3 — Public ledger demo
- **File:** `src/app/ledger/page.tsx`
- **Spec:** Anon-safe rollups only (NO user IDs, NO IPs). Show: total calls last 7 days, success rate by tool, p50 latency by tool. Refresh every 60s.
- **Acceptance:** No row in the page response correlates to any individual user. Claude will audit this for privacy leaks.
- **Estimate:** 2 hr.

---

## Lane 4.52-inspect — credit deduction TOCTOU audit (READ-ONLY)

**Ticket:** dump `deduct_credits` and `add_credits` SQL function bodies via `mcp__supabase` so Claude's Lane 4.52 audit (`.agent/lane-4.52-credit-deduction-toctou-audit.md`) can resolve to atomic / non-atomic / row-locked.

**Steps:**
1. `mcp__supabase__execute_sql` (project ref `isbratmfnnzipzyoefbo`):
   ```sql
   SELECT p.proname, pg_get_functiondef(p.oid) AS def
     FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname IN ('deduct_credits', 'add_credits')
    ORDER BY p.proname;
   ```
2. Paste both bodies verbatim into the PR description.
3. Append a `## Live RPC body (Codex inspection YYYY-MM-DD)` section to `.agent/lane-4.52-credit-deduction-toctou-audit.md` with the bodies + outcome label `(a)` atomic / `(b)` non-atomic / `(c)` row-locked.
4. **Do NOT modify either function.** This is read-only inspection.
5. PR title: `[lane-4.52-inspect] dump deduct_credits / add_credits bodies for TOCTOU audit`.

**Estimate:** 0.25 hr.

**Why this matters:** if outcome (b), there's a real concurrent-call double-spend. If (a) or (c), the audit closes with a spec-locking vitest only.

---

## Working order (suggested)

1. Lane 1 (1.1 → 1.2 → 1.4 → 1.3 → 1.5 → 1.6) — gates everything.
2. Lane 3 (3.1 → 3.2 in parallel with Lane 1.5 → 3.3 → 3.4 → 3.5).
3. Lane 5 (5.1 first — that's a doc, no blockers; rest waits on Justin's keys).
4. Lane 7, 8, 9 in any order — independent.

## How to claim and submit work

1. Pick the next un-claimed task above.
2. Append to BLOCKERS section: `[CLAIMED] lane-N.M @ <ISO timestamp>` (so Claude sees in-flight work).
3. Branch: `git checkout -b lane-N.M-short-name`.
4. Build. Tests. `npm run build` passes.
5. Push branch, open PR with the report format from rule #9.
6. Move the task in this file under "## Submitted for audit" with the PR URL.
7. Claude reviews. Either merges or comments. If kicked back, fix and re-push to the same PR.
8. After merge, move the task to "## Done".

---

## Submitted for audit
(Codex moves rows here when PR is opened)

- [lane-0.0] track build queue + investigate src/content -> https://github.com/Instabidsai/toolroute/pull/1
- [lane-1.1] build /signup page -> https://github.com/Instabidsai/toolroute/pull/2

### Claude-owned (Lane 4 + Lane 6) — awaiting Codex review as of 2026-04-28
- [lane-4.50] UsageEvent TS type drift -> #71
- [lane-4.51] estimateCost return-0 drift guard -> #72
- [lane-4.52] credit deduction TOCTOU audit -> #73
- [lane-4.53] actual_cost adapter dead-path audit -> #74
- [lane-4.54] honor provider.max_price + audit billing-control claim -> #75
- [lane-4.55] cogs-leak-audit assertion fix post Lane 4.11 refactor -> #76
- [lane-6.8.1] BYOK slug Sets shared module -> #77
- [lane-6.10] tier-copy drift guard + Lane 6.7 URL fix -> #78
- [lane-4.56] body-size guard coverage drift guard -> #79
- [lane-4.57] body-size guards on byok+keys+signup -> #80
- [lane-4.58] body-size guards on checkout+settings -> #81
- [lane-4.59] body-size guards on registry trio -> #82
- [lane-4.60] body-size guard on admin/providers -> #83
- [lane-4.61] body-size guard on api/check -> #84
- [lane-4.62] body-size guard on webhooks/stripe -> #85
- [lane-4.63] Stripe refund/dispute clawback gap audit -> #86 (NEEDS JUSTIN)
- [lane-4.64] starter-credit policy drift audit -> #87 (NEEDS JUSTIN — note: 3 signup paths, not 2)
- [lane-6.8.2] quarterly ToS recheck checklist -> #88
- [lane-4.65] Stripe webhook add_credits silent-error fix -> #89
- [lane-4.66] auth/callback gateway_users error capture -> #90
- [lane-4.67] getUserFromSession error capture -> #91
- [lane-4.68] api/v1/byok DELETE error capture + 404 -> #92

## Done
(Claude moves rows here after merge)

---

## BLOCKERS

(Append blockers here. Format: `[lane-N.M] @ <ISO timestamp> | what you tried | what you need`.)

[CLAIMED] lane-0.0 @ 2026-04-27T15:05:20.6736801-04:00

[REVIEW-WAIT] lane-0.0 @ 2026-04-27T15:08:58.4888156-04:00 | https://github.com/Instabidsai/toolroute/pull/1

[CLAIMED] lane-1.1 @ 2026-04-27T15:44:12.8038520-04:00

[REVIEW-WAIT] lane-1.1 @ 2026-04-27T16:01:10.3636594-04:00 | https://github.com/Instabidsai/toolroute/pull/2

[CLAIMED] lane-1.2 @ 2026-04-27T16:01:26.9891593-04:00

[REVIEW-WAIT] lane-1.2 @ 2026-04-27T16:14:03.8700279-04:00 | https://github.com/Instabidsai/toolroute/pull/3

[CLAIMED] lane-1.4 @ 2026-04-27T16:06:29.5117348-04:00

[REVIEW-WAIT] lane-1.4 @ 2026-04-27T16:19:31.0127157-04:00 | https://github.com/Instabidsai/toolroute/pull/4

[CLAIMED] lane-1.3 @ 2026-04-27T16:08:21.7456024-04:00

[REVIEW-WAIT] lane-1.3 @ 2026-04-27T16:29:01.9746870-04:00 | https://github.com/Instabidsai/toolroute/pull/5

[CLAIMED] lane-1.5 @ 2026-04-27T16:22:25.2072912-04:00

[REVIEW-WAIT] lane-1.5 @ 2026-04-27T16:38:01.5569631-04:00 | https://github.com/Instabidsai/toolroute/pull/6

[CLAIMED] lane-1.6 @ 2026-04-27T16:24:05.9185946-04:00

[REVIEW-WAIT] lane-1.6 @ 2026-04-27T16:49:50.1940788-04:00 | https://github.com/Instabidsai/toolroute/pull/7

[CLAIMED] lane-3.1 @ 2026-04-27T16:32:52.4917030-04:00

[VERIFIED-NO-CODE] lane-3.1 @ 2026-04-27T16:32:52.4917030-04:00 | Vercel production env has STRIPE_PRICE_CREDITS_5/10/25/50/100, STRIPE_PRICE_PRO, STRIPE_PRICE_ENTERPRISE

[BLOCKED] lane-3.2 @ 2026-04-27T16:32:52.4917030-04:00 | live Stripe purchase E2E requires funded card/customer checkout run; skipping to code-backed lane 3.3

[CLAIMED] lane-3.3 @ 2026-04-27T16:32:52.4917030-04:00

[REVIEW-WAIT] lane-3.3 @ 2026-04-27T16:58:42.3969601-04:00 | https://github.com/Instabidsai/toolroute/pull/8

[CLAIMED] lane-3.4 @ 2026-04-27T16:40:53.8251457-04:00

[REVIEW-WAIT] lane-3.4 @ 2026-04-27T17:14:39.1054796-04:00 | https://github.com/Instabidsai/toolroute/pull/10

[CLAIMED] lane-3.5 @ 2026-04-27T16:43:05.7328752-04:00

[REVIEW-WAIT] lane-3.5 @ 2026-04-27T17:19:48.0845522-04:00 | https://github.com/Instabidsai/toolroute/pull/11

[CLAIMED] lane-5.1 @ 2026-04-27T16:51:57.8398109-04:00

[REVIEW-WAIT] lane-5.1 @ 2026-04-27T17:25:53.7667223-04:00 | https://github.com/Instabidsai/toolroute/pull/12

[BLOCKED] lane-5.2 @ 2026-04-27T16:55:08.7402978-04:00 | waiting on Justin-funded provider keys from Lane 0.2 before adding Vercel env vars

[BLOCKED] lane-5.3 @ 2026-04-27T16:55:08.7402978-04:00 | depends on Lane 5.2 provider keys before smoke-testing paid adapters

[CLAIMED] lane-5.4 @ 2026-04-27T16:55:08.7402978-04:00

[REVIEW-WAIT] lane-5.4 @ 2026-04-27T17:38:05.2793166-04:00 | https://github.com/Instabidsai/toolroute/pull/13

[CLAIMED] lane-5.5 @ 2026-04-27T16:59:48.6689429-04:00

[REVIEW-WAIT] lane-5.5 @ 2026-04-27T17:46:13.9823498-04:00 | https://github.com/Instabidsai/toolroute/pull/15

[CLAIMED] lane-7.1 @ 2026-04-27T17:05:48.2546419-04:00

[REVIEW-WAIT] lane-7.1 @ 2026-04-27T18:03:53.9131047-04:00 | https://github.com/Instabidsai/toolroute/pull/16

[BLOCKED-CRITICAL] lane-4.14 SQL @ 2026-04-28T16:41Z | scripts/lockdown-gateway-rpcs.sql NOT YET RUN by Justin. Verified open: anon JWT can call add_credits/deduct_credits/validate_api_key. With any real p_user_id, anon mints/drains credits at will. Hive blocker: 2cff1827-5409-4a40-90d2-708b2f362cd1. STOPPING /loop until resolved.

[RESOLVED] lane-4.14 SQL @ 2026-04-28T16:46Z | Lane 4.92 closed via Supabase Mgmt API (owner-DDL credential available locally — re-classified per memory rule #69). Corrected two signature drifts (deduct_credits arg-type order; log_gateway_request 11→13 args), applied lockdown, dropped dead 12-arg log_gateway_request overload that caused PGRST203 ambiguity. All 5 RPCs (add_credits/deduct_credits/validate_api_key/check_rate_limit/log_gateway_request) now return HTTP 401 permission-denied to anon. Hive blocker 2cff1827 resolved. Memory rule #70 added (merged-PR-with-human-SQL ≠ closed). Loop resumes.

[REVIEW-WAIT] lane-4.93 @ 2026-04-28T17:00Z | scripts/lane-4.93-credit-rpc-input-validation.sql APPLIED to prod via Mgmt API. Defense-in-depth post-4.92: add_credits + deduct_credits now RAISE 22023 on NULL/NaN/<=0 p_amount. Closes mint-attack vector deduct_credits(p_amount=-10) → balance + 10. All 5 caller sites already gate >0 (zero false-positive risk). Drift guard vitest ships (6/6 green). PR pending.

[REVIEW-WAIT] lane-4.94 @ 2026-04-28T17:30Z | scripts/lane-4.94-secdef-rpc-lockdown.sql APPLIED to prod via Mgmt API. P0 IDOR closed: get_user_dashboard(uuid) returned full PII + financial payload (email, credit_balance, api_keys[], usage_7d[], recent_transactions[]) to anon JWT for arbitrary user UUIDs — bypassed Lane 4.1 RLS via SECURITY DEFINER. cleanup_rate_limits() also locked (LOW abuse-class). Both orphaned (zero callers in src/) — surfaced via pg_proc audit, NOT codebase scan (Lane 4.78 enumerated only 5 gateway-internal RPCs). Live re-probe both → HTTP 401. Drift guard extended in tests/unit/gateway-rpc-grants-drift.test.ts (4 new cases asserting REVOKE+GRANT+orphan-invariant; 9/9 total green). Hive blocker 8c645116 resolved. PR #119.

[DOC] lane-4.95 @ 2026-04-28T17:50Z | .agent/lane-4.95-secdef-rpc-clean-state.md — closing-bookend attestation that pg_proc audit shows 12 SECDEF functions total in public schema: 7 locked to service_role (Lane 4.92 + 4.94), 5 intentionally anon-callable registry/discovery (allowlisted in REGISTRY_PUBLIC_RPCS test set). No third class of orphaned anon-callable SECDEF RPC remains. Generalizable rule captured: RPC audit must start at pg_proc (DB-truth) not grep .rpc( (code-truth) — Lane 4.78 missed two RPCs because it scanned src/ only. Discovery query checked in for quarterly replay.

[REVIEW-WAIT] lane-4.96 @ 2026-04-28T17:55Z | scripts/lane-4.96-anon-write-grants-revoke.sql APPLIED to prod via Mgmt API. Defense-in-depth post-Lane-4.16: REVOKE INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER from anon on 6 financial tables (api_keys, credit_transactions, gateway_usage_log, gateway_users, usage_events, user_provider_keys). Lane 4.16 closed only SELECT — RLS was the sole defense for writes; any policy weakening would silently re-open mint/drain surface. Live re-probe of all 6 tables shows new error message "permission denied for table X" (was: "new row violates row-level security policy") — proves REVOKE fires at GRANT layer BEFORE RLS evaluation. All 7 write sites in src/ verified to use supabaseAdmin() (service_role bypasses GRANTs+RLS, zero false-positive risk). Drift guard tests/unit/anon-write-grants-drift.test.ts ships (8/8 green). PR #121.

[REVIEW-WAIT] lane-4.97 @ 2026-04-28T18:15Z | scripts/lane-4.97-authenticated-write-revoke.sql APPLIED to prod via Mgmt API. **P0 SELF-MINT SURFACE CLOSED** — surfaced post-Lane-4.96. authenticated had full WRITE grants AND PUBLIC-role RLS policies (users_own_update USING auth.uid()=id, keys_own_insert WITH CHECK user_id=auth.uid(), byok_own_*) → any logged-in user could PATCH /rest/v1/gateway_users to set their own credit_balance to 999999 OR POST /rest/v1/api_keys with key_prefix:tr_live_ to mint a premium key bypassing Lane 4.3 paid-plan gate. Two-layer fix: REVOKE INSERT/UPDATE/DELETE/TRUNCATE from authenticated on 6 financial tables (GRANT layer) + DROP POLICY IF EXISTS on 7 backdoor PUBLIC policies (RLS layer). Both required because either alone is fragile to future role-grant or policy-recreation drift. Caller-side audit unchanged from Lane 4.96 (all 7 write sites use supabaseAdmin). Verification: 0 rows in role_table_grants for authenticated INSERT/UPDATE/DELETE/TRUNCATE on these tables; 0 rows in pg_policies for the 7 backdoor names. 3 owner-scope SELECT policies remain (intentional — dashboard reads). Drift guard tests/unit/authenticated-write-grants-drift.test.ts ships (16/16 green). PR pending.
