import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MCP_INDEX = resolve(process.cwd(), "mcp-server/index.js");

describe("mcp-server Supabase error.message leak (Lane 4.43)", () => {
  it("does not return raw Supabase error.message to MCP clients", () => {
    const source = readFileSync(MCP_INDEX, "utf8");
    const offenders: string[] = [];
    const lines = source.split(/\r?\n/);
    lines.forEach((line, i) => {
      if (/text:\s*`Error:\s*\$\{error\.message\}/.test(line)) {
        offenders.push(`mcp-server/index.js:${i + 1}`);
      }
    });
    expect(
      offenders,
      `Raw Supabase error.message returned to MCP client:\n${offenders.join("\n")}\n\n` +
        "Pattern: log error to stderr, return generic message.\n" +
        '  if (error) {\n' +
        '    console.error("mcp:<tool> RPC error:", error.message);\n' +
        '    return { content: [{ type: "text", text: "Error: <tool> failed" }] };\n' +
        '  }'
    ).toEqual([]);
  });

  it("logs each Supabase RPC error to stderr before returning generic message", () => {
    const source = readFileSync(MCP_INDEX, "utf8");
    const rpcCount = (source.match(/await supabase\.rpc\(/g) ?? []).length;
    const consoleErrorCount = (source.match(/console\.error\(\s*"mcp:/g) ?? [])
      .length;
    expect(
      consoleErrorCount,
      `mcp-server has ${rpcCount} supabase.rpc() calls but only ${consoleErrorCount} console.error("mcp:...") log lines. ` +
        "Every RPC error path should log raw error to stderr for ops while returning a generic message to the client."
    ).toBeGreaterThanOrEqual(rpcCount);
  });
});
