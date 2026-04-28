import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

/**
 * Lane 4.21 drift-prevention: ToolRoute is CSRF-immune because session auth
 * goes through `Authorization: Bearer <jwt>`, never cookies. Browsers don't
 * auto-send Authorization on cross-origin requests, and CORS_HEADERS doesn't
 * allow credentialed XHR (Lane 4.19) — so cross-origin browser contexts can't
 * authenticate to mutation routes.
 *
 * This test fails master if anyone introduces cookie auth into `src/app/api/v1`,
 * which would invalidate the CSRF-immunity proof and require a CSRF token
 * system before merging.
 *
 * Per Hard Rule #59 — failing-snapshot test as drift TODO list.
 */

const API_V1 = resolve(__dirname, "../../src/app/api/v1");
const GATEWAY = resolve(__dirname, "../../src/lib/gateway.ts");

function walkRoutes(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walkRoutes(full, acc);
    } else if (entry === "route.ts") {
      acc.push(full);
    }
  }
  return acc;
}

const ROUTES = walkRoutes(API_V1);

const SESSION_AUTHED_ROUTES = [
  "src/app/api/v1/keys/route.ts",
  "src/app/api/v1/byok/route.ts",
  "src/app/api/v1/checkout/route.ts",
  "src/app/api/v1/settings/route.ts",
  "src/app/api/v1/billing/setup-payment/route.ts",
  "src/app/api/v1/usage/route.ts",
];

describe("CSRF: Authorization Bearer only, no cookie auth", () => {
  it("no /api/v1/ route imports cookies from next/headers", () => {
    const offenders: string[] = [];
    for (const path of ROUTES) {
      const src = readFileSync(path, "utf8");
      if (/from\s+["']next\/headers["']/.test(src) && /\bcookies\b/.test(src)) {
        offenders.push(path);
      }
    }
    expect(
      offenders,
      `Cookie auth introduced — invalidates CSRF-immunity proof. CSRF tokens must be added BEFORE merging:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("no /api/v1/ route calls cookies() or reads cookieStore", () => {
    const offenders: string[] = [];
    for (const path of ROUTES) {
      const src = readFileSync(path, "utf8");
      if (/\bcookies\(\s*\)|\bcookieStore\b/.test(src)) {
        offenders.push(path);
      }
    }
    expect(offenders, `cookies() / cookieStore use found:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("session-authed routes read auth from Authorization header", () => {
    for (const rel of SESSION_AUTHED_ROUTES) {
      const path = resolve(__dirname, "../..", rel);
      const src = readFileSync(path, "utf8");
      expect(src, `${rel} missing authorization header read`).toMatch(
        /request\.headers\.get\(\s*["']authorization["']\s*\)/,
      );
    }
  });

  it("getUserFromSession still requires Bearer prefix", () => {
    const src = readFileSync(GATEWAY, "utf8");
    expect(src).toMatch(/getUserFromSession/);
    // Find the function and assert it checks for the Bearer prefix.
    const fnMatch = src.match(/export async function getUserFromSession[\s\S]*?\n\}/);
    expect(fnMatch, "getUserFromSession not found in gateway.ts").toBeTruthy();
    expect(fnMatch![0]).toMatch(/startsWith\(\s*["']Bearer\s*["']\s*\)/);
  });
});
