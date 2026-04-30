import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

// Lane 4.30 — drift-prevention test for IDOR shape on session-authed mutation routes.
// Sibling to Lane 4.21 (CSRF) and Lane 4.22 (mass-assignment).
// Asserts shape; does not import route modules (which would require prod env per Hard Rule #59).

const API_V1_DIR = join(process.cwd(), "src/app/api/v1");

// Routes that are NOT session-authed (api-key auth, public, or webhooks) — exempt from this audit
const NON_SESSION_ROUTES = new Set([
  "execute",      // api-key auth
  "tools",        // public
  "health",       // public
  "signup",       // public (creates the session)
  "registry",     // public registry endpoints
  "key",          // api-key auth (returns key info)
]);

function findRouteFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...findRouteFiles(full));
    } else if (entry === "route.ts") {
      files.push(full);
    }
  }
  return files;
}

function isSessionAuthedRoute(filePath: string): boolean {
  // Strip prefix and check first path segment
  const rel = filePath.replace(API_V1_DIR, "").replace(/\\/g, "/");
  const firstSeg = rel.split("/").filter(Boolean)[0];
  return !NON_SESSION_ROUTES.has(firstSeg);
}

// Per-handler block extraction (memory rule #65)
function extractHandlerBlocks(src: string): Array<{ method: string; body: string }> {
  const out: Array<{ method: string; body: string }> = [];
  const headerPat = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s*\(/g;
  let m;
  while ((m = headerPat.exec(src)) !== null) {
    const method = m[1];
    const openParenIdx = src.indexOf("(", m.index);
    let depth = 1;
    let i = openParenIdx + 1;
    while (i < src.length && depth > 0) {
      if (src[i] === "(") depth++;
      else if (src[i] === ")") depth--;
      i++;
    }
    const openBraceIdx = src.indexOf("{", i);
    const after = src.slice(openBraceIdx + 1);
    const closeRel = after.search(/^\}/m);
    out.push({ method, body: after.slice(0, closeRel) });
  }
  return out;
}

describe("Lane 4.30 — IDOR shape across session-authed mutation routes", () => {
  const allRouteFiles = findRouteFiles(API_V1_DIR);
  const sessionRouteFiles = allRouteFiles.filter(isSessionAuthedRoute);

  it("F-1: discovers session-authed route files", () => {
    expect(sessionRouteFiles.length).toBeGreaterThanOrEqual(5);
  });

  it("F-2: NO route reads user_id from request body", () => {
    const violations: string[] = [];
    for (const file of allRouteFiles) {
      const src = readFileSync(file, "utf8");
      if (/body\.user_id\b/.test(src)) violations.push(`${file}: body.user_id`);
      if (/body\[["']user_id["']\]/.test(src)) violations.push(`${file}: body["user_id"]`);
    }
    expect(violations, `IDOR-vulnerable: ${violations.join(", ")}`).toEqual([]);
  });

  it("F-3: NO route reads user_id from query params and uses it as ownership filter", () => {
    const violations: string[] = [];
    for (const file of allRouteFiles) {
      const src = readFileSync(file, "utf8");
      if (/searchParams\.get\(["']user_id["']\)/.test(src)) {
        violations.push(`${file}: searchParams.get("user_id")`);
      }
    }
    expect(violations, `IDOR-vulnerable: ${violations.join(", ")}`).toEqual([]);
  });

  it("F-4: every session/account-authed mutation handler resolves the owner server-side", () => {
    const violations: string[] = [];
    for (const file of sessionRouteFiles) {
      const src = readFileSync(file, "utf8");
      const handlers = extractHandlerBlocks(src);
      for (const h of handlers) {
        if (h.method === "OPTIONS" || h.method === "GET") continue;
        if (!/await\s+(getUserFromSession|getAccountActor)\s*\(/.test(h.body)) {
          violations.push(`${file}: ${h.method} missing server-side owner resolver`);
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("F-5: every UPDATE/DELETE on api_keys/user_provider_keys/gateway_users filters by user_id (or by id when id IS userId)", () => {
    const violations: string[] = [];
    for (const file of sessionRouteFiles) {
      const src = readFileSync(file, "utf8");
      const handlers = extractHandlerBlocks(src);
      for (const h of handlers) {
        if (h.method !== "PATCH" && h.method !== "DELETE") continue;
        if (!/\.from\s*\(\s*["'](api_keys|user_provider_keys|gateway_users)["']\s*\)/.test(h.body)) continue;
        if (!/\.(update|delete)\s*\(/.test(h.body)) continue;

        // Must filter by either user_id OR (id when this IS the user row in gateway_users)
        const filtersByUserId = /\.eq\s*\(\s*["']user_id["']\s*,\s*userId\s*\)/.test(h.body);
        const filtersByIdAsUserId =
          /\.from\s*\(\s*["']gateway_users["']\s*\)/.test(h.body) &&
          /\.eq\s*\(\s*["']id["']\s*,\s*userId\s*\)/.test(h.body);

        if (!filtersByUserId && !filtersByIdAsUserId) {
          violations.push(`${file}: ${h.method} writes to user-scoped table without user_id filter`);
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("F-6: getUserFromSession source-of-truth lives in src/lib/gateway.ts only", () => {
    const gatewaySrc = readFileSync(
      join(process.cwd(), "src/lib/gateway.ts"),
      "utf8"
    );
    expect(gatewaySrc).toMatch(/export\s+async\s+function\s+getUserFromSession/);

    // Any other definition would be a fork — fail
    const otherDefs: string[] = [];
    for (const file of allRouteFiles) {
      const src = readFileSync(file, "utf8");
      if (/(?:export\s+)?(?:async\s+)?function\s+getUserFromSession/.test(src)) {
        otherDefs.push(file);
      }
    }
    expect(otherDefs, `Forked getUserFromSession: ${otherDefs.join(", ")}`).toEqual([]);
  });
});
