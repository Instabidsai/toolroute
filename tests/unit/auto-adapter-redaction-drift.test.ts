import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Source-file drift guard only. Do not import auto-adapter here; adapter
// imports initialize clients at module load and require production env.
const AUTO_ADAPTER_TS = resolve(process.cwd(), "src/lib/adapters/auto-adapter.ts");

function readAutoAdapter(): string {
  return readFileSync(AUTO_ADAPTER_TS, "utf8");
}

describe("auto-adapter redaction drift guard", () => {
  it("redacts thrown execution errors before returning auto-route fallback metadata", () => {
    const src = readAutoAdapter();

    expect(src).toMatch(
      /import\s+\{\s*redactCreds\s*\}\s+from\s+["'][^"']*redact-creds["']/
    );
    expect(src).toMatch(/const\s+execMessage\s*=\s*redactCreds\s*\(/);
    expect(src).toMatch(/const\s+message\s*=\s*redactCreds\s*\(/);
    expect(src).not.toMatch(
      /const\s+execMessage\s*=\s*(?:execErr\s+instanceof\s+Error[\s\S]{0,120}String\s*\(\s*execErr\s*\))/
    );
  });
});
