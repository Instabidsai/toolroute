# ToolRoute — The OpenRouter for Tools

## Commands
```bash
npm run build        # Production build (DO NOT run dev server)
npm run start        # Start production on port 3014
```

## Architecture
- Next.js 16 App Router + Tailwind v4 + Supabase
- **API Gateway**: `POST /api/v1/execute` — unified tool execution with API key auth, credits, rate limiting, BYOK
- **14 Tool Adapters**: toolroute, context7, elevenlabs, firecrawl, sendgrid, playwright, claude, github, supabase, stripe, twilio, whisper, resend, auto
- **Auto-routing**: `auto/route` — describe task in natural language, we pick the best tool
- **MCP Server**: `mcp-server/index.js` (8 tools including gateway execute)
- All data in Supabase `isbratmfnnzipzyoefbo`
- 20 tables, 23 RPCs, proper RLS

## Key Decisions
- **OpenRouter model**: One API key (`tr_live_xxx`), one billing relationship, access to all tools
- **Prepaid credits**: Platform fee on purchases, zero markup on tool costs
- **BYOK**: Users can bring their own API keys for any supported tool
- **14 adapters, not 50**: Only build adapters for tools with real APIs we can proxy
- **Auto-routing**: Natural language → best tool selection → execution

## API Endpoints
| Route | Auth | Purpose |
|-------|------|---------|
| `POST /api/v1/execute` | API key | Execute any tool |
| `GET /api/v1/tools` | None | Public tool catalog with pricing |
| `GET /api/v1/key` | API key | Key info + balance |
| `POST/GET/DELETE /api/v1/keys` | Session | Manage API keys |
| `GET /api/v1/usage` | API key/session | Usage history |
| `POST/GET/DELETE /api/v1/byok` | Session | Manage BYOK keys |
| `POST /api/v1/checkout` | Session | Stripe checkout |
| `POST /api/webhooks/stripe` | Stripe sig | Payment webhooks |

## Plans
- **Free**: $0/mo, 100 calls/day, 10 RPM, $1 starter credits
- **Pro**: $29/mo, 10K calls/mo, 60 RPM, $5/mo credits
- **Enterprise**: $299/mo, 100K calls/mo, 300 RPM, $50/mo credits

## Deploy
- Vercel: `toolroute-one.vercel.app` → `toolroute.ai`
- Project ID: `prj_kx4eeLmGLd8SbQbhxZkAoEORMfhF`
- GitHub: `Instabidsai/toolroute`

## Env Vars Needed on Vercel
- `SUPABASE_SERVICE_ROLE_KEY` ✅
- `STRIPE_SECRET_KEY` — needs dedicated ToolRoute Stripe account
- `STRIPE_WEBHOOK_SECRET` — needs webhook registration
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — needs Stripe account
- `ELEVENLABS_API_KEY`, `FIRECRAWL_API_KEY`, `SENDGRID_API_KEY`, `ANTHROPIC_API_KEY` — for tool adapters
