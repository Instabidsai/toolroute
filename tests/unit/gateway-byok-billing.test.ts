import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const GATEWAY_PATH = resolve(process.cwd(), "src/lib/gateway.ts");

describe("gateway BYOK billing and secret handling", () => {
  const source = readFileSync(GATEWAY_PATH, "utf8");

  it("decrypts stored BYOK provider keys before adapter dispatch", () => {
    expect(source).toMatch(/decryptSecret\(byokRow\.api_key_encrypted\)/);
    expect(source).toMatch(/decryptSecret\(targetByokRow\.api_key_encrypted\)/);
  });

  it("bills BYOK calls a ToolRoute platform fee instead of upstream provider COGS", () => {
    expect(source).toMatch(/TOOLROUTE_BYOK_PLATFORM_FEE/);
    expect(source).toMatch(/estimatedUserCost\s*=[\s\S]*keySource === "byok"/);
    expect(source).toMatch(/finalCost\s*=[\s\S]*keySource === "byok"/);
  });
});
