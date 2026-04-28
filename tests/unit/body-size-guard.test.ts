import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

const REQUIRED_GUARD_ROUTES = [
  {
    path: "src/app/api/v1/execute/route.ts",
    limitKey: "execute",
  },
  {
    path: "src/app/mcp/route.ts",
    limitKey: "mcp",
  },
  {
    path: "src/app/api/a2a/route.ts",
    limitKey: "a2a",
  },
];

describe("body size DoS guard (Lane 4.37)", () => {
  it("body-limit helper exists and exports BODY_LIMITS map", () => {
    const src = readFileSync(
      resolve(root, "src/lib/body-limit.ts"),
      "utf8"
    );
    expect(src).toMatch(/export\s+function\s+assertBodyUnder/);
    expect(src).toMatch(/export\s+const\s+BODY_LIMITS/);
  });

  it("BODY_LIMITS has every required key", () => {
    const src = readFileSync(
      resolve(root, "src/lib/body-limit.ts"),
      "utf8"
    );
    for (const { limitKey } of REQUIRED_GUARD_ROUTES) {
      expect(src, `BODY_LIMITS missing key "${limitKey}"`).toMatch(
        new RegExp(`${limitKey}\\s*:\\s*\\d`)
      );
    }
  });

  for (const { path, limitKey } of REQUIRED_GUARD_ROUTES) {
    it(`${path} calls assertBodyUnder(request, BODY_LIMITS.${limitKey}) before request.json()`, () => {
      const src = readFileSync(resolve(root, path), "utf8");

      const guardRe = new RegExp(
        `assertBodyUnder\\s*\\(\\s*request\\s*,\\s*BODY_LIMITS\\.${limitKey}\\s*\\)`
      );
      const guardMatch = guardRe.exec(src);
      expect(
        guardMatch,
        `${path} must call assertBodyUnder(request, BODY_LIMITS.${limitKey})`
      ).not.toBeNull();

      const jsonMatch = /await\s+request\.json\s*\(/.exec(src);
      expect(
        jsonMatch,
        `${path} unexpectedly removed request.json()`
      ).not.toBeNull();

      expect(
        guardMatch!.index < jsonMatch!.index,
        `${path}: guard call at idx ${guardMatch!.index} must come before request.json() at idx ${jsonMatch!.index}`
      ).toBe(true);
    });
  }

  it("assertBodyUnder throws 413 GatewayError when Content-Length exceeds limit", async () => {
    const { assertBodyUnder, BODY_LIMITS } = await import(
      "../../src/lib/body-limit"
    );
    const { GatewayError } = await import("../../src/lib/gateway-types");

    const tooBig = new Request("http://localhost/", {
      method: "POST",
      headers: { "content-length": String(BODY_LIMITS.execute + 1) },
      body: "x",
    });

    expect(() => assertBodyUnder(tooBig, BODY_LIMITS.execute)).toThrow(
      GatewayError
    );

    const ok = new Request("http://localhost/", {
      method: "POST",
      headers: { "content-length": String(BODY_LIMITS.execute - 1) },
      body: "x",
    });

    expect(() => assertBodyUnder(ok, BODY_LIMITS.execute)).not.toThrow();
  });

  it("assertBodyUnder is permissive when Content-Length header is missing (Vercel platform cap of 4.5MB still applies)", async () => {
    const { assertBodyUnder, BODY_LIMITS } = await import(
      "../../src/lib/body-limit"
    );
    const noHeader = new Request("http://localhost/", {
      method: "POST",
      body: "x",
    });
    expect(() => assertBodyUnder(noHeader, BODY_LIMITS.execute)).not.toThrow();
  });
});
