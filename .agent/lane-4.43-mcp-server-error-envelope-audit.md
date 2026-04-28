# Lane 4.43 — mcp-server Supabase error.message leak audit

## Class
Same finding class as Lane 4.41 (gateway routes), extended to the published MCP server (`mcp-server/index.js`, npm `toolroute-mcp@1.1.0`).

## Surface
`mcp-server/index.js` exposes 4 read-only Supabase RPCs to MCP clients (Claude/Cursor/Codex/etc) via stdio transport. Each was returning `error.message` verbatim:

| Tool | Line | RPC |
|------|------|-----|
| `check_before_build` | 86 | `check_before_build(p_task)` |
| `search_tools` | 107 | `search_tools_text(p_query, p_limit)` |
| `get_category_champion` | 134 | `get_category_champion(p_super, p_sub)` |
| `librarian_status` | 149 | `librarian_startup()` |

## Threat model
RPCs run under the public anon key — leak surface narrower than service-role routes (Lane 4.41), but still leaks:
- RLS policy names on policy violation errors
- Postgres function-internal `RAISE` messages (PL/pgSQL)
- Argument-type errors revealing function signatures
- Schema/column references in CHECK / FK violations bubbling up through `SECURITY DEFINER` RPCs
- Hint info from `pg_catalog` lookup paths

The MCP transport surfaces these strings in the agent's chat log — a low-friction recon channel for anyone with a free anon key + an MCP client.

## Patch
Match Lane 4.41 envelope: log raw error to stderr (server-side ops visibility), return generic message to client.

```js
if (error) {
  console.error("mcp:<tool> RPC error:", error.message);
  return { content: [{ type: "text", text: "Error: <tool> failed" }] };
}
```

Applied at all 4 sites. Bumped `mcp-server/package.json` version to `1.1.1` so downstream npm consumers know this is a security patch release.

## Drift guard
`tests/unit/mcp-server-error-leak.test.ts` (2 assertions):

1. **Regex sweep** — flags any line matching `text:\s*\`Error:\s*\$\{error\.message\}\`` in `mcp-server/index.js`. Returns offending `file:line` list.
2. **Coverage check** — every `await supabase.rpc(...)` call must have a paired `console.error("mcp:...")` log line. Catches the case of someone deleting the log line while keeping the redaction (defeats ops-side debug visibility).

## Out of scope (deferred)
- The 5 gateway-proxy tools (`record_usage`, `challenge_tool`, `log_tool_request`, `execute`, plus version-bump notice) all flow through `gatewayPost()` which already handles errors via the catch block at line 64–73 — they return `err.message` only on fetch / JSON parse failure, not on RPC errors. No leak class there.
- The MCP server itself is not behind toolroute.ai — it ships as an npm package consumed locally by clients. Redaction is per-instance, but the published package is the canonical artifact, hence the version bump.

## Follow-ups
- Lane 4.44 (queued): production-fetch test that POSTs malformed bodies to the live registry routes and asserts redacted JSON envelopes (closes the gap that drift tests parse source not runtime behavior).
- Codex queue (#23, #25): BYOK runtime gate + verified 49-slug BYOK list — orthogonal to this lane.

## Verification
```bash
npx vitest run tests/unit/mcp-server-error-leak.test.ts
# Test Files  1 passed (1)
# Tests       2 passed (2)
```
