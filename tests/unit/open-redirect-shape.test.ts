import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const API_V1_ROOT = join(process.cwd(), "src", "app", "api", "v1");

function listRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...listRouteFiles(p));
    else if (entry === "route.ts") out.push(p);
  }
  return out;
}

// Lane 4.24 — open-redirect drift prevention.
//
// Any URL passed to Stripe redirect_to / Supabase auth.admin.generateLink /
// success_url / cancel_url MUST be built from a hardcoded production origin
// or env var, NOT from request-derived host data. Trusting request.url for
// these flows lets a Vercel preview URL or attacker-pointed CNAME
// generate verify/checkout URLs that redirect to a host they control.

describe("Lane 4.24 — open-redirect shape (drift prevention)", () => {
  const routes = listRouteFiles(API_V1_ROOT);

  it("no v1 route uses request.url to construct success_url / cancel_url / redirectTo", () => {
    const violations: string[] = [];
    for (const file of routes) {
      const src = readFileSync(file, "utf8");

      // Pattern A: `new URL(request.url).origin` followed within the same
      // file by an auth/redirect call site (success_url, cancel_url,
      // redirectTo, options.redirectTo, or auth.admin.generateLink).
      const usesRequestOrigin =
        /new\s+URL\s*\(\s*request\.url\s*\)\s*\.\s*origin/.test(src);
      const hasRedirectSink =
        /(success_url|cancel_url|redirectTo|generateLink|emailRedirectTo)/.test(
          src
        );

      if (usesRequestOrigin && hasRedirectSink) {
        violations.push(
          `${file}: uses new URL(request.url).origin AND has redirect sink (success_url|cancel_url|redirectTo|generateLink|emailRedirectTo)`
        );
      }

      // Pattern B: request.headers.get("host") — never trust this for
      // outbound URL construction either.
      if (
        /request\.headers\.get\s*\(\s*["']host["']\s*\)/.test(src) &&
        hasRedirectSink
      ) {
        violations.push(
          `${file}: uses request.headers.get("host") AND has redirect sink`
        );
      }

      // Pattern C: x-forwarded-host trust (proxy spoofable)
      if (
        /request\.headers\.get\s*\(\s*["']x-forwarded-host["']\s*\)/.test(
          src
        ) &&
        hasRedirectSink
      ) {
        violations.push(
          `${file}: uses request.headers.get("x-forwarded-host") AND has redirect sink`
        );
      }
    }
    expect(
      violations,
      `Open-redirect risk:\n${violations.join("\n")}`
    ).toEqual([]);
  });

  it("checkout success_url and cancel_url are anchored to a hardcoded origin", () => {
    const src = readFileSync(
      join(API_V1_ROOT, "checkout", "route.ts"),
      "utf8"
    );
    // The anchor variable used to build success_url/cancel_url must be
    // defined as a string literal — a hardcoded production URL.
    const hardcoded = src.match(
      /const\s+origin\s*=\s*"https:\/\/toolroute\.ai"/
    );
    expect(
      hardcoded,
      "checkout/route.ts must hardcode `const origin = \"https://toolroute.ai\"` per Lane 4.24"
    ).not.toBeNull();
    expect(src).toMatch(/success_url:\s*`\$\{origin\}/);
    expect(src).toMatch(/cancel_url:\s*`\$\{origin\}/);
  });

  it("setup-payment success_url and cancel_url are anchored to CHECKOUT_ORIGIN constant", () => {
    const src = readFileSync(
      join(API_V1_ROOT, "billing", "setup-payment", "route.ts"),
      "utf8"
    );
    expect(src).toMatch(
      /const\s+CHECKOUT_ORIGIN\s*=\s*"https:\/\/toolroute\.ai"/
    );
    expect(src).toMatch(/success_url:\s*`\$\{CHECKOUT_ORIGIN\}/);
    expect(src).toMatch(/cancel_url:\s*`\$\{CHECKOUT_ORIGIN\}/);
  });

  it("signup verify URL is anchored to VERIFY_ORIGIN constant (Lane 4.24 patch)", () => {
    const src = readFileSync(
      join(API_V1_ROOT, "signup", "route.ts"),
      "utf8"
    );
    expect(src).toMatch(
      /const\s+VERIFY_ORIGIN\s*=\s*"https:\/\/toolroute\.ai"/
    );
    // The auth.admin.generateLink must be passed a redirectTo built from
    // VERIFY_ORIGIN, not request-derived data.
    expect(src).not.toMatch(/new\s+URL\s*\(\s*request\.url\s*\)\s*\.\s*origin/);
  });
});
