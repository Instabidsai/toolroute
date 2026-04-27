# ToolRoute — 48-Hour Demo Runbook

> Goal: An outside agent installs the toolroute MCP, calls real tools through our gateway, lands an email + a GPT response, and we show the ledger billing it. Live.

## Pre-flight (do once before demo)

1. **SQL lockdown applied.** Confirm in Supabase SQL editor (project `isbratmfnnzipzyoefbo`) by running:
   ```sql
   SELECT proname, has_function_privilege('anon', oid, 'execute') AS anon_exec
   FROM pg_proc WHERE proname IN ('record_usage','log_tool_request','challenge_tool');
   ```
   Expected: all three rows show `anon_exec = false`.

2. **Vercel env vars set on production:** `OPENAI_API_KEY`, `RESEND_API_KEY`, `ANTHROPIC_API_KEY` (and any others as you expand the demo).

3. **Demo API key minted:** key prefix `tr_live_e8e4f6c7…` belonging to user `150c42fd-…dda5` ($4.99 free credit balance). Validate with:
   ```bash
   curl -s https://toolroute.ai/api/v1/key -H "Authorization: Bearer $TR_KEY"
   ```

4. **Production deploy verified.** Hit `/api/v1/registry/usage` unauthenticated → expect HTTP 401 (proves gateway is enforced).

## The 5-minute live demo

### 1. The hook (30s)
"Most agent frameworks ship with a tool. We ship the *registry of every tool* — one API key, one MCP install, 51 adapters. Watch."

### 2. Outside agent connects to public MCP (45s)
**Best path — no install, just a URL.** Any MCP-capable host (Claude Code, Cursor, Continue.dev, custom) connects to:
```json
{
  "mcpServers": {
    "toolroute": {
      "type": "streamable-http",
      "url": "https://toolroute.ai/mcp",
      "headers": { "Authorization": "Bearer <tr_live_…>" }
    }
  }
}
```
Or prove it with raw curl in front of the audience:
```bash
curl -s -X POST https://toolroute.ai/mcp \
  -H "Authorization: Bearer $TR_KEY" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | jq '.result.tools | length'
# → 152 (every adapter operation)
```

Fallback path: stdio MCP server at `mcp-server/index.js` for hosts that don't speak Streamable HTTP yet.

### 3. Agent thinks before it builds (60s)
Prompt the outside agent: *"I need to send a transactional email to a customer. Check what tools exist before writing code."*
Agent calls `check_before_build` → returns Resend, SendGrid, Postmark with belief confidence + champion. Agent picks Resend (champion).

### 4. Agent executes through gateway (60s)
Agent calls `execute` with `{ tool: "resend/send-email", input: { from: "onboarding@resend.dev", to: "you@…", subject: "…", text: "…" } }`.
- Gateway validates `tr_live_` Bearer.
- Pulls `RESEND_API_KEY` from master pool.
- Hits Resend, returns email ID.
- Bills $0.001 against the key, logs to `gateway_usage_log` with `key_source: "env_var"`.

### 5. Show the ledger (90s)
Open Supabase → `gateway_usage_log` table → live row appears within 1s of the call. Highlight columns: `cost_to_user`, `latency_ms`, `key_source`, `error_message`. Then run an OpenAI chat call — second row appears.

### 6. Close (30s)
"One key. One install. 51 adapters. Real billing. Real ledger. Same week we shipped this we revoked anon write access at the database layer to make sure no agent can bypass billing — that's how seriously we take being the layer between AI agents and the world's APIs."

## Verified working calls (Apr 27 2026)

| Call | Cost | Latency | Status |
|------|------|---------|--------|
| `openai/chat` (gpt-4o-mini) | $0.005 | 2.1s | 200 |
| `resend/send-email` (verified recipient) | $0.001 | 124ms | 200, email ID returned |
| `resend/send-email` (unverified recipient) | $0 | 148ms | 500 — Resend 403 surfaced cleanly, NOT billed |
| `claude/chat` | $0 | 198ms | 500 — Anthropic key has no balance, NOT billed |
| MCP `tools/list` over public HTTP | $0 | <500ms | 200, full tool catalog returned |
| MCP `tools/call` → openai/chat over public HTTP | $0.005 | 2.4s | 200, GPT response in JSON-RPC envelope |

## Known issues to disclose if asked

- **Anthropic key:** demo key has $0 Anthropic balance. Either buy ~$5 of Anthropic credit or skip Claude in the demo.
- **Resend free tier:** can only send to the verified Resend account email (`jjthompsonfau@gmail.com`). For partner demos verify a custom domain at resend.com/domains first.
- **Search/scrape:** No Tavily/Firecrawl/Brave keys yet in master pool. If presentation includes "agent does research," sign up for one free tier and add the env var before the demo.

## Rollback plan

If something breaks live:
- Roll Vercel deploy back: `vercel rollback toolroute-prev-id`.
- Or fall back to showing the ledger (Supabase) and the homepage — every claim on the site is independently true (87 tools listed, MCP server published, GitHub public).
