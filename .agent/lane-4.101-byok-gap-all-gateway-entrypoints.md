# Lane 4.101 — BYOK runtime-gate gap is universal across all 3 gateway entry points

**Owner:** Claude (auditor)
**Started:** 2026-04-28
**Severity:** P0 / CRITICAL (extends Lane 4.100)
**Sibling:** Lane 4.100 (active leak on `/api/v1/execute`) → **Lane 4.101 (extends to `/mcp` + `/api/a2a`)**

## TL;DR

Lane 4.100 confirmed the BYOK runtime-gate is missing on `/api/v1/execute`. This lane verifies the gap is **universal** — the same `executeToolRequest` master-pool fall-through fires from all three gateway entry points with no BYOK enforcement. Codex ticket #23's scope must explicitly cover all three, not just `/api/v1/execute`.

| Entry point | Auth check line | Rate limit line | `executeToolRequest` line | BYOK gate? |
|---|---|---|---|---|
| `/api/v1/execute` | (Lane 4.100 audit) | (Lane 4.100 audit) | (Lane 4.100 audit) | **NO** |
| `/mcp` | route.ts:114 | route.ts:130 | route.ts:133 | **NO** |
| `/api/a2a` | route.ts:117 | route.ts:132 | route.ts:135 (`auto/route`) | **NO** |

**Implication:** Justin yanking `ANTHROPIC_API_KEY` + `OPENAI_API_KEY` from Vercel prod (Lane 4.100 P0 remediation) closes the active leak across all three paths simultaneously — they share the env-var fall-through. But the runtime gate fix must land at the `executeToolRequest` boundary (or in each route handler before dispatch) to prevent reactivation if env vars are ever re-set.

## Verification — file:line

### `/mcp` (MCP Streamable HTTP — JSON-RPC `tools/call`)

`src/app/mcp/route.ts` (full read 2026-04-28):
- **Line 114** — auth check: `if (!authHeader || !authHeader.startsWith("Bearer tr_live_"))` — only validates Bearer prefix.
- **Lines 124-126** — dynamic import of `validateRequest, checkRateLimit, executeToolRequest`.
- **Line 129** — `const ctx = await validateRequest(authHeader);`
- **Line 130** — `await checkRateLimit(ctx);`
- **Line 133** — `const result = await executeToolRequest(ctx, toolName, input);`
- **Lines 114→133:** zero BYOK enforcement. `toolName` flows directly from JSON-RPC params to the dispatcher.

### `/api/a2a` (Google A2A protocol — `tasks/send`)

`src/app/api/a2a/route.ts` (full read 2026-04-28):
- **Line 117** — auth check: same `Bearer tr_live_` prefix only.
- **Line 131** — `const ctx = await validateRequest(authHeader);`
- **Line 132** — `await checkRateLimit(ctx);`
- **Line 135** — `const result = await executeToolRequest(ctx, "auto/route", { task: textContent });`
- **Amplification factor:** A2A invokes the **auto-router** with user-supplied `textContent`. The router's selection of provider is NOT bounded by BYOK posture — it can pick `claude`/`openai` based on natural-language intent inference, and the master-pool fall-through delivers ToolRoute's keys. Worst case: an A2A client sends `task: "summarize this for me"` → router picks `claude` → master-pool inference billed to ToolRoute.

### `/api/v1/execute` (REST gateway)

Already audited in Lane 4.100. Same shape: auth check → `validateRequest` → `checkRateLimit` → `executeToolRequest` with no BYOK gate.

## Root cause shared across all three

All three routes converge on `executeToolRequest(ctx, toolName, input)` from `@/lib/gateway`. The gate must land EITHER:
1. **In each route handler** between `checkRateLimit` and `executeToolRequest` — three duplicated checks but explicit per-protocol error responses.
2. **Inside `executeToolRequest`** — single source of truth, but error must propagate via the protocol-specific shape (REST 402, JSON-RPC error code, A2A task error).

**Recommendation:** option 2. Single check in `executeToolRequest` reading from `BYOK_REQUIRED_SLUGS` (Codex ticket #23 scope). Each caller surfaces the existing `GatewayError` handling already wired in all three routes. Drift-test surface is one line in one file vs three.

## Auto-router caveat (A2A-specific)

The `auto/route` path at `/api/a2a` line 135 means **the BYOK gate must run AFTER routing decides on a tool, not before.** If the gate runs at the `auto/route` boundary, every A2A request fails the gate (since `auto/route` is itself not a BYOK-required slug). Implementation note for Codex #23:
- `executeToolRequest` first resolves `auto/route` → final tool slug
- THEN checks `BYOK_REQUIRED_SLUGS.has(final_slug)` against user's BYOK registry
- Returns gateway error only if final-slug requires BYOK and user has none

This is why option 2 (gate inside `executeToolRequest`) is structurally correct — the gate sits next to the auto-router resolution, not before it.

## Acceptance for this audit memo

- [x] `/mcp` route.ts read in full, BYOK gap confirmed at line 133
- [x] `/api/a2a` route.ts read in full, BYOK gap confirmed at line 135 + auto-router amplification documented
- [x] `/api/v1/execute` cross-referenced from Lane 4.100
- [x] Codex ticket #23 scope expansion: gate must land at `executeToolRequest` boundary (option 2), not per-route
- [x] Auto-router resolution-then-check ordering specified
- [ ] Codex: expand ticket #23 to cover all three entry points via single `executeToolRequest` gate
- [ ] Codex: drift test asserts adapter master-pool fingerprints ⊆ `BYOK_REQUIRED_SLUGS` (Lane 4.100 recommendation, still pending)

## Why this matters for the loop

Lane 4.100's P0 escalation could have shipped a partial fix that gated only `/api/v1/execute` — leaving `/mcp` and `/api/a2a` as live leak paths the moment Justin re-enables `ANTHROPIC_API_KEY` post-yank for any reason (debugging, customer support, demo). This memo closes that ambiguity in writing so the Codex ticket scope is unambiguous: **single gate, all three entry points, at the `executeToolRequest` boundary.**

The Lane 4.100 env-var yank (Justin owns) closes the active leak today across all three paths simultaneously. The Codex #23 gate prevents reactivation. Both still required.
