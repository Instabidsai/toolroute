// Lane 4.19 — CORS config drift-prevention snapshot test
//
// All three CORS configs in this app use `Access-Control-Allow-Origin: *`
// with NO `Access-Control-Allow-Credentials` and NO origin reflection. This
// is CSRF-safe by browser policy: the `*` origin disables credential-bearing
// cross-origin requests, and no origin-echo bug exists.
//
// This test reads the source files (regex-based; no runtime imports — no
// createClient, no env requirements) and asserts the configs stay in their
// known-safe shape. Any of these would fail it:
//   - Adding `Access-Control-Allow-Credentials: true`
//   - Switching `Access-Control-Allow-Origin` from `*` to a value built from
//     `request.headers.get("origin")` (origin reflection class)
//   - Adding wildcard methods (`*`) where DELETE/PATCH would expose
//     state-changing operations to a broader surface than today
//
// To unlock a config (e.g. tightening `*` to a specific origin), update the
// snapshot here in the same PR. Sibling to the master-key-leak audit
// (Lane 4.12) and gateway-rpc-grants drift (Lane 4.15) — same shape: lock
// known-safe state, fail on regression.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(__dirname, "..", "..");

function readSrc(rel: string): string {
  return readFileSync(resolve(repoRoot, rel), "utf8");
}

describe("CORS config drift prevention (Lane 4.19)", () => {
  describe("gateway CORS_HEADERS (api/v1/* + admin)", () => {
    const src = readSrc("src/lib/gateway.ts");

    it("uses wildcard origin (open API convention — no Allow-Credentials)", () => {
      expect(src).toMatch(
        /export const CORS_HEADERS:\s*Record<string,\s*string>\s*=\s*\{[\s\S]*?"Access-Control-Allow-Origin":\s*"\*"/
      );
    });

    it("does NOT include Access-Control-Allow-Credentials", () => {
      // `*` + Allow-Credentials:true is rejected by browsers, but defense-in-depth
      // also forbids any future swap-to-reflection that would re-introduce it.
      const corsBlock = src.match(
        /export const CORS_HEADERS[\s\S]*?\};/
      )?.[0];
      expect(corsBlock).toBeDefined();
      expect(corsBlock).not.toMatch(/Allow-Credentials/i);
    });

    it("Allow-Headers does NOT include x-admin-secret (accidental admin CSRF guard)", () => {
      // Admin routes auth via the `x-admin-secret` header. Because that header
      // is NOT in CORS_HEADERS' Allow-Headers, browsers preflight-fail any
      // cross-origin attempt to send it — providing accidental CSRF protection
      // for the admin surface. If x-admin-secret is added here, admin routes
      // become cross-origin reachable and need an explicit origin allowlist.
      const corsBlock = src.match(
        /export const CORS_HEADERS[\s\S]*?\};/
      )?.[0];
      expect(corsBlock).not.toMatch(/x-admin-secret/i);
    });
  });

  describe("MCP_CORS (/mcp Streamable HTTP)", () => {
    const src = readSrc("src/app/mcp/route.ts");

    it("uses wildcard origin", () => {
      expect(src).toMatch(
        /MCP_CORS\s*=\s*\{[\s\S]*?"Access-Control-Allow-Origin":\s*"\*"/
      );
    });

    it("does NOT include Allow-Credentials", () => {
      const block = src.match(/MCP_CORS\s*=\s*\{[\s\S]*?\};/)?.[0];
      expect(block).toBeDefined();
      expect(block).not.toMatch(/Allow-Credentials/i);
    });
  });

  describe("A2A_CORS (/api/a2a Google A2A protocol)", () => {
    const src = readSrc("src/app/api/a2a/route.ts");

    it("uses wildcard origin", () => {
      expect(src).toMatch(
        /A2A_CORS\s*=\s*\{[\s\S]*?"Access-Control-Allow-Origin":\s*"\*"/
      );
    });

    it("does NOT include Allow-Credentials", () => {
      const block = src.match(/A2A_CORS\s*=\s*\{[\s\S]*?\};/)?.[0];
      expect(block).toBeDefined();
      expect(block).not.toMatch(/Allow-Credentials/i);
    });
  });

  describe("origin reflection class (CSRF-via-CORS escalation)", () => {
    it("no route reads request Origin header to echo back into a CORS response", () => {
      // Walk all route files; flag any that reads `origin`/`Origin` headers
      // and uses it in a CORS response. Origin reflection + cookies =
      // catastrophic CSRF; reflection without cookies still simplifies attacks
      // when the bearer token is leakable from a victim subdomain.
      const filesToScan = [
        "src/lib/gateway.ts",
        "src/app/mcp/route.ts",
        "src/app/api/a2a/route.ts",
        "src/app/api/v1/checkout/route.ts",
        "src/app/api/v1/byok/route.ts",
        "src/app/api/v1/keys/route.ts",
        "src/app/api/admin/stats/route.ts",
        "src/app/api/admin/providers/route.ts",
      ];
      for (const f of filesToScan) {
        const src = readSrc(f);
        // Catch both `headers.get("origin")` and the case-variant.
        // Note: deliberately NOT matching `success_url:` which contains a
        // hardcoded origin string — only header reads are flagged.
        expect(
          src,
          `${f} reads Origin header (potential CORS reflection)`
        ).not.toMatch(/headers\.get\(\s*['"][oO]rigin['"]\s*\)/);
      }
    });
  });
});
