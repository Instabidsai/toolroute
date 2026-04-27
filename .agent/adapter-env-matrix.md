# ToolRoute Adapter Env-Var Matrix

Generated: 2026-04-27

Source: `src/lib/adapters/*-adapter.ts`, using direct `process.env.*` references.

Notes:
- "Required" means required for pooled ToolRoute execution. Many adapters can still run with a customer BYOK token even when the pooled env var is missing.
- "None" means the adapter has no `process.env.*` references.
- "BYOK-only" means the adapter explicitly has no pooled env var path and requires a customer-provided token at execution time.
- `POSTIZ_BASE_URL` is optional because the adapter falls back to `https://social.myjarvisbrain.com`.

| Adapter slug | Required env vars | Optional env vars |
|---|---|---|
| apollo | `APOLLO_API_KEY` | None |
| auto | `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL` | None |
| calendar | None (BYOK-only Google OAuth token) | None |
| claude | `ANTHROPIC_API_KEY` | None |
| context7 | None | None |
| creatify | `CREATIFY_API_ID`, `CREATIFY_API_KEY` | None |
| creatomate | `CREATOMATE_API_KEY` | None |
| dataforseo | `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD` | None |
| deepgram | `DEEPGRAM_API_KEY` | None |
| translate | `DEEPL_API_KEY` | None |
| drive | None (BYOK-only Google OAuth token) | None |
| elevenlabs | `ELEVENLABS_API_KEY` | None |
| exa | `EXA_API_KEY` | None |
| firecrawl | `FIRECRAWL_API_KEY` | None |
| github | `GITHUB_TOKEN` | None |
| heygen | `HEYGEN_API_KEY` | None |
| higgsfield | `HIGGSFIELD_API_KEY` | None |
| hubspot | `HUBSPOT_ACCESS_TOKEN` | None |
| image | `FAL_KEY` | None |
| linear | `LINEAR_API_KEY` | None |
| linkedin | `LINKEDIN_ACCESS_TOKEN` | None |
| mux | `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET` | None |
| notion | `NOTION_API_KEY` | None |
| openai | `OPENAI_API_KEY` | None |
| outscraper | `OUTSCRAPER_API_KEY` | None |
| pdf | `HTML2PDF_API_KEY` | None |
| pexels | `PEXELS_API_KEY` | None |
| playwright | None | None |
| postiz | `POSTIZ_API_KEY` | `POSTIZ_BASE_URL` |
| removebg | `REMOVEBG_API_KEY` | None |
| replicate | `REPLICATE_API_TOKEN` | None |
| resend | `RESEND_API_KEY` | None |
| screenshot | `SCREENSHOTONE_API_KEY` | None |
| search | `BRAVE_SEARCH_API_KEY` | None |
| sendgrid | `SENDGRID_API_KEY` | None |
| sentry | `SENTRY_AUTH_TOKEN` | None |
| sheets | None (BYOK-only Google OAuth token) | None |
| shippo | `SHIPPO_API_KEY` | None |
| shotstack | `SHOTSTACK_API_KEY` | None |
| slack | `SLACK_BOT_TOKEN` | None |
| stripe | `STRIPE_PLATFORM_KEY` | None |
| supabase | `SUPABASE_MGMT_TOKEN` | None |
| tavily | `TAVILY_API_KEY` | None |
| textbelt | `TEXTBELT_API_KEY` | None |
| toolroute | `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL` | None |
| twilio | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | None |
| twitter | `TWITTER_BEARER_TOKEN` | None |
| unsplash | `UNSPLASH_ACCESS_KEY` | None |
| vapi | `VAPI_API_KEY` | None |
| whisper | `OPENAI_API_KEY` | None |
| youtube | `YOUTUBE_ACCESS_TOKEN` | None |
