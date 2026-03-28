# ToolRoute — The OpenRouter for Tools

## Commands
```bash
npm run dev          # Start dev server on port 3014
npm run build        # Production build
```

## Architecture
- Next.js 16 App Router + Tailwind v4 + Supabase
- Server components fetch data, client components for interactivity
- MCP server at `mcp-server/index.js` (7 tools, stdio transport)
- All data in Supabase project `isbratmfnnzipzyoefbo`

## Key Decisions
- **50 curated tools, not 5000** — quality over quantity, 9/10+ only
- **Two-tier confidence**: 0.85 (tested by us) vs 0.6 (community only)
- **Beliefs evolve from usage** — record_usage() auto-updates confidence
- **Challenger protocol**: 8-dimension scoring, must win 5 to dethrone
- **Value-added platform**: sell output, not API access

## Supabase RPCs
`check_before_build`, `search_tools_text`, `get_category_champion`, `record_usage`, `challenge_tool`, `librarian_startup`, `log_tool_request`

## Deploy
- Vercel: `toolroute-one.vercel.app` → `toolroute.ai`
- Project ID: `prj_kx4eeLmGLd8SbQbhxZkAoEORMfhF`
- GitHub: `Instabidsai/toolroute`
