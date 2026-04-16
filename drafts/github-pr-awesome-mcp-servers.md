# PR Draft: awesome-mcp-servers (wong2)

**Repo**: https://github.com/wong2/awesome-mcp-servers
**Action**: Add entry under a new "Gateways / Platforms" section, or whichever section fits best for aggregation layers.

---

## PR Title

Add ToolRoute — MCP gateway with unified API and prepaid billing

## PR Description

### What is ToolRoute?

ToolRoute is an MCP gateway (think "OpenRouter for tools") that lets agents call 87+ MCP-compatible tools through a single API key and endpoint. Instead of managing dozens of API keys and server processes, agents hit one gateway that handles routing, authentication, and billing via prepaid credits.

### Why add it?

Most entries in this list are individual MCP servers. ToolRoute sits a layer above — it routes requests to the right tool across 14 categories. This is useful for builders who want to give their agents broad tool access without running 20+ MCP servers locally.

### Entry

**Suggested section**: Gateways / Platforms (new), or Aggregators, or Frameworks — wherever multi-tool orchestration layers fit.

```markdown
- [ToolRoute](https://toolroute.ai) - MCP gateway with 87 tools across 14 categories, unified API, and prepaid credits billing. One API key for search, email, voice, database, security, and more. Supports REST, MCP Streamable HTTP, A2A, and OpenAI function calling.
```

### Details

- **Website**: https://toolroute.ai
- **Docs**: https://toolroute.ai/docs
- **Tool Registry**: https://toolroute.ai/tools
- **Protocols**: REST, MCP Streamable HTTP, A2A (Google), OpenAI Functions
- **Billing model**: Prepaid credits with BYOK option
- **Categories**: Communication, CRM & Sales, Scheduling, Analytics, E-commerce, DevOps, Finance, Content, Marketing, HR & Operations, Security, Infrastructure
- **Scoring**: Every tool rated on 8 dimensions (capability, protocol support, cost, maturity, resale potential, reliability, ecosystem, agent-native design)
