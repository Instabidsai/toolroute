# Hacker News Draft: Show HN

---

## Title

Show HN: ToolRoute — One API key for every AI agent tool

## URL

https://toolroute.ai

## Body (for the comments, if text post)

ToolRoute is a gateway for AI agent tools. Same concept as OpenRouter (one API for many LLMs), but for tool execution. One API key and one endpoint give your agent access to 87 tools across 14 categories: search, database, payments, email, browser automation, deployment, DNS, code scanning, and more.

The problem it solves: every tool your agent uses needs its own API key, its own auth flow, its own error handling. At scale, the tool integration layer becomes more fragile than the agent itself. ToolRoute consolidates all of that behind a single gateway with prepaid credits billing.

It speaks 5 protocols — REST, MCP Streamable HTTP, A2A (Google's agent-to-agent protocol), OpenAI-compatible function calling, and native SDKs — so any agent framework can connect regardless of what it supports natively.

The registry is curated, not scraped. Every tool is scored on 8 dimensions (capability, protocol support, cost, maturity, reliability, ecosystem, resale potential, agent-native design) with confidence scores derived from real usage observations. Category champions update automatically when a challenger outperforms the incumbent. The full scored registry is public at toolroute.ai/tools.

Built with Next.js and Supabase. Free tier available.
