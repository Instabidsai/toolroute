import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

const REQUIRED_GUARD_ROUTES = [
  // Lane 4.37 — high-risk gateway routes (256 KB)
  { path: "src/app/api/v1/execute/route.ts", limitKey: "execute" },
  { path: "src/app/mcp/route.ts", limitKey: "mcp" },
  { path: "src/app/api/a2a/route.ts", limitKey: "a2a" },
  // Lane 4.38 — session-authed + admin + webhook (4-64 KB)
  { path: "src/app/api/v1/byok/route.ts", limitKey: "byok" },
  { path: "src/app/api/v1/keys/route.ts", limitKey: "keys" },
  { path: "src/app/api/v1/signup/route.ts", limitKey: "signup" },
  { path: "src/app/api/v1/checkout/route.ts", limitKey: "checkout" },
  { path: "src/app/api/v1/settings/route.ts", limitKey: "settings" },
  { path: "src/app/api/admin/providers/route.ts", limitKey: "admin_providers" },
  { path: "src/app/api/v1/registry/usage/route.ts", limitKey: "registry" },
  { path: "src/app/api/v1/registry/request/route.ts", limitKey: "registry" },
  { path: "src/app/api/v1/registry/challenge/route.ts", limitKey: "registry" },
  { path: "src/app/api/check/route.ts", limitKey: "check" },
  { path: "src/app/api/webhooks/stripe/route.ts", limitKey: "stripe_webhook" },
];

describe("body size DoS guard (Lane 4.37 + 4.38)", () => {
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
    const uniqueKeys = new Set(REQUIRED_GUARD_ROUTES.map((r) => r.limitKey));
    for (const limitKey of uniqueKeys) {
      expect(src, `BODY_LIMITS missing key "${limitKey}"`).toMatch(
        new RegExp(`${limitKey}\\s*:\\s*\\d`)
      );
    }
  });

  for (const { path, limitKey } of REQUIRED_GUARD_ROUTES) {
    it(`${path} calls assertBodyUnder(request, BODY_LIMITS.${limitKey}) before each body parse`, () => {
      const src = readFileSync(resolve(root, path), "utf8");

      const guardRe = new RegExp(
        `assertBodyUnder\\s*\\(\\s*request\\s*,\\s*BODY_LIMITS\\.${limitKey}\\s*\\)`,
        "g"
      );
      const guardMatches = [...src.matchAll(guardRe)];
      expect(
        guardMatches.length > 0,
        `${path} must call assertBodyUnder(request, BODY_LIMITS.${limitKey}) at least once`
      ).toBe(true);

      // Each `await request.json()|text()|formData()` call requires its own
      // guard upstream. Count parses, require >= that many guards. This is a
      // conservative check that prevents drift if a new handler is added that
      // also parses a body without guarding it.
      const parseRe = /await\s+request\.(?:json|text|formData)\s*\(/g;
      const parseMatches = [...src.matchAll(parseRe)];
      expect(
        parseMatches.length > 0,
        `${path}: expected at least one body-parse call to guard`
      ).toBe(true);

      expect(
        guardMatches.length >= parseMatches.length,
        `${path}: ${guardMatches.length} guard call(s) is fewer than ${parseMatches.length} body-parse call(s) — every parse needs an upstream guard`
      ).toBe(true);

      // Order check: first guard must precede first parse.
      expect(
        guardMatches[0].index! < parseMatches[0].index!,
        `${path}: first guard at idx ${guardMatches[0].index} must come before first body-parse at idx ${parseMatches[0].index}`
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
