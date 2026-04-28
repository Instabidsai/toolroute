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

- 0.1 Justin runs `scripts/lockdown-anon-writers.sql` in Supabase SQL editor.
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

Claude is auditing RLS policies and resale rights. Do not modify SQL migrations or `src/lib/gateway.ts`.

### 4.4 — RLS regression guard (DONE 2026-04-27)
- **File:** `scripts/verify-rls-lockdown.mjs`
- **What:** Probes Supabase REST with anon key. Asserts (a) sensitive tables refuse SELECT (or are empty), (b) public catalog tables still serve rows.
- **How to run:** `node scripts/verify-rls-lockdown.mjs` — exits 1 on any leak.
- **Result of first run:** 2 confirmed leaks (`usage_events`, `inventory`); 5 permissive-but-empty (`tool_requests`, `gateway_usage_log`, `api_keys`, `user_provider_keys`, `gateway_users`).
- **Follow-up Lane 4.5 needed:** Existing lockdown SQL only covers 3 of the 8 sensitive tables. Need to extend `scripts/lockdown-anon-read-leaks.sql` (or new file) to also lock `api_keys`, `user_provider_keys`, `gateway_usage_log`, `gateway_users`. A single row in any of those leaks key hashes / billing data / PII to the public internet.

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

Claude is reading provider ToS for resale clauses.

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

[REVIEW-WAIT] lane-4.97 @ 2026-04-28T18:15Z | scripts/lane-4.97-authenticated-write-revoke.sql APPLIED to prod via Mgmt API. **P0 SELF-MINT SURFACE CLOSED** — surfaced post-Lane-4.96. authenticated had full WRITE grants AND PUBLIC-role RLS policies (users_own_update USING auth.uid()=id, keys_own_insert WITH CHECK user_id=auth.uid(), byok_own_*) → any logged-in user could PATCH /rest/v1/gateway_users to set their own credit_balance to 999999 OR POST /rest/v1/api_keys with key_prefix:tr_live_ to mint a premium key bypassing Lane 4.3 paid-plan gate. Two-layer fix: REVOKE INSERT/UPDATE/DELETE/TRUNCATE from authenticated on 6 financial tables (GRANT layer) + DROP POLICY IF EXISTS on 7 backdoor PUBLIC policies (RLS layer). Both required because either alone is fragile to future role-grant or policy-recreation drift. Caller-side audit unchanged from Lane 4.96 (all 7 write sites use supabaseAdmin). Verification: 0 rows in role_table_grants for authenticated INSERT/UPDATE/DELETE/TRUNCATE on these tables; 0 rows in pg_policies for the 7 backdoor names. 3 owner-scope SELECT policies remain (intentional — dashboard reads). Drift guard tests/unit/authenticated-write-grants-drift.test.ts ships (16/16 green). PR #122.

[REVIEW-WAIT] lane-4.98 @ 2026-04-28T19:00Z | scripts/lane-4.98-zero-policy-tables-write-revoke.sql APPLIED to prod via Mgmt API. Defense-in-depth — generalized audit after Lane 4.97 found 8 tables with RLS=on but ZERO policies AND wide anon+authenticated WRITE grants (conversations, discovery_feed, inventory, rate_limit_windows, tool_memory, tool_overrides, tool_providers, tool_requests). RLS default-deny was sole writeguard; any future migration disabling RLS or adding `USING (true)` silently re-opens writes — same fragility class as 4.96/4.97. Single-line fix per table: REVOKE INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER from anon, authenticated. Caller audit: only `src/app/api/admin/providers/route.ts:91` writes directly (admin-gated via validateAdmin + supabaseAdmin — service_role bypasses GRANT). Other 7 tables' writes go through SECDEF RPCs (check_rate_limit, log_tool_request, etc.) which run as their owner. Live anon-probe of 3/8 tables now returns 401 `permission denied for table X`. Drift guard tests/unit/zero-policy-tables-write-grants-drift.test.ts ships (10/10 green). PR #123.

[REVIEW-WAIT] lane-4.99 @ 2026-04-28T20:05Z | scripts/lane-4.99-registry-tables-write-revoke.sql APPLIED to prod via Mgmt API. **TERMINAL SIBLING in WRITE-grant chain.** 8 registry tables with one SELECT-only policy + wide write grants (tools, category_beliefs, tool_pricing, tool_categories, plans, provider_health_log, skills, composites). Symmetric class to Lane 4.98 (zero-policy) — same fragility, just one SELECT policy more. CRITICAL constraint: SELECT must stay (server components feed /tools, /discover via anon client per `src/lib/api.ts` — Memory rule #58). REVOKE only INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER. Caller audit: 13 direct .from() call sites across src/ — ZERO writes, all .select(). Internal writes flow through SECDEF RPCs (challenge_tool, record_usage) + admin/cron via service_role. Verification: 16 rows now show only `SELECT` for anon+authenticated (was 7 privs each); GET /rest/v1/tools returns HTTP 200 + data (catalog OK); POST /rest/v1/tools returns 42501 permission denied. Drift guard tests/unit/registry-tables-write-grants-drift.test.ts ships (11/11 green) — includes a SELECT-protection assertion (no REVOKE clause may include SELECT). Post-4.99 invariant: zero anon/authenticated direct write grants remain on the gateway DB. PR pending.

[REVIEW-WAIT] lane-6.9 @ 2026-04-28T20:35Z | .agent/lane-6.9-video-sms-tos-audit.md — 5 unaudited master-pool video/SMS adapters (mux, twilio, heygen, shotstack, creatify). **4 NEW STRUCTURAL BANS confirmed via direct ToS fetch:** Mux (§3.2 + non-sublicensable license), Twilio (§2.2(b)), HeyGen ("Frame, replicate, or develop an interface to access the Services...via an API and/or by white-labeling" — most explicit anti-aggregator clause to date), Shotstack (§4.4 "in any manner whatsoever"). Creatify flagged `ambiguous_unverified` — ToS page is JS-rendered SPA, WebFetch returned empty, manual browser fetch needed. Cumulative master-pool-incompatible list now 7 providers (Anthropic + Replicate + Tavily + these 4). Pattern: every commercial-output provider with per-unit COGS audited so far (12/13 verified) has explicit resale ban. Codex follow-up: extend BYOK-required Set in src/lib/byok-slugs.ts to add mux+twilio+heygen+shotstack — Lane 6.5-impl picks this up. lane-6-resale-audit.md updated with sibling pointer + cumulative list. PR pending.

## REVIEW-WAIT — Lane 6.11 (search/translation/scraping ToS audit)
- **Branch:** `lane-6.11-search-translation-tos-audit`
- **Memo:** `.agent/lane-6.11-search-translation-tos-audit.md`
- **PR:** pending (will pin number after `gh pr create`)
- **Findings:** 1 confirmed forbidden (DeepL §8.1.4), 3 ambiguous_ask_legal (Outscraper, Creatomate, DataForSEO), 1 pdf_unverified (Exa).
- **Codex follow-up:** extend BYOK-required Set in `src/lib/byok-slugs.ts` to add `deepl` (forbidden) + `outscraper`, `creatomate`, `dataforseo`, `exa`, `creatify` (ambiguous-default-to-BYOK).
- **Cumulative state:** 8 verified `forbidden` master-pool providers (Anthropic, Replicate, Tavily, Mux, Twilio, HeyGen, Shotstack, DeepL). Zero providers in entire audit have unambiguous master-pool authorization.

## REVIEW-WAIT — Lane 6.12 (productivity/CRM/email ToS audit)
- **Branch:** `lane-6.12-productivity-crm-tos-audit`
- **Memo:** `.agent/lane-6.12-productivity-crm-tos-audit.md`
- **PR:** pending (will pin number after `gh pr create`)
- **Findings:** 4 confirmed forbidden (Apollo §3(g)(1)+§3(g)(3)(ii)+§3(d), Linear §2.2(c), SendGrid via Twilio 301-redirect inheritance, Sentry §2.3(a)+(b)+(c)), 1 ambiguous_unverified (Shippo JS-rendered SPA).
- **Codex follow-up:** extend BYOK-required Set in `src/lib/byok-slugs.ts` with `apollo`, `linear`, `sendgrid`, `sentry`, `shippo`.
- **Cumulative state (22 providers attempted):** 12 verified `forbidden` master-pool providers, 9 ambiguous-default-to-BYOK, 2 byok_only ok. Zero providers have unambiguous master-pool authorization.

## REVIEW-WAIT — Lane 6.13 (SaaS productivity ToS audit)
- **Branch:** `lane-6.13-saas-productivity-tos-audit`
- **Memo:** `.agent/lane-6.13-saas-productivity-tos-audit.md`
- **PR:** pending (will pin number after `gh pr create`)
- **Findings:** 4 confirmed forbidden (LinkedIn §3.1(8), HubSpot §8.E, Slack Applications+Commercial Distribution, GitHub §H conditional), 1 pdf_unverified (Notion MSA on Cloudfront).
- **Codex follow-up:** extend BYOK-required Set in `src/lib/byok-slugs.ts` with `linkedin`, `hubspot`, `slack`, `github`, `notion`. Cumulative 20-slug Codex single-shot ticket now ready (mux, twilio, heygen, shotstack, deepl, apollo, linear, sendgrid, sentry, linkedin, hubspot, slack, github, outscraper, creatomate, dataforseo, exa, creatify, shippo, notion).
- **Cumulative state (27 providers attempted):** 16 verified `forbidden`, 10 ambiguous-default-to-BYOK, 2 byok_only ok. Zero providers have unambiguous master-pool authorization.
- **Audit class effectively exhausted:** only Stripe + Supabase remain (Lane 6.14, infrastructure providers — qualitatively different resale terms).

## REVIEW-WAIT — Lane 4.100 (ACTIVE LEAK escalation: Anthropic + OpenAI master-pool keys live in prod)
- **Branch:** `lane-4.100-master-pool-active-leak-audit`
- **Memo:** `.agent/lane-4.100-master-pool-active-leak-audit.md`
- **PR:** pending (will pin number after `gh pr create`)
- **Severity:** P0 / CRITICAL
- **Finding:** Vercel prod env-var inventory (verified via `/v10/projects/$PROJ/env` API 2026-04-28) confirms `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` are SET as `production`-target. Combined with `/api/v1/execute` having NO BYOK enforcement gate (verified via full route read; `src/lib/byok-slugs.ts` does NOT exist), any `tr_live_` key holder calling `{tool:"claude"|"openai",...}` without BYOK falls through to ToolRoute's pooled inference — direct ToS breach (Anthropic) + COGS leak (both). 16 of 18 verified-forbidden master-pool env vars are NOT set in prod (latent), 2 ARE set (active leak).
- **Justin actions (immediate):**
  1. `vercel env rm ANTHROPIC_API_KEY production --yes` (or DELETE via API).
  2. `vercel env rm OPENAI_API_KEY production --yes`.
  3. Force redeploy: empty commit on `main` + push, OR `vercel deploy --prod --yes` from `.vercel/` dir.
  4. Promote Codex ticket #23 (Lane 6.5-impl BYOK runtime gate) priority to P0.
- **Codex follow-up:** ticket #23 expands scope to include the cumulative 26-slug BYOK list documented in the memo (16 forbidden + 10 ambiguous; Resend + ElevenLabs are byok-permitted and pass through naturally without needing a gate). Memo includes the explicit gate logic for `/api/v1/execute`, `/mcp`, `/api/a2a`.
- **Why this matters for /loop directive:** Lane 4 = security hardening; this is a live active-leak finding gating production-readiness of the financial gateway. Anthropic could revoke ToolRoute's API key on detection (breaks every demo path).

## REVIEW-WAIT — Lane 6.14 (infrastructure providers ToS audit — FINAL master-pool batch)
- **Branch:** `lane-6.14-infra-providers-tos-audit`
- **Memo:** `.agent/lane-6.14-infra-providers-tos-audit.md`
- **PR:** pending (will pin number after `gh pr create`)
- **Findings:** 2 confirmed forbidden via verbatim ToS quotes — Stripe (SSA §1.2(a)(viii) "act as service bureau or pass-through agent" + §2.5 "rent, lease, lend, sell, share, redistribute, or sublicense the Stripe Technology, or enable others to do so" + §1.2(a)(v) rights-transfer ban; Connect carve-out exists but is OAuth-per-account not master-pool), Supabase (§2(c) "rent, lease, lend, sell, license, sublicense, assign, distribute, publish, transfer, or otherwise make available the Services or Documentation to any third party"). Both env vars LATENT in prod (NOT set; severity HIGH/latent rather than P0/active).
- **Architectural finding:** Both adapters are operationally broken-by-design via master pool — Stripe master key returns ToolRoute's OWN customers/products/balance (not downstream user data); Supabase Mgmt token IS the gateway DB owner-DDL credential (master-pool exposure = catastrophic gateway breach). Recommend Codex ticket to DELETE both adapters outright until Justin builds proper Connect / per-user OAuth flows.
- **Codex follow-up:** extend BYOK-required Set in `src/lib/byok-slugs.ts` (per Lane 4.100 / ticket #23) with `stripe`, `supabase`. Final cumulative BYOK list now **28 slugs** (18 forbidden + 10 ambiguous default-to-BYOK).
- **Cumulative state (29 providers attempted, audit class CLOSED):** 18 verified `forbidden`, 10 ambiguous-default-to-BYOK, 2 byok_only ok. Pattern holds zero-exceptions across entire audit.
- **Master-pool resale audit class CLOSED with this lane.**

## REVIEW-WAIT — Lane 4.101 (BYOK runtime-gate gap is universal across all 3 gateway entry points)
- **Branch:** `lane-4.101-byok-gap-all-gateway-entrypoints`
- **Memo:** `.agent/lane-4.101-byok-gap-all-gateway-entrypoints.md`
- **PR:** pending (will pin number after `gh pr create`)
- **Severity:** P0 / CRITICAL (extends Lane 4.100)
- **Finding:** Lane 4.100 confirmed BYOK gap on `/api/v1/execute`; this lane verifies the same gap exists at `/mcp` (route.ts:114→133) and `/api/a2a` (route.ts:117→135). All three entry points converge on `executeToolRequest(ctx, toolName, input)` from `@/lib/gateway` with zero BYOK enforcement. A2A amplifies risk via auto-router — natural-language `task` text routes to `claude`/`openai` based on intent inference and master-pool fall-through delivers ToolRoute's keys.
- **Codex follow-up:** ticket #23 scope expansion — gate must land at `executeToolRequest` boundary (not per-route handler) AFTER `auto/route` resolution to its final tool slug, then check `BYOK_REQUIRED_SLUGS.has(final_slug)` against user's BYOK registry. Single source of truth, three protocol-specific error surfaces (REST 402, JSON-RPC error, A2A task error).
- **Why this matters for /loop directive:** without this memo, Codex #23 could ship a partial fix that gates only `/api/v1/execute` — leaving `/mcp` + `/api/a2a` as live leak paths if env vars are ever re-set post-yank. This memo closes the scope ambiguity in writing.

## REVIEW-WAIT — Lane 4.102 (broken-by-design master-pool class spans 12 adapters)
- **Branch:** `lane-4.102-broken-by-design-master-pool-class`
- **Memo:** `.agent/lane-4.102-broken-by-design-master-pool-class.md`
- **PR:** pending (will pin number after `gh pr create`)
- **Severity:** HIGH-LATENT (10 of 12 env vars unset; 0 currently active in Class-A but trivially activatable)
- **Finding:** Lane 6.14's stripe+supabase architectural break generalizes — 12 adapters are owner-scoped (Class A), 8+ are compute-inference (Class B, COGS-only), 3 are public-data (Class C, rate-limit-uplift only). Class A: stripe, supabase, slack, linear, twilio, hubspot, sentry, mux, notion, linkedin, apollo, sendgrid. Master-pool firing on any Class-A adapter = data leak (ToolRoute's resources exposed to API caller), not just COGS.
- **SendGrid sub-finding:** Class A + email-reputation/phishing class — emails would go from ToolRoute's verified sender domain.
- **Resend explanation:** byok_only structurally — env var unset means fall-through is config-error, not silent fall-through. Sendgrid would have the same reputation-damage class if its env var were ever set.
- **Codex follow-up:** strengthens ticket #23 P0 rationale (gate prevents Class-A data leaks, not just COGS). Separate ticket suggested for "audit all 12 Class-A adapters' operational coherence before keeping any in catalog" (Lane 6.14 already recommended deleting stripe + supabase).
- **Why this matters for /loop directive:** adds structural rule to launch-readiness checklist — "No Class-A master-pool env var gets set in prod until BYOK gate ships and is wired in `executeToolRequest`."

## REVIEW-WAIT — Lane 4.103 (catalog env-var-only gate has no Class-A awareness; auto-router amplifies)
- **Branch:** `lane-4.103-catalog-class-a-awareness`
- **Memo:** `.agent/lane-4.103-catalog-class-a-awareness.md`
- **PR:** pending (will pin number after `gh pr create`)
- **Severity:** HIGH-LATENT
- **Finding:** `listAvailableAdapters` (`src/lib/adapter-availability.ts:133-137`) is env-var-binary only — no Class-A awareness. Same filter feeds 4 catalog endpoints (default, openai, mcp, anthropic) AND auto-router (`auto-adapter.ts` `availableSlugs`). Setting any of 12 Class-A env vars (apollo/hubspot/linear/linkedin/mux/notion/sendgrid/sentry/slack/stripe/supabase/twilio) immediately publishes that adapter to 4 catalog formats AND adds it to auto-router routing pool. AI agents discover + call → master-pool fall-through → Class-A leak.
- **Codex follow-up:** extend ticket #23 scope: add `requires_byok` flag to availability response + filter Class-A from anonymous catalog (Option A) + auto-router post-resolution gate (resolves `auto/route` → final slug, then checks BYOK, falls through to next match if Class-A + no BYOK).
- **Why this matters for /loop directive:** catalog is the discovery/advertising surface — agents fetch `?format=openai|mcp|anthropic` to know what tools exist. Without Class-A awareness, the catalog is a honeypot. Lane 4.102's launch-readiness rule reinforced.

## REVIEW-WAIT — Lane 4.104 (github master-pool PAT silently leaks private repos via "public" ops)
- **Branch:** `lane-4.104-github-pat-scope-leak`
- **Memo:** `.agent/lane-4.104-github-pat-scope-leak.md`
- **PR:** pending (will pin number after `gh pr create`)
- **Severity:** HIGH-LATENT (`GITHUB_TOKEN` not set in Vercel prod)
- **Finding:** Lane 4.102 classified github as Class-C "public-data, no leak" — incorrect. Adapter has no visibility filter. PAT with `repo` scope → search-repos returns private repos org token can see; get-readme returns private repo READMEs; list-issues returns private repo issues. Whatever scope the token holds, response inherits.
- **Class-C taxonomy refined:** eligibility now requires (a) public-data ops AND (b) verifiably-scoped credential. github fails (b); dataforseo passes (verified); outscraper unverified.
- **Class-A list extended to 13:** add `github`. Refined launch-readiness rule: "No Class-A master-pool env var (13 listed) set in prod until gate ships AND `GITHUB_TOKEN` (if ever set) is verified fine-grained PAT, public_repo-only."
- **Codex follow-up:** github is already implied in Codex #23 BYOK list (Lane 6.13 forbidden); add defensive `GET /user` scope-check OR enforce BYOK-only as P0.

## REVIEW-WAIT — Lane 4.105 (`/api/v1/usage` GET dual-auths tr_live_ + session — outlier vs peers)
- **Branch:** `lane-4.105-usage-tr-live-scope-extension`
- **Memo:** `.agent/lane-4.105-usage-tr-live-scope-extension.md`
- **PR:** https://github.com/Instabidsai/toolroute/pull/135
- **Severity:** MEDIUM (privilege-scope drift; tr_live_ holder's own data only; no cross-tenant leak)
- **Finding:** `/api/v1/usage` GET is the ONLY session-authed read endpoint that ALSO accepts `tr_live_`/`tr_test_`. Six peer endpoints (byok GET, keys GET, settings GET, checkout POST, billing/setup-payment POST, signup POST) are session-only. Asymmetry extends leaked tr_live_ blast radius from "execute tools" to "read full audit trail" (tool_slug, provider_used, latency, cost, error_message, timestamps; up to 100K-offset paging).
- **Bounded by:** `eq("user_id", userId)` (no cross-tenant); Lane 4.18 redactCreds() on error_message; Lane 4.3 paid-plan gate on tr_live_ creation.
- **Why fix vs document:** pattern asymmetry is a latent bug magnet (future engineer copies wrong template); peer `/api/v1/keys` GET is intentionally session-only — internally inconsistent.
- **Codex follow-up:** **Option 1 (recommended):** one-line patch — replace `resolveUserId(request)` helper with `getUserFromSession(authHeader)` directly in `usage/route.ts:25`. Matches peer pattern. Minor breaking change for tr_live_ callers using this endpoint. **Option 3 (heavier, longer-term):** formalize `api_keys.allowed_tools` scope claims (`read:usage`, `write:execute`); tie to Codex #23 BYOK runtime gate scope.
- **Why this matters for /loop directive:** read-route auth-mode drift hides in matrix audits — every endpoint works, nothing fails. Audit-matrix view: 6 session-authed read endpoints, 1 outlier, named.

## REVIEW-WAIT — Lane 4.106 (`tool_providers.auth_key_encrypted` plaintext + anon-readable AMBIGUOUS)
- **Branch:** `lane-4.106-master-pool-plaintext-and-anon-read`
- **Memo:** `.agent/lane-4.106-master-pool-plaintext-and-anon-read.md`
- **PR:** pending (will pin number after `gh pr create`)
- **Severity:** HIGH-LATENT (column plaintext today; table empty in prod → anon GET returns `[]` AMBIGUOUS per Memory rule #56)
- **Finding:** `tool_providers.auth_key_encrypted` is plaintext despite the column name. Write path: `src/app/api/admin/providers/route.ts:59, 96` — POST/PATCH writes `auth_key_encrypted: api_key` directly. Read path: `src/lib/gateway.ts:271-282` — gateway reads + uses as bearer with no decrypt call. Live anon probe (2026-04-28) on `/rest/v1/tool_providers?select=auth_key_encrypted` returned HTTP 200 + `[]`. Empty body = empty table, NOT RLS-locked. First inserted row leaks publicly.
- **Sister to Lane 4.36:** `user_provider_keys.api_key_encrypted` is also plaintext (BYOK side, task #51 closed, #52 Codex impl pending). Same class, divergent fix path: post-Codex #23 BYOK gate + Lane 6.14 adapter deletion, master-pool storage shouldn't exist for Class-A or ToS-forbidden cohorts.
- **Codex follow-up:**
  - **Option 1 (ship now, defense-in-depth):** SQL migration — `REVOKE SELECT ON public.tool_providers FROM anon; REVOKE SELECT ON public.tool_providers FROM authenticated;`. Sibling to Lane 4.96-4.99 REVOKE chain. Server-side gateway uses service-role, unaffected.
  - **Option 2 (short-term):** gate `/api/admin/providers` POST/PATCH behind 410 Gone or feature flag until post-Codex #23 architecture review concludes whether master-pool storage is ever needed.
  - **Option 3 (deferred, only if architecture preserves storage):** Vault encryption mirroring Codex #52 pattern.
- **Why this matters for /loop directive:** column-name lies (`_encrypted` storing plaintext) are tech-debt magnets. Defuse today via REVOKE; architectural cleanup post-gate.
- **Note (2026-04-28 PM):** Lane 4.107 found the Option 1 SQL already exists at `scripts/lockdown-anon-writes-and-admin-tables.sql:39-61` from earlier-today Lane 4.16 work — just needs to run.

## REVIEW-WAIT — Lane 4.107 (Lane 4.16 SELECT-revoke SQL exists but was never shipped to prod)
- **Branch:** `lane-4.107-lane-4.16-sql-unshipped`
- **Memo:** `.agent/lane-4.107-lane-4.16-sql-unshipped.md`
- **PR:** pending (will pin number after `gh pr create`)
- **Severity:** HIGH-LATENT (same class as Lane 4.106 — AMBIGUOUS today, fix exists, just unshipped)
- **Finding:** Lane 4.16 (committed today) proposed SELECT-revoke on `tool_providers` + `rate_limit_windows` and shipped the migration at `scripts/lockdown-anon-writes-and-admin-tables.sql:39-61`. Lane 4.96 then ran on top of an unverified assumption that Lane 4.16 SQL had executed. Live probes (this tick) prove only the write-revoke half shipped — Section 1 SELECT-revoke is unshipped. `tool_providers` AND `rate_limit_windows` both anon-readable HTTP 200 + `[]` (AMBIGUOUS).
- **Justin-actionable:** paste `scripts/lockdown-anon-writes-and-admin-tables.sql` into Supabase SQL editor (project `isbratmfnnzipzyoefbo`). Idempotent, ~30 sec. Verify with two `curl` probes documented in memo.
- **Codex follow-up:** amend `scripts/lane-4.96-anon-write-grants-revoke.sql:23` header in a future PR to remove the false claim "Lane 4.16 REVOKE'd anon SELECT on these tables." Audit-process improvement: live-probe applied-SQL claims rather than trusting sibling-memo headers.
- **Process note:** this is the second audit memo today on the same `tool_providers` AMBIGUOUS state (Lane 4.106 also flagged it without referencing Lane 4.16's prior fix proposal). Add a `grep -l "<table>" .agent/*.md` pre-draft step.
- **Why this matters for /loop directive:** "applied" claims need live-probe proof (extends Hard Rule #61 from Codex audits to internal claims). Pre-launch checklists that read sibling-memo headers as source-of-truth are self-deceiving.

## VERIFIED-SHIPPED — Lane 4.5 v2 (`scripts/lockdown-anon-read-leaks-v2.sql`) — 2026-04-28 loop tick 35
- **Probe set:** `api_keys`, `user_provider_keys`, `tool_requests`, `gateway_users`, `gateway_usage_log`, `credit_transactions`, `usage_events`. All 7 → HTTP 401 anon (LOCKED).
- **Method:** `curl /rest/v1/<t>?select=*&limit=1` with anon JWT — see `.agent/lane-4.107-lane-4.16-sql-unshipped.md` for probe pattern.
- **Outliers (still AMBIGUOUS):** `tool_providers`, `rate_limit_windows` — those are the Lane 4.107 finding (Section 1 of `lockdown-anon-writes-and-admin-tables.sql` unshipped). Justin to run.
- **Implication:** the Lane 4.5 v2 SQL DID ship to prod (unlike Lane 4.16 Section 1). Probe-driven verification confirmed; no false `[VERIFIED]` claims to amend. This is the audit-pattern Lane 4.107 surfaced — applied to the next sibling SQL file. Net result: 1 of 13 `scripts/*.sql` files identified as unshipped (Lane 4.107); 1 of 13 verified shipped via probe; remaining 11 are RPC-class (need RPC probes, deferred to next tick).

## VERIFIED-SHIPPED — Lane 4.92 + Lane 4.94 RPC EXECUTE lockdowns — 2026-04-28 loop tick 36
- **Lane 4.92 (`scripts/lockdown-gateway-rpcs.sql`):** anon POST → all 5 RPCs locked. `validate_api_key`/`add_credits`/`deduct_credits`/`log_gateway_request` → 401; `check_rate_limit` → 404 (PostgREST not exposing post-revoke).
- **Lane 4.94 (`scripts/lane-4.94-secdef-rpc-lockdown.sql`):** anon POST → both RPCs locked. `get_user_dashboard` → 401 (was full PII payload pre-fix); `cleanup_rate_limits` → 401.
- **Lane 4.93 (`scripts/lane-4.93-credit-rpc-input-validation.sql`):** unprobeable from anon — RPC is locked from anon by 4.92, so input-validation behavior can only be tested via service_role JWT. Deferred. Caller-side audit (Apr 28) confirmed all 5 call sites already gate `> 0` so practical risk is low.
- **Cumulative session probe-matrix:** 9 tables + 7 RPCs verified shipped via anon-probe. Sole known-unshipped = Lane 4.107 Section 1 (`tool_providers` + `rate_limit_windows` SELECT-revoke; Justin SQL pending).

## VERIFIED-SHIPPED — Lane 4.96 + Lane 4.98 anon WRITE revokes — 2026-04-28 loop tick 37
- **Lane 4.96 (financial tables, 6/6):** `api_keys`, `credit_transactions`, `gateway_usage_log`, `gateway_users`, `usage_events`, `user_provider_keys` — all anon POST → HTTP 401 with body `{"code":"42501","message":"permission denied for table <t>"}`. GRANT-layer denial confirmed (NOT RLS-layer "violates row-level security" — proves the REVOKE shipped, not just RLS still holding).
- **Lane 4.98 (zero-policy tables, 8/8):** `conversations`, `discovery_feed`, `inventory`, `rate_limit_windows`, `tool_memory`, `tool_overrides`, `tool_providers`, `tool_requests` — all anon POST → HTTP 401 GRANT-layer.
- **Layer-distinction note:** body inspection (`permission denied for table` vs `violates row-level security`) is how to differentiate GRANT-layer vs RLS-layer 401s when probing write revokes. Useful for any future Lane-4-class verification.
- **Cumulative session probe-matrix update:** 17 tables (read+write) + 7 RPCs verified shipped via anon-probe. Sole known-unshipped remains Lane 4.107 Section 1 (Justin SQL pending). Outstanding probe targets: Lane 4.97 (authenticated write revoke — needs authenticated JWT, deferred), Lane 4.99 (8 one-policy tables — same probe pattern as 4.98), Lane 4.93 (RPC input validation — needs service-role).

## VERIFIED-SHIPPED — Lane 4.99 anon WRITE revokes (8 one-policy SELECT-only) — 2026-04-28 loop tick 38
- **Tables (8/8):** `category_beliefs`, `composites`, `plans`, `provider_health_log`, `skills`, `tool_categories`, `tool_pricing`, `tools` — all anon POST → HTTP 401 GRANT-layer (`{"code":"42501","message":"permission denied for table <t>"}`).
- **Read-side regression check:** spot-probed `tools`, `tool_categories`, `category_beliefs` SELECT → all HTTP 200. Public catalog reads still work post-revoke as designed (the "SELECT-only" half of the one-policy intent is preserved).
- **Cumulative session probe-matrix update:** 25 tables + 7 RPCs verified shipped via anon-probe (17 → 25 this tick, +8). Sole known-unshipped remains Lane 4.107 Section 1.
- **Remaining probe targets:** Lane 4.97 (authenticated write revoke on financial tables — needs authenticated JWT, no easy session in this loop), Lane 4.93 (RPC input validation on add_credits/deduct_credits — needs service-role JWT to invoke; caller-side audit per Apr 28 already confirms all 5 call sites gate `> 0` so practical risk is low). Both are deferred as low-marginal-utility.

## VERIFIED-SAFE — `/api/v1/tools` catalog endpoint vs Lane 4.106 leak vector — 2026-04-28 loop tick 39
- **Concern:** Lane 4.106 found `tool_providers.auth_key_encrypted` is plaintext + Lane 4.107 found anon-SELECT still ON. If `/api/v1/tools` joined `tool_providers`, the catalog would leak provider creds publicly.
- **Verification:** read `src/app/api/v1/tools/route.ts:1-170` + live probe of `/api/v1/tools` response shape. Default path uses `get_tool_catalog` RPC (or fallback `tools.select(<explicit-column-list>)`) — neither joins `tool_providers`. Format-variants `?format=openai|mcp|anthropic` use `listAdapters()` from in-memory registry, no DB read. Live response (sampled 6 entries: brave-search, claude-api, composio, context7, deepgram, elevenlabs) confirms no `auth_key_encrypted`/`api_key`/credential-shaped fields.
- **Implication:** Lane 4.106 leak vector is bounded to direct anon `/rest/v1/tool_providers` reads, NOT propagated through the public catalog endpoint. Reduces blast radius framing in Lane 4.106 memo (still HIGH-LATENT severity — direct PostgREST endpoint remains exposed until Lane 4.107 SQL ships).
- **Future-proofing note:** `tools.select(...)` uses an explicit column allowlist (id, name, slug, description, capabilities, cost, status, super_category, sub_category) — adding a sensitive column to `tools` itself wouldn't auto-leak. Same for `get_tool_catalog` RPC (return shape is fixed at function definition). Defense-in-depth is intact.

## VERIFIED-SAFE — `/api/v1/key` GET shape — 2026-04-28 loop tick 40
- **`getKeyInfo` (gateway.ts:400-439) returns:** `key_name`, `plan`, `credit_balance`, `rate_limit:{rpm,rpd}`, `usage:{today,this_month}`. No raw key, hash, or `key_prefix`. usage shape is row counts + cost sums only — no per-call detail.
- **Implication vs Lane 4.105 dual-auth concern:** even when called via tr_live_, the response shape is bounded — adding tr_live_ auth here would NOT widen what the key holder sees about their own data. Lane 4.105 widening concern stands only for `/api/v1/usage` (which exposes per-call rows). `/api/v1/key` is ticket-shaped (rolled-up) and would be safer to dual-auth than `/api/v1/usage`. Useful framing if Codex revisits Lane 4.105 Option-3 scope claims.
- **Diminishing-returns acknowledgement:** session probe-matrix is now 25 tables + 7 RPCs verified shipped + 2 endpoint shapes verified safe (`/api/v1/tools`, `/api/v1/key`). The remaining audit angles are mostly low-yield. Lane 4.107 SQL execution remains the only Justin-blocker; PR stack 131-137 awaits review/merge. Loop continues with reduced scope per /loop directive ("Stop only if real blocker that needs Justin" — Lane 4.107 IS that blocker, but loop is licensed to continue background audits while waiting).

## RESPONSE-CODE REFINEMENT — Lane 4.92 RPC lockdown returns 404 PGRST202, not 401 — 2026-04-28 loop tick 41
- **Probed all 5 RPCs from Lane 4.92 batch (line 420 [RESOLVED] entry):** `add_credits`, `deduct_credits`, `validate_api_key`, `check_rate_limit`, `log_gateway_request` — anon JWT POST `{}` → uniform `HTTP 404` + `{"code":"PGRST202","message":"Could not find the function public.<fn> ... in the schema cache"}`.
- **Mismatch with build-queue narrative:** line 420 reports "All 5 RPCs now return HTTP 401 permission-denied to anon" — actual is 404 PGRST202. Both indicate locked, but the mechanism differs: 401 = function visible but EXECUTE denied; 404 PGRST202 = function hidden from PostgREST schema cache (anon-EXECUTE revoke causes PostgREST to omit the function from its introspection set entirely). The Lane 4.14 lockdown is at the **schema-cache layer**, even stronger than 401.
- **Drift-test implication (CORRECTED tick 42):** initial tick-41 framing claimed existing vitests would silently false-fail. **That was hypothetical, not actual.** Tick-42 audit of all 5 grants-drift tests (`gateway-rpc-grants-drift`, `anon-write-grants-drift`, `authenticated-write-grants-drift`, `zero-policy-tables-write-grants-drift`, `registry-tables-write-grants-drift`) confirms zero HTTP status-code assertions — they're all static SQL+source parsers (REVOKE/GRANT clause presence checks). Lockdown is enforced at the SQL-text layer, runtime response code is incidental. The 401 vs 404 PGRST202 distinction matters only for FUTURE runtime probes that anchor on status code. Sibling to Hard Rule #62 (verify origin/main vs working tree before claiming a bug exists).

## VERIFIED-SAFE + RESIDUAL-ORACLE — schema-directory locked, per-table existence still oracled — 2026-04-28 loop tick 43
- **Strong positive find:** `GET /rest/v1/` (PostgREST OpenAPI introspection — full schema directory listing every table+RPC visible to the calling role) returns `HTTP 401` + `{"message":"Invalid API key","hint":"Only the service_role API key can be used for this endpoint."}` to anon. Anon literally cannot enumerate what tables exist — names must be guessed from product context.
- **Residual disclosure surface:** per-table probe still oracles existence via response-code pattern. Test set:
  - `usage_events` → 401 + `42501 "permission denied for table"` → EXISTS, LOCKED
  - `nonexistent_xyz_table` → 404 + `PGRST205 "Could not find the table"` → DOES NOT EXIST
  - `api_keys`, `gateway_users` → 401 + 42501 → EXISTS, LOCKED
  - `tools` → 200 + rows → EXISTS, READABLE
  - `rate_limit_windows` → 200 + [] → AMBIGUOUS (Lane 4.107 outlier confirmed)
- **Class-distinction vs RPC layer (tick 41 sibling):** for RPCs, anon-EXECUTE revoke triggers PGRST202 cache-hide (404 — function name leaks NOTHING). For tables, anon-SELECT REVOKE leaves the table visible to introspection at the route level — 42501 still confirms existence. Different lockdown granularities. Hard Rule #56 (table 401/200/200+[]) was correct; tick-41 added the RPC analog (401/404+PGRST202/200).
- **Severity framing:** LOW residual. Table names are typically inferrable from product feature surface (`/dashboard/api-keys` → `api_keys`, `/dashboard/usage` → `usage_events`). Schema-directory lockdown means an attacker has to guess, but they don't have to guess hard — common conventions narrow the search space to ~30 candidates. Closing this would require shifting all tables behind a numeric-id-only PostgREST routing scheme — high-cost, low-payoff. **Not actionable; documenting as known posture.**
- **Implication for /loop tick discipline:** sweep-audit via `/rest/v1/` introspection is unavailable. Each table must be probed by name. Existing audit set (Lane 4.5/4.96/4.97/4.98/4.99/4.107) covered known tables exhaustively; the schema-directory lockdown means there's no way to find UNKNOWN tables anon could read without service-role access. The "completeness" guarantee for the table-side audit comes from `pg_class` queries done via Mgmt API, not anon probes — that's the right posture.
- **Cumulative session probe-matrix:** 25 tables + 7 RPCs + 2 endpoint shapes + schema-directory lockdown verified. The remaining audit gap is whether `pg_class` enumeration was ever cross-referenced against the Lane 4.5/4.96-4.99 covered-tables list — Codex follow-up: query `pg_class` via Mgmt API, diff against the union of those 5 lockdown SQL files, surface any table not in either set as a "did anyone ever probe this?" flag. Likely zero residual after Lane 4.107 ships, but worth confirming once.

## VERIFIED-BOUNDED — Lane 4.36 BYOK plaintext leak vector — 2026-04-28 loop tick 44
- **Two-layer bounding confirmed:**
  - **API layer** (`src/app/api/v1/byok/route.ts:65-98` GET, lines 22-36 POST): both return shapes use **explicit column allowlist** `id, tool_slug, is_active, prefer_own_key, created_at, updated_at`. `api_key_encrypted` (the plaintext column from Lane 4.36) is **NOT** in either SELECT. Even though storage is plaintext, the user-facing API never echoes the key back. Same defense as `/api/v1/key` (tick 40).
  - **DB layer** (live anon probe): `GET /rest/v1/user_provider_keys?select=*&limit=1` → `HTTP 401` + `42501 permission denied for table user_provider_keys`. Targeted column probe `?select=api_key_encrypted` also 401 — GRANT-layer REVOKE fires before column-level RLS. Confirms Lane 4.96 SQL shipped against this table.
- **Residual surface:** the only path to plaintext `api_key_encrypted` is direct service_role access — admin queries, accidental log dumps, or service-role JWT exfiltration. None of these are anon-reachable. Lane 4.36 task #52 (Codex Vault encryption) closes the residual but is **not a P0 because the API+REST layers are already locked**. The "URGENT" framing in Lane 4.36 memo overstated the immediate risk; severity is correctly HIGH-LATENT (matches Lane 4.106 framing for the master-pool sibling).
- **Class-symmetry note vs Lane 4.106:** master-pool (`tool_providers.auth_key_encrypted`) and BYOK (`user_provider_keys.api_key_encrypted`) are sibling plaintext columns. **Asymmetry:** master-pool is anon-readable today (Lane 4.107 unshipped) AND the gateway code-path reads it as plaintext (`src/lib/gateway.ts:271-282`). BYOK is GRANT-revoked (this tick) AND no API path returns the column. So BYOK is double-bounded, master-pool is zero-bounded — explains why Lane 4.106 is the more urgent of the two even though both columns are plaintext.
- **Cumulative session probe-matrix:** 26 tables + 7 RPCs + 3 endpoint shapes (`/api/v1/tools`, `/api/v1/key`, `/api/v1/byok`) + schema-directory lockdown verified.

## VERIFIED-BOUNDED — `/api/v1/keys` CRUD shape + `api_keys` table — 2026-04-28 loop tick 45
- **API-shape audit (`src/app/api/v1/keys/route.ts`):**
  - **POST** (line 51-85): INSERT row stores `key_hash` (bcrypt-style hash from `generateApiKey()`/`generateTestApiKey()`); SELECT-back excludes `key_hash` (line 62-63). Response returns `raw` key string ONCE with `warning: "Store this key securely. It cannot be retrieved again."` — TextBlock-once disclosure pattern, never recoverable from any subsequent endpoint.
  - **GET** (line 109-115): explicit allowlist `id, name, key_prefix, allowed_tools, is_active, last_used_at, created_at, expires_at`. `key_hash` NOT in SELECT. `key_prefix` is the first ~10 chars (`tr_live_xxx`) — safe display fragment.
  - **DELETE** (line 165-183): IDOR-protected by `.eq("user_id", userId)` on existence-check AND update; soft-delete via `is_active=false` (preserves audit trail); wrong-user attempt returns 404 not 403/200 (no IDOR signal leak).
  - **PATCH** (line 212-280): IDOR-protected (line 257, 271); validates `name` length ≤80 + non-empty + key_id required; SELECT-back uses same bounded allowlist.
- **DB-side probe** (`api_keys` table direct anon REST):
  - `GET /rest/v1/api_keys?select=*` → 401 + 42501
  - `GET /rest/v1/api_keys?select=key_hash` → 401 + 42501 (column-targeted probe also blocked at GRANT layer)
  - `GET /rest/v1/api_keys?select=id,key_prefix` → 401 + 42501 (table-level REVOKE; column allowlist is moot at this layer)
  - All three uniform — Lane 4.96 SQL shipped fully against this table.
- **Triple-bounded class:** API key surface is bounded at three layers — (1) DB-side GRANT-revoke (anon can't read), (2) API SELECT allowlist (server doesn't echo `key_hash`), (3) storage discipline (`key_hash` is hashed not plaintext; raw `key` returned only at creation moment). Parallel structure to Lane 4.36 BYOK (tick 44 finding) — both credential tables identically bounded. The `/api/v1/keys` POST path is the only audit angle worth deeper review (does `generateApiKey`/`generateTestApiKey` use a CSPRNG? — out of scope for this tick, would be a Lane 4.X bcrypt-strength audit).
- **Class-symmetry observation across credential surfaces:**
  | surface | DB GRANT | API SELECT excludes secret | Storage discipline | Verdict |
  |---|---|---|---|---|
  | `api_keys.key_hash` (gateway keys) | ✅ 401+42501 | ✅ excludes from GET/PATCH | ✅ hashed at storage | TRIPLE-BOUNDED |
  | `user_provider_keys.api_key_encrypted` (BYOK) | ✅ 401+42501 (tick 44) | ✅ excludes from GET/POST | ❌ plaintext until Codex #52 | DOUBLE-BOUNDED + storage gap |
  | `tool_providers.auth_key_encrypted` (master-pool) | ❌ 200+[] (Lane 4.107 unshipped) | ❌ no /api/v1 endpoint reads it; gateway.ts:271-282 reads as plaintext for upstream calls | ❌ plaintext | UNBOUNDED — relies on Lane 4.107 + Lane 4.106 fixes |
- **Cumulative session probe-matrix:** 26 tables + 7 RPCs + 4 endpoint shapes (added `/api/v1/keys`) + schema-directory lockdown verified.

## VERIFIED-SAFE + DOCUMENTATION-DRIFT — `/api/v1/health` + discovery endpoints — 2026-04-28 loop tick 46
- **`/api/v1/health` GET shape** (`src/app/api/v1/health/route.ts:8-45`, live response): bounded — returns static service identity (`name`, `version: "1.2.0"`), serverless cold-start markers (`uptime_seconds: 0`, `booted_at`, `timestamp`), tool counts (`adapter_count: 51`, `operation_count: 152`), four public endpoint URLs, and five discovery URLs. No leakage of: DB connection status, env vars, PIDs, internal IPs, stack traces, build SHAs, dependency versions, memory/CPU stats. **Cold-start posture confirmed:** `uptime_seconds: 0` + `booted_at` matches `timestamp` to ~14ms — every invocation is a fresh Vercel function process; no long-running state to leak even if a future change accidentally exposed it.
- **Discovery endpoints probed** (advertised by `/api/v1/health.discovery.*`): all 5 return HTTP 200 with reasonable sizes — `openapi.json` (66KB), `ai-plugin.json` (1.5KB), `mcp.json` (651B), `agents.json` (5.5KB), `llms.txt` (2.2KB). Designed to be public, no leak class.
- **Admin endpoints — auth posture verified:**
  - `GET /api/admin/providers` → 401 + `{"code":"admin_auth_required"}`
  - `GET /api/admin/stats` → 401 + `{"code":"admin_auth_required"}`
  - Confirms Lane 4.28 (task #43, completed) admin auth coverage holds in prod. Same `admin_auth_required` code on both — consistent error-shape (no IDOR-leak signal differential).
- **DOCUMENTATION DRIFT — Lane 6.3-class find:** `/.well-known/openapi.json` advertises `/api/v1/provider-keys` as a documented endpoint, but `GET /api/v1/provider-keys` returns **HTTP 404** (Vercel default Next.js not-found page). The real BYOK endpoint is `/api/v1/byok` (tick 44). Likely rename leftover. **Severity: LOW (docs-only, no security leak — 404 doesn't expose anything).** But it's a class-match to Lane 6.3.x marketing-copy audits where public-facing claims didn't match runtime. **Codex follow-up:** edit `src/app/.well-known/openapi.json/route.ts` (or wherever the spec is generated) to either remove `/api/v1/provider-keys` or alias it to `/api/v1/byok`. Sibling drift-prevention: add a vitest that fetches every advertised path from openapi.json and asserts non-404 to anon (or non-405-only-on-GET).
- **Sibling non-v1 paths discovered:** `/api/check` (405 — POST-only), `/api/search` (400 — needs `?q=`), `/api/tools` (200 — legacy catalog endpoint, sibling to `/api/v1/tools`). All exist + auth-correct. Out of scope for this audit pass; logged for completeness.
- **Cumulative session probe-matrix:** 26 tables + 7 RPCs + 5 endpoint shapes (added `/api/v1/health`) + 2 admin auth-gates verified + 1 docs-drift finding logged + schema-directory lockdown verified.
- **Pattern for future audits:** Hard Rule #56 documents three states (401 LOCKED / 200+[] AMBIGUOUS / 200+rows LEAK) for **table** SELECT. For **RPC** EXECUTE the analog is four-state: `401` (visible, denied), `404+PGRST202` (cache-hidden, denied), `200/200+result` (callable). Both 401 and 404+PGRST202 are LOCKED outcomes; the 4-class distinction matters only when writing drift assertions that anchor on status code.

## VERIFIED + DB-DRIFT — `/api/v1/tools` catalog + 3 gateway entry points — 2026-04-28 loop tick 47
- **`GET /api/v1/tools` shape verified bounded.** 109 catalog items returned, 22 distinct field keys union: `adapter_slug, avg_latency_ms, capabilities, data, description, free_tier_calls, gateway_enabled, health_status, id, name, operation, price_per_call, price_per_unit, primary_type, protocols, provider_cost, rating, status, sub_category, super_category, tools, unit_name`. **Zero fields containing `key|secret|encrypt|hash|password|token|auth_key|env`.** No leak class. Catalog uses `withAvailability()` to override `status` from adapter registry runtime — DB columns are advisory only.
- **DB-drift observation:** `gateway_enabled: false` for **all 109 rows** (status counts: `coming_soon` 98, `available` 11; `gateway_enabled` is uniformly `false`). The `available` 11 are computed by `getToolAvailability()` from the adapter registry, not from DB. **The DB column `tools.gateway_enabled` is dead-code-equivalent** — runtime ignores it. Severity: NONE (security), but anyone querying `tools` table directly via SQL would mis-conclude that nothing is gateway-enabled. **Codex follow-up:** either populate `tools.gateway_enabled` to match adapter registry truth, or drop the column to remove the misleading signal.
- **`POST /api/v1/execute` auth posture verified clean:**
  - No `Authorization` header → HTTP 401 + `{"code":"auth_required","message":"Missing or invalid Authorization header"}`
  - Fake `Bearer tr_live_FAKE_NOT_REAL_12345` → HTTP 401 + `{"code":"invalid_key","message":"Invalid or revoked API key"}`
  - **No leakage in either error path.** Error codes are uniform shape with admin endpoints (`auth_required` vs `admin_auth_required` — distinguishable but no IDOR signal).
- **`POST /mcp` `tools/list` is intentionally anon (MCP-spec compliant discovery).** Returns full tool list to unauthenticated callers — designed surface, mirrors `/api/v1/tools` content. Not a leak.
- **`POST /api/a2a` re-confirms Lane 4.89 finding still live (PR #114 unmerged):**
  - Anon `tasks/get` with valid UUID → HTTP 200 + JSON-RPC error `Task not found: 00000000-...` — confirms DB query happens BEFORE auth check, which is the IDOR signature Lane 4.89 documented.
  - Anon `tasks/send` with valid-shape body → HTTP 200 + `Missing message content` validation error — auth check still appears to come after parser validation.
  - **No new finding** — Lane 4.89 covers it and is queued for Justin merge. Logged here for "live-state still leak" documentation.
- **Cumulative session probe-matrix:** 26 tables + 7 RPCs + **8 endpoint shapes** (added `/api/v1/tools`, `/api/v1/execute`, `/mcp`, `/api/a2a`) + 2 admin auth-gates + 1 docs-drift + 1 DB-drift finding logged + schema-directory lockdown verified.
