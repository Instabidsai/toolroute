# Lane 4.103 — Catalog-listing env-var-only gate has no Class-A awareness; auto-router amplifies

**Owner:** Claude (auditor)
**Started:** 2026-04-28
**Severity:** HIGH-LATENT (catalog filter is the only thing keeping Class-A adapters off public catalogs today)
**Sibling:** Lane 4.100 (active leak escalation) → Lane 4.101 (BYOK gap universal) → Lane 4.102 (Class-A enumeration) → **Lane 4.103 (catalog + auto-router amplification)**

## TL;DR

The Class-A broken-by-design adapters (Lane 4.102 — slack/linear/twilio/hubspot/sentry/mux/notion/linkedin/apollo/sendgrid/stripe/supabase) are kept off the public catalog today **only because their env vars are not set in Vercel prod**. The filter is `listAvailableAdapters` in `src/lib/adapter-availability.ts:133-137` — pure env-var-presence check, no Class-A awareness.

The moment any Class-A env var is set:
1. The adapter immediately appears in **4 catalog endpoints** (default, `?format=openai`, `?format=mcp`, `?format=anthropic`).
2. The auto-router (`src/lib/adapters/auto-adapter.ts`) becomes able to **route natural-language tasks** into that adapter (e.g., "send a slack message" → slack send-message → master-pool fall-through → ToolRoute's Slack workspace).
3. AI agents discovering the catalog (the explicit ToolRoute value prop — "the OpenRouter for Tools") will call the listed tool without realizing it requires BYOK, triggering Class-A leak.

**Severity ranking:** HIGH-LATENT. Today: clean (no Class-A env vars set). Tomorrow if Justin sets one: instant 4-surface activation.

## File:line evidence

### `src/lib/adapter-availability.ts:133-137`
```typescript
export function listAvailableAdapters(adapters: ToolAdapter[]) {
  return adapters.filter(
    (adapter) => getAdapterAvailability(adapter.slug).status === "available"
  );
}
```
`getAdapterAvailability` checks `REQUIRED_ENV_BY_ADAPTER[slug]` env vars are all set. Binary check, no Class-A flag, no BYOK awareness.

### `REQUIRED_ENV_BY_ADAPTER` (lines 10-62)
Includes Class-A entries: `apollo`, `hubspot`, `linear`, `linkedin`, `mux`, `notion`, `sendgrid`, `sentry`, `slack`, `stripe`, `supabase`, `twilio`. (12-of-12 Class A from Lane 4.102 are reachable via this map.)

### `src/app/api/v1/tools/route.ts` — 4 catalog endpoints all use same filter
- **Line 15** (default `format=openai`): `const adapters = listAvailableAdapters(listAdapters());`
- **Line 50** (`format=mcp`): same
- **Line 93** (`format=anthropic`): same
- **Lines 124-145** (default Supabase fallback): different shape — `tools` table query — but feeds `withAvailability(t)` which calls `getToolAvailability` → same env-var binary.

### `src/lib/adapters/auto-adapter.ts:51-56` — auto-router uses same `availableSlugs` set
```typescript
function heuristicRoute(
  task: string,
  input: Record<string, unknown>,
  availableSlugs: Set<string>
): RouteMatch | null {
```
Heuristics include lines 91-108 (email → resend then sendgrid) and the routes for github/code/voice/sms — `availableSlugs.has("sendgrid")`, `.has("twilio")` etc. would fire if those env vars were set.

## Concrete activation scenario

**Step 1:** Justin sets `SLACK_BOT_TOKEN` in Vercel prod (e.g., to test slack integration).
**Step 2 (immediate):** `/api/v1/tools?format=openai` now returns slack tools to any AI agent fetching the catalog.
**Step 3 (immediate):** `/api/v1/tools?format=mcp` exposes slack to MCP-discovering clients (Claude Desktop, Cursor, etc.).
**Step 4 (immediate):** A user invokes A2A: `task: "send a message in slack saying hi"` → `/api/a2a` dispatches `auto/route` → auto-router (line 91+ of auto-adapter; if a slack heuristic exists, fires) → slack adapter → master-pool token sends message to ToolRoute's Slack workspace.
**Step 5 (Class-A leak):** message arrives in ToolRoute's #general (or wherever the bot is invited), NOT in the user's workspace.

Note: the auto-router heuristics in auto-adapter.ts I read don't include slack-specific routing today (the file only goes through line 200 in my read; later additions could include slack). The mechanism is the gap; the specific routing rule is incidental.

## Why this is independent of Codex #23 (BYOK runtime gate)

Codex #23 closes the **execution-path** gap: even if a Class-A env var is set, calling `tool:"slack",op:"send-message"` without BYOK returns 402. **Good — but doesn't help the catalog**:
- Catalog endpoints are anonymous (no auth required for `/api/v1/tools`). They cannot consult per-user BYOK. So the catalog must take a **different** signal:
  - Option A — never list Class-A adapters in anonymous catalogs (always `coming_soon` regardless of env-var status). Authenticated catalog (per-user) shows them only if the user has BYOK registered.
  - Option B — list Class-A adapters with explicit `requires_byok: true` flag and `master_pool_available: false` per-tool. AI agents inspecting the catalog see the flag and skip.
  - Option C — return Class-A adapters but with `description` field amended to read "REQUIRES BYOK — tool not callable without user-provided credentials." Lazy fix; agents may still try.

**Recommendation:** Option B (explicit flag) for the OpenAI Functions / MCP / Anthropic shapes (those have schema-extension room). Option A for the default human-facing catalog (avoid surprise).

## Auto-router fix is structurally simpler

Auto-router currently filters by env-var-presence. It should additionally filter by `Class !== "A" || byokRegistered(slug)`. The router only fires from `/api/a2a` and `/api/v1/execute` with `tool:"auto/route"` — both have `ctx` (the validated user). The router function should accept the `ctx` and call into a BYOK-aware availability check.

This means the auto-router fix lives in `executeToolRequest` resolution path:
1. Resolve `auto/route` → final slug via heuristicRoute.
2. **AFTER** resolution, check if final slug ∈ Class-A AND user lacks BYOK → fall through to next-best heuristic match OR error out with 402.
3. Repeat #1 if first match was filtered.

This is a sub-feature of Codex #23 (the gate). The `executeToolRequest` boundary recommended in Lane 4.101 is the right place — gate runs after auto-router resolution, naturally folds in.

## Acceptance for this audit memo

- [x] `src/lib/adapter-availability.ts` read in full — confirmed env-var-binary filter
- [x] `src/app/api/v1/tools/route.ts` read in full — 4 catalog formats all use same filter
- [x] `src/lib/adapters/auto-adapter.ts` partial read — confirmed `availableSlugs` is the same env-var-derived set
- [x] Lane 4.102's 12-adapter Class-A list cross-referenced against `REQUIRED_ENV_BY_ADAPTER` map — all 12 reachable
- [x] Activation scenario traced end-to-end (env var set → catalog appears → agent calls → leak)
- [ ] Codex: extend ticket #23 scope — add `requires_byok` flag to availability response + filter Class-A from anonymous catalog + auto-router post-resolution gate.

## Why this matters for /loop directive

The catalog endpoints are the **discovery surface** for the entire ToolRoute value prop. They are explicitly designed to be agent-readable (`?format=openai/mcp/anthropic`). Without Class-A awareness, the catalog is a **honeypot** that draws AI agents into Class-A operations the moment any env var is set. The Lane 4.100 P0 yank and Codex #23 gate close the execution path; this memo closes the **advertising path** that lures agents in.

The Lane 4.102 launch-readiness rule ("No Class-A master-pool env var set in prod until gate ships") is reinforced by this finding — even with the gate, the catalog needs Class-A awareness to avoid presenting tools that will 402 on every call.
