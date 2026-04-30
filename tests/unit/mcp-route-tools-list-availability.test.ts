import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROUTE_PATH = resolve(process.cwd(), "src/app/mcp/route.ts");

describe("MCP tools/list availability guard", () => {
  const source = readFileSync(ROUTE_PATH, "utf8");

  it("filters JSON-RPC tools/list through executable adapter availability", () => {
    expect(source).toMatch(
      /import\s+\{\s*listAvailableAdapters\s*\}\s+from\s+["']@\/lib\/adapter-availability["']/
    );
    expect(source).toMatch(
      /case\s+["']tools\/list["'][\s\S]*?const\s+adapters\s*=\s*listAvailableAdapters\(\s*listAdapters\(\)\s*\)/
    );
  });
});
