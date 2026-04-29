import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Lane 4.56 — body-size guard coverage drift guard.
//
// src/lib/body-limit.ts defines BODY_LIMITS for 12 routes:
//   execute, mcp, a2a, byok, keys, signup, checkout, settings,
//   admin_providers, registry, check, stripe_webhook
//
// But only 3 routes (execute, mcp, a2a) actually call assertBodyUnder().
// Every other route that parses request bodies (request.json() or
// request.text()) is unbounded — DoS vector by sending a 100MB body.
//
// This test source-walks src/app — finds every route.ts that reads a
// request body and asserts it imports + calls assertBodyUnder. Failures
// list the routes that need the guard added.
//
// Gated behind BODY_LIMIT_BASELINE=skip env var so CI stays green
// while sibling lanes ship — matches MARKETING_DRIFT_BASELINE +
// DASHBOARD_TIER_DRIFT_BASELINE pattern.

const SHOULD_RUN = process.env.BODY_LIMIT_BASELINE !== "skip";

const APP_API_ROOT = resolve(process.cwd(), "src/app");

// Routes that legitimately do NOT need the guard (no body parsing, or
// non-JSON bodies that have explicit other guards). Add with reason.
const GUARD_NOT_REQUIRED = new Set<string>([
  // none currently
]);

function* walkRouteFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      yield* walkRouteFiles(full);
    } else if (entry === "route.ts" || entry === "route.tsx") {
      yield full;
    }
  }
}

function relPath(full: string): string {
  return full.slice(APP_API_ROOT.length + 1).replace(/\\/g, "/");
}

interface RouteAudit {
  rel: string;
  parsesBody: boolean;
  hasGuard: boolean;
}

function auditRoute(full: string): RouteAudit {
  const body = readFileSync(full, "utf-8");
  const parsesBody =
    /await\s+request\.json\s*\(\s*\)/.test(body) ||
    /await\s+request\.text\s*\(\s*\)/.test(body) ||
    /await\s+req\.json\s*\(\s*\)/.test(body);
  const hasGuard = /assertBodyUnder\s*\(/.test(body);
  return { rel: relPath(full), parsesBody, hasGuard };
}

describe.skipIf(!SHOULD_RUN)(
  "Lane 4.56 — body-size guard coverage on body-parsing routes",
  () => {
    const routes = [...walkRouteFiles(APP_API_ROOT)].map(auditRoute);
    const bodyParsingRoutes = routes.filter((r) => r.parsesBody);

    it("at least 10 routes parse request bodies", () => {
      // Sanity: tree exists and we found a meaningful set.
      expect(bodyParsingRoutes.length).toBeGreaterThanOrEqual(10);
    });

    it("every body-parsing route calls assertBodyUnder before parsing", () => {
      const offenders = bodyParsingRoutes
        .filter((r) => !r.hasGuard && !GUARD_NOT_REQUIRED.has(r.rel))
        .map((r) => r.rel);

      // Hard Rule #59 — failure list IS the fix list. Each route below
      // must add `assertBodyUnder(request, BODY_LIMITS.<key>)` before
      // request.json()/request.text(). Pick the matching key from
      // BODY_LIMITS in src/lib/body-limit.ts (which already has 12
      // route-keyed limits defined).
      expect(offenders).toEqual([]);
    });

    it("BODY_LIMITS in src/lib/body-limit.ts defines limits for 12 routes", () => {
      const src = readFileSync(
        resolve(process.cwd(), "src/lib/body-limit.ts"),
        "utf-8"
      );
      const block = src.match(/BODY_LIMITS\s*=\s*\{([\s\S]*?)\}\s*as\s+const/);
      expect(block).toBeTruthy();
      const keys = (block?.[1] ?? "").match(/^\s*([a-z0-9_]+)\s*:/gm) ?? [];
      // Floor: don't shrink coverage. Adding new routes raises this number.
      expect(keys.length).toBeGreaterThanOrEqual(12);
    });
  }
);
