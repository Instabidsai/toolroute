# Lane 6.4.3 — 11 marketing pages document a request shape the gateway rejects

**Status:** AUDIT — proposes mechanical find/replace. Codex-friendly cleanup.
**Owner:** Claude (Lane 6)
**Hard Rule cross-refs:** #57 (pre-launch copy audit before tiered gates), #14 (audits: present findings before executing)

## TL;DR

Lane 6.4.2 found `/use-cases` snippets reference wrong adapter slugs/ops. This deeper sweep across the rest of `src/app/` found a worse class of error: **11 marketing pages document a request shape the gateway rejects with HTTP 400**.

Every blog snippet using:
```json
{ "tool": "tavily", "operation": "search", "input": {...} }
```
fails at runtime because:
1. `/api/v1/execute/route.ts:28-52` only reads `body.tool` and `body.input` — it ignores `body.operation` entirely
2. `gateway.ts:126-136` (`resolveAdapter`) splits `body.tool` on `/` and throws `400 invalid_tool_format` if `parts.length < 2`

Every customer who copy-pastes the published snippet gets 400 on their first request. This is the #1 onboarding-funnel breakage we ship today.

## The two shapes

| Shape | Where it appears | Runtime result |
|---|---|---|
| `{tool: "<slug>/<op>", input: {...}}` | `/use-cases`, `/integrations`, `/docs` (most), real adapters | ✓ accepted |
| `{tool: "<slug>", operation: "<op>", input: {...}}` | 11 blog posts + `/agents` step 3 | ✗ 400 invalid_tool_format |

The second shape is the natural mental model (it's how Function Calling APIs and most RPC libraries work) but **ToolRoute does not implement it**. The gateway only understands shape #1.

## Audit table — 11 pages × broken occurrences

Source: `grep -rE '"operation"\s*:\s*"' src/app/`. Excerpt: each row shows the exact line(s) to swap. Every `tool: "X"` + `operation: "Y"` becomes `tool: "X/Y"`, then drop the `operation` line.

| File | Line(s) | Current | Proposed |
|---|---|---|---|
| `src/app/agents/page.tsx` | 112-113 | `"tool": "elevenlabs/text-to-speech",`<br>`"operation": "synthesize",` | `"tool": "elevenlabs/text-to-speech",` (drop op line) |
| `src/app/blog/bring-your-own-key-mcp-byok/page.tsx` | 207-208 | `"tool": "openai",`<br>`"operation": "chat_completion",` | `"tool": "openai/chat",` ⚠ verify openai adapter has `chat` op |
| `src/app/blog/build-ai-agent-multiple-tools/page.tsx` | 319-320 | `"tool": "tavily", "operation": "search",` | `"tool": "tavily/search",` |
| ′ | 329-330 | `"tool": "semgrep", "operation": "scan",` | **DEFER** — no semgrep adapter (Lane 6.4.2 finding). Replace example with another tool. |
| ′ | 339-340 | `"tool": "resend", "operation": "send_email",` | `"tool": "resend/send-email",` ⚠ note adapter op is `send-email` (hyphen), not `send_email` (underscore) |
| `src/app/blog/context7-documentation-mcp-review/page.tsx` | 380-381, 387-388 | `"tool": "context7", "operation": "resolve-library-id",` etc. + uses `"params"` not `"input"` | `"tool": "context7/<op>",` PLUS rename `params` → `input`. ⚠ verify context7 adapter has these ops |
| `src/app/blog/how-to-choose-mcp-tool-ai-agent/page.tsx` | 235 | `'{"tool":"tavily","operation":"search","input":{...}}'` | `'{"tool":"tavily/search","input":{...}}'` |
| `src/app/blog/how-to-debug-mcp-tool-calls/page.tsx` | 387 | same | same |
| `src/app/blog/mcp-auto-routing-ai-agent-tools/page.tsx` | 328-329 | `"tool": "firecrawl", "operation": "scrape",` | `"tool": "firecrawl/scrape",` |
| ′ | 346-347 | `"tool": "auto", "operation": "route",` | ⚠ `auto` adapter exists per slug list but op `route` needs verification against adapter source |
| `src/app/blog/mcp-gateway-vs-api-gateway/page.tsx` | 217 | `{"tool": "tavily", "operation": "search"}` | `{"tool": "tavily/search"}` |
| ′ | 414 | inline code: `{tool: "tavily", operation: "search"}` | `{tool: "tavily/search"}` |
| ′ | 415 | inline code: `{tool: "resend", operation: "send_email"}` | `{tool: "resend/send-email"}` |
| ′ | 555 | `{"tool": "firecrawl", "operation": "scrape"}` | `{"tool": "firecrawl/scrape"}` |
| `src/app/blog/mcp-server-security-best-practices/page.tsx` | 186 | `'{"tool":"postgres","operation":"query","input":{"sql":"..."}}'` | **DEFER** — no `postgres` adapter exists. Use `supabase/execute-sql` instead. |
| `src/app/blog/use-mcp-tools-without-managing-servers/page.tsx` | 206-207 | `"tool": "tavily", "operation": "search",` | `"tool": "tavily/search",` |
| ′ | 216-217 | `"tool": "resend", "operation": "send_email",` | `"tool": "resend/send-email",` |
| `src/app/blog/what-is-an-mcp-gateway/page.tsx` | 252 | `{"tool": "tavily", "operation": "search", "input": {...}}` | `{"tool": "tavily/search", "input": {...}}` |

## Why this happened

The `tool + operation` mental model is what every other RPC API uses (OpenAI function calling, JSON-RPC, gRPC). It's the natural shape for a marketing writer to invent when documenting an "execute" endpoint. The actual `tool: "slug/op"` shape is a ToolRoute design choice — it has merits (single field encodes the full route, MCP-style), but it must be documented identically everywhere or customers can't onboard.

**Lane 6.4.2 + 6.4.3 together = 24 + 19 = 43 customer-facing snippet errors across 12 pages.** This is exactly the surface Hard Rule #57 was written to prevent.

## Proposed fast-follow sequence

1. **This PR (audit only):** ship this doc. Codex picks up the swap PR.
2. **Lane 6.4.3 swap PR (Codex):** mechanical find/replace on the 18 occurrences above. ~30 minutes, no judgment calls except for the 2 DEFER cases.
3. **Lane 6.4.4 (Codex or Claude):** ship the vitest drift-prevention test from Lane 6.4.2 — extended to walk every `.tsx` under `src/app/` and assert each `"tool":\s*"<x>"` literal matches `<slug>/<op>` shape AND `<slug>` resolves to a registered adapter AND `<op>` is in `adapter.operations`. ~50 lines. Catches all future drift.
4. **Lane 6.4.5 (Codex Lane 5 dependency):** add `semgrep`, `vercel`, `remotion`, `postgres` adapters OR rewrite the affected blog posts to use existing adapters.

## Cross-references

- `src/app/api/v1/execute/route.ts:28-52` — handler reads `body.tool` only
- `src/lib/gateway.ts:126-136` — `resolveAdapter` splits on `/`, throws on missing
- `.agent/lane-6.4.2-use-cases-snippet-audit.md` — first-pass audit of `/use-cases`
- PR #19 (Lane 6.4) — fixed chip-link layer only
- PR #21 (Lane 6.3) — honest BYOK callouts on `/pricing` + `/docs`
- Hard Rule #57 (pre-launch copy audit before tiered gates)
- Hard Rule #14 (audits: present findings before executing)

## Risks

- **Customer trust hit if any of these blog posts are top SEO landing pages.** ToolRoute's docs claim "copy-paste curl example" credibility. If `build-ai-agent-multiple-tools` (most-trafficked title pattern in this list) gets organic traffic from search, every visitor's first paste fails. Audit GA top-blog landing pages before deciding swap urgency.
- **The 2 DEFER rows (`semgrep/scan`, `postgres/query`) need a content edit, not a slug fix.** The blog post tells a narrative around those tools. Codex doing pure find/replace will still leave broken examples. Either swap the tool reference (semgrep → playwright; postgres → supabase) or delete the snippet.
- **Drift returns the moment a new blog post lands.** Without the vitest in step 3, the 6.4.3 swap PR will silently re-rot. Treat 6.4.3 swap and 6.4.4 vitest as paired — don't merge swap without test.
