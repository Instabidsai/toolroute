# ToolRoute — The OpenRouter for Tools

## Commands
```bash
npm run build        # Production build (DO NOT run dev server)
```

## Architecture
- Next.js 16 App Router + Tailwind v4 + Supabase
- **51 tool adapters**, 152 operations, one unified gateway
- **5 protocols**: REST, MCP Streamable HTTP, A2A, OpenAI Functions, SDKs
- Prepaid credits + auto-top-up + Stripe billing
- All data in Supabase `isbratmfnnzipzyoefbo`

## Key Endpoints
| Route | Auth | Purpose |
|-------|------|---------|
| `POST /api/v1/execute` | API key | Execute any tool |
| `POST /mcp` | API key | MCP Streamable HTTP (JSON-RPC) |
| `POST /api/a2a` | API key | A2A protocol (Google) |
| `GET /api/v1/tools` | None | Tool catalog (supports ?format=openai) |
| `GET /api/v1/key` | API key | Key info + balance |
| `POST /api/v1/keys` | Session | Create API key |
| `POST /api/v1/byok` | Session | Register provider key |
| `POST /api/v1/checkout` | Session | Stripe checkout |
| `PATCH /api/v1/settings` | Session | Auto-top-up settings |

## Deploy
- Vercel: `toolroute.ai`
- GitHub: `Instabidsai/toolroute`
