# PR Draft: modelcontextprotocol/servers

**Repo**: https://github.com/modelcontextprotocol/servers
**Action**: Add ToolRoute as a community server under the appropriate section (likely "Community Servers" or "Third-party Servers").

---

## PR Title

Add ToolRoute — community MCP gateway for multi-tool routing

## PR Description

ToolRoute is an MCP-native gateway that aggregates 87+ tools behind a single MCP Streamable HTTP endpoint. Agents connect to one server and get access to tools across 14 categories (search, database, payments, email, browser automation, etc.) without running separate MCP servers for each.

### How it works with MCP

ToolRoute exposes a standard MCP Streamable HTTP endpoint at `POST /mcp`. Clients connect using any MCP-compatible SDK and can call `tools/list` to discover available tools, then `tools/call` to execute them. Authentication is via API key in the Authorization header.

This is different from a typical MCP server that wraps one service — ToolRoute wraps many services behind one MCP interface, handling credential management and billing internally.

### Entry

```markdown
- [ToolRoute](https://toolroute.ai) - MCP gateway that provides access to 87+ tools through a single MCP Streamable HTTP endpoint. Handles multi-tool routing, authentication, and usage-based billing. Supports REST, A2A, and OpenAI function calling in addition to MCP.
```

### Links

- **MCP endpoint**: `POST https://toolroute.ai/mcp`
- **Tool catalog (no auth)**: `GET https://toolroute.ai/api/v1/tools`
- **Documentation**: https://toolroute.ai/docs
- **Blog — What Is an MCP Gateway?**: https://toolroute.ai/blog/what-is-an-mcp-gateway
