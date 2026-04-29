import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// Lane 4.48 — every API route that reads an auth header / cookie / API
// key MUST emit Cache-Control: private, no-store on its responses.
//
// Why: Next.js dynamic routes default to `Cache-Control: public,
// max-age=0, must-revalidate`. `public` lets ANY downstream proxy
// (Cloudflare, corporate, ISP) cache the response keyed by URL. For an
// auth-gated route like `/api/v1/keys` (same URL for every user, content
// keyed by Authorization/cookie), a misconfigured proxy could serve user
// A's payload to user B. Vercel itself doesn't cache, but the moment any
// downstream layer is added, a cross-user data leak surface opens.
//
// Detection rule: file in src/app/** references `validateRequest`,
// `validateAdmin`, `getSession`, `auth.getUser`, or `cookies()` -> route
// is auth-gated -> must use `AUTHED_RESPONSE_HEADERS` (or include
// `private` + `no-store` cache-control somewhere in the file).
//
// Allowlist: pure anon catalog routes (e.g. /api/v1/tools,
// /api/v1/health) intentionally use plain CORS_HEADERS.
//
// Lane 4.119 — scope broadened from src/app/api/ to src/app/** to cover
// non-/api route handlers (mcp, auth/callback). Pre-extension audit
// found and fixed gaps on src/app/mcp/route.ts (added MCP_AUTHED_HEADERS
// with private,no-store) and src/app/auth/callback/route.ts (wrapped all
// redirects in withNoStore() helper). Sibling to Lane 4.116/4.117/4.118.

const APP_ROOT = join(process.cwd(), "src", "app");

const AUTH_HINTS = [
  /\bvalidateRequest\b/,
  /\bvalidateAdmin\b/,
  /\bauth\.getUser\b/,
  /\bgetSession\b/,
  /\bcookies\(\s*\)/,
  /\bgateway_users\b/,
];

const REQUIRED_HEADERS = [
  /\bAUTHED_RESPONSE_HEADERS\b/,
  /\bNO_STORE_HEADERS\b/,
  /['"]Cache-Control['"]\s*:\s*['"][^'"]*\bprivate\b[^'"]*\bno-store\b/,
  /['"]Cache-Control['"]\s*:\s*['"][^'"]*\bno-store\b[^'"]*\bprivate\b/,
  // Lane 4.119 — also accept Headers.set(...) form used by auth/callback
  // wrapping NextResponse.redirect (object-literal syntax doesn't apply
  // to redirect responses; .headers.set() is the idiomatic way).
  /\.set\s*\(\s*['"]Cache-Control['"][\s,]+['"][^'"]*\bprivate\b[^'"]*\bno-store\b/,
  /\.set\s*\(\s*['"]Cache-Control['"][\s,]+['"][^'"]*\bno-store\b[^'"]*\bprivate\b/,
];

// Routes that intentionally don't need auth headers (pure anon).
const AUTH_FREE_ALLOWLIST = new Set(
  [
    "src/app/api/v1/tools/route.ts",
    "src/app/api/v1/health/route.ts",
    "src/app/api/tools/route.ts",
    "src/app/api/check/route.ts",
    "src/app/api/search/route.ts",
    // Stripe webhook — no auth header, signature verify only. Response
    // body is just `{received:true}`, no user data, defense-in-depth not
    // required (and Stripe ignores cache headers on webhook responses).
    "src/app/api/webhooks/stripe/route.ts",
  ].map((p) => p.replace(/\//g, "\\"))
);

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      walk(path, out);
    } else if (name === "route.ts" || name === "route.tsx") {
      out.push(path);
    }
  }
  return out;
}

describe("Cache-Control private,no-store on authed routes (Lane 4.48 + 4.119 — src/app/**)", () => {
  it("every route that reads an auth credential emits Cache-Control: private, no-store", () => {
    const violations: { file: string; reason: string }[] = [];
    for (const file of walk(APP_ROOT)) {
      const content = readFileSync(file, "utf8");
      const isAuthed = AUTH_HINTS.some((re) => re.test(content));
      if (!isAuthed) continue;
      const hasHeader = REQUIRED_HEADERS.some((re) => re.test(content));
      if (hasHeader) continue;
      const rel = relative(process.cwd(), file);
      const normalized = rel.replace(/\\/g, "\\");
      if (AUTH_FREE_ALLOWLIST.has(normalized)) continue;
      violations.push({
        file: rel,
        reason:
          "Auth-gated route emits no `private, no-store` cache header — " +
          "downstream proxies (Cloudflare, corporate, ISP) may cache user-" +
          "specific response keyed by URL alone, leaking user A's data to " +
          "user B",
      });
    }
    expect(
      violations,
      `\nLEAK: ${violations.length} auth-gated route(s) without no-store cache header.\n\n` +
        `Fix:\n` +
        `  import { AUTHED_RESPONSE_HEADERS } from "@/lib/gateway";\n` +
        `  return NextResponse.json(\n` +
        `    { ... },\n` +
        `    { status: 200, headers: AUTHED_RESPONSE_HEADERS }\n` +
        `  );\n\n` +
        `Violations:\n` +
        violations
          .map((v) => `  - ${v.file}\n      ${v.reason}`)
          .join("\n")
    ).toEqual([]);
  });
});
