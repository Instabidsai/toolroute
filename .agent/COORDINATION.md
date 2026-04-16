# ToolRoute Multi-Session Coordination Plan

**Last updated:** 2026-04-16 by Jarvis session
**Status:** Active — multiple CC sessions working in parallel

## Who Is Running What

Justin runs 8+ simultaneous Claude Code sessions. This file lets them coordinate on ToolRoute without conflicting.

### Active lanes (pick ONE before starting work)

| Lane | Owner marker file | Scope |
|---|---|---|
| **A: Positioning & Copy** | `.agent/lane-A-active.md` | Ship the agent-native copy across homepage, /for-agents, /built-by-agents, llms.txt |
| **B: Stripe & Billing** | `.agent/lane-B-active.md` | Activate Stripe account, wire checkout flow, test $1 transaction |
| **C: Content Production** | `.agent/lane-C-active.md` | Blog articles, /alternatives pages, programmatic SEO |
| **D: Agent Discoverability** | `.agent/lane-D-active.md` | /.well-known/ endpoints, OpenAPI, llms.txt updates, schema markup |
| **E: Distribution** | `.agent/lane-E-active.md` | GitHub PRs, MCP Registry submission, PremiumMinds, DevTo |
| **F: Product Build** | `.agent/lane-F-active.md` | Auto-routing, registry ingest from PulseMCP/Glama, new adapters |

**Claim protocol:** Before starting work in a lane, `touch .agent/lane-X-active.md` with your session ID + timestamp. Delete when done. If the file exists and is <4 hours old, work in a different lane.

## Current State (snapshot)

### Done ✅
- 51+ blog articles across ToolRoute, VibeArmor, DropClose, CallTwin
- 10 product pages (/use-cases, /compare, /glossary, /integrations, /changelog, /faq, /mcp-statistics, /alternatives, /agents, /blog)
- 20 programmatic pages (/categories/[super]/best × 12, /protocols/[protocol] × 8)
- 41 /alternatives/[tool] pages
- 15 agent-discovery endpoints (/.well-known/*, /agents.json, /api/v1/health, /llms.txt, /llms-full.txt)
- /agents landing page (agent-as-reader ICP)
- 87 tool pages with SoftwareApplication + aggregateRating schema
- 3 GitHub awesome-list submissions (PR #4969, PR #3963, mcpservers.org web form)

### In Draft (needs deploy) 🟡
- **`src/content/positioning-v2.md`** — "Built by Agents, For Agents" copy for homepage + /for-agents + /built-by-agents + llms.txt rewrite. **Do not deploy piecemeal — all 6 surfaces ship together.**

### Blocked ⚠️
- **Stripe account creation** — requires Justin (can't be automated)
- **Tool API keys on Vercel** — requires Justin (secrets management)
- **mcpservers.org approval email** — check `justin@affixed.ai` inbox ~12hr window
- **Google Indexing API quota** — resets midnight PT daily (200/d limit)
- **GSC analytics MCP** — blocked in harness, no fix yet
- **blitzgtm.com + performanceedge.ai GSC verification** — DNS/registrar issues, needs Justin

## Priority Order (what to do first if you have a free lane)

### Priority 1 — Ship positioning (Lane A)
Read `src/content/positioning-v2.md`. Deploy all 6 surfaces in ONE commit:
1. Update homepage hero + trust bar
2. Create `/for-agents` page (already have `/agents`, may want to consolidate)
3. Create `/built-by-agents` page
4. Replace `public/llms.txt` with v2 content
5. Verify 40/51/87/121 numbers from git log before going live
6. Publish blog #4 from the draft title list

### Priority 2 — Stripe live (Lane B, needs Justin)
Draft what can be drafted:
- Stripe integration code is already there per `CLAUDE.md` changelog
- Missing: Stripe account, product IDs, webhook URL registered
- When Justin activates: test with $1 transaction end-to-end

### Priority 3 — MCP Registry submission (Lane E)
Per Agent 5 note: official `modelcontextprotocol/servers` may decline our PR since they retired the list. The long-term channel is `registry.modelcontextprotocol.io`. Build + submit the ToolRoute MCP server manifest there.

### Priority 4 — Ingest external registries (Lane F)
Build an endpoint/script that pulls from PulseMCP + Glama + Official MCP Registry and overlays our belief system on top. This is our unique differentiator (5/10 whitespace slots). Public APIs all documented in `~/content-reports/competitor-agent-discovery-analysis.md`.

### Priority 5 — Content continues (Lane C)
Only after 1-4 have progress. Comparison articles, zero-comp keywords (shadow-MCP already shipped, governance shipped, audit shipped), more programmatic pages. See `feedback_zero_manual_work.md` in Hive Brain memory for distribution rules.

## Hard Rules for All Sessions

1. **Never `npm run dev`.** Build to verify via `npm run build`, deploy via git push.
2. **Check this file before big changes.** Update the "Done" section as you ship.
3. **Don't double-deploy positioning.** It ships in one batch or not at all.
4. **Zero manual work for distribution.** Auto-post or skip — never leave drafts for Justin (feedback_zero_manual_work memory).
5. **Respect the 6-way feature intersection.** We're 5/6. Stripe is the gap. Don't add complexity before closing it.
6. **Save new memories to Hive Brain** for cross-session knowledge:
   - `company_memories` table, `company_id=toolroute`, `category` in {customer_insight, decision, learning, observation, technical}
   - `source=cc_session`

## Key Files/Paths

- **Positioning draft:** `src/content/positioning-v2.md`
- **Reports:** `~/content-reports/` (competitor analysis, schema audit, SERP reports)
- **Hive Brain URL:** `https://wdvfwtecvdhtvmyeymgy.supabase.co`
- **ToolRoute DB:** `https://isbratmfnnzipzyoefbo.supabase.co`
- **Registry data:** query `tools` table for capability lookups
- **CLAUDE.md:** project-specific rules and architecture

## Current Session Handoff (2026-04-16, Jarvis)

Stopped the `/seo-overnight` cron at job 582f709c. Next session can resume it with:
```
/loop 30m /seo-overnight toolroute
```
or pick a specific lane above. The strategic pivot cycle completed — all 5 agents returned successful. Positioning is drafted but NOT deployed.

**Immediate next action:** Either ship positioning (priority 1) or start building external registry ingest (priority 4). Everything else is either blocked-on-Justin or maintenance.
