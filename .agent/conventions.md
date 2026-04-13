# ToolRoute Conventions

- Two-tier confidence: 0.85 (tested by us) vs 0.6 (community only)
- Beliefs evolve from usage — record_usage() auto-updates confidence
- Challenger protocol: 8-dimension scoring, must win 5 to dethrone champion
- 50 curated tools max — quality gate, not quantity
- MCP server at mcp-server/index.js, 7 tools, registered on hub port 18925
