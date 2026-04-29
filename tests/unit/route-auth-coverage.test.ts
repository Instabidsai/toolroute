import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Lane 4.33 + 4.116 — Drift-prevention test for route auth coverage.
//
// Lane 4.28 covered admin endpoints. Lane 4.21 covered CSRF/method shape.
// Lane 4.33 originally locked /api routes only; Lane 4.116 broadened scope
// to src/app/**/route.ts since Next.js App Router accepts route handlers
// anywhere under src/app/ — non-/api routes (mcp, auth/callback, llms*.txt)
// are real HTTP endpoints with auth implications and must be classified too.
// Every route file in src/app/**/route.ts must have a known classification,
// and the auth function expected for that class must appear in the source.
//
// Failure modes this catches:
//   1. New route file added without ANY auth check (silently public)
//   2. New route file added with WRONG auth class (e.g. session-only when it
//      should be admin)
//   3. Existing route's auth function deleted/renamed in a refactor
//   4. New file appears that isn't in the expected map (forces reviewer to
//      explicitly classify it)

type AuthClass =
  | "public" // no auth — public-by-design (catalog, health, signup, registry knowledge query)
  | "api_key" // validateRequest() — Bearer tr_live_/tr_test_ key
  | "session" // getUserFromSession() — Supabase session cookie / Bearer JWT
  | "admin" // validateAdmin() — require admin role
  | "dual" // both api_key OR session via internal resolver
  | "stripe_webhook" // stripe.webhooks.constructEvent signature
  | "key_info"; // getKeyInfo() — internal resolver around api-key auth

interface RouteSpec {
  classification: AuthClass;
  // Markers that MUST appear in the route source for that classification to
  // hold. If the classification is "public", we explicitly assert that NONE
  // of the auth markers appear (defense against accidental partial removal).
  rationale: string;
}

// Canonical route auth map. Adding/removing a route requires updating this map
// — that's the gate.
const ROUTE_MAP: Record<string, RouteSpec> = {
  // --- Public-by-design ---
  "src/app/api/check/route.ts": {
    classification: "public",
    rationale: "Registry knowledge query (checkBeforeBuild) — public catalog read.",
  },
  "src/app/api/search/route.ts": {
    classification: "public",
    rationale: "Tool search — public catalog read.",
  },
  "src/app/api/tools/route.ts": {
    classification: "public",
    rationale: "Tool list — public catalog read.",
  },
  "src/app/api/v1/tools/route.ts": {
    classification: "public",
    rationale: "Public tool catalog with format=openai support.",
  },
  "src/app/api/v1/health/route.ts": {
    classification: "public",
    rationale: "Health check — uptime / adapter count, no PII.",
  },
  "src/app/api/v1/signup/route.ts": {
    classification: "public",
    rationale: "Account creation. Rate-limited at app layer; disposable-domain blocklist.",
  },

  // --- API-key auth ---
  "src/app/api/v1/execute/route.ts": {
    classification: "api_key",
    rationale: "Tool execution gateway — Bearer tr_live_/tr_test_ key required.",
  },
  "src/app/api/v1/key/route.ts": {
    classification: "key_info",
    rationale: "Returns balance/key info for the supplied API key — getKeyInfo handles validation.",
  },
  "src/app/api/a2a/route.ts": {
    classification: "api_key",
    rationale: "A2A JSON-RPC gateway — validateRequest on Bearer token.",
  },
  "src/app/api/v1/registry/usage/route.ts": {
    classification: "api_key",
    rationale: "Registry usage submit — validateRequest on Bearer token.",
  },
  "src/app/api/v1/registry/request/route.ts": {
    classification: "api_key",
    rationale: "Registry tool request submit — validateRequest on Bearer token.",
  },
  "src/app/api/v1/registry/challenge/route.ts": {
    classification: "api_key",
    rationale: "Registry champion challenge — validateRequest on Bearer token.",
  },

  // --- Dual (api_key OR session) ---
  "src/app/api/v1/usage/route.ts": {
    classification: "dual",
    rationale: "User can fetch own usage via api-key Bearer OR session JWT — internal resolver picks based on token prefix.",
  },

  // --- Session auth ---
  "src/app/api/v1/byok/route.ts": {
    classification: "session",
    rationale: "BYOK key registration — session-only (security-sensitive credentials).",
  },
  "src/app/api/v1/checkout/route.ts": {
    classification: "session",
    rationale: "Stripe checkout session creation — session-only (anti-CSRF).",
  },
  "src/app/api/v1/billing/setup-payment/route.ts": {
    classification: "session",
    rationale: "Auto-top-up payment-method setup — session-only.",
  },
  "src/app/api/v1/settings/route.ts": {
    classification: "session",
    rationale: "User auto-top-up + plan settings — session-only.",
  },
  "src/app/api/v1/keys/route.ts": {
    classification: "session",
    rationale: "API key CRUD by the owning user — session-only.",
  },

  // --- Admin auth ---
  "src/app/api/admin/providers/route.ts": {
    classification: "admin",
    rationale: "Master pool provider keys — admin-only.",
  },
  "src/app/api/admin/stats/route.ts": {
    classification: "admin",
    rationale: "Admin stats dashboard — admin-only.",
  },

  // --- Stripe webhook (signature-based) ---
  "src/app/api/webhooks/stripe/route.ts": {
    classification: "stripe_webhook",
    rationale: "Stripe webhook — signature verification via stripe.webhooks.constructEvent.",
  },

  // --- Lane 4.116 — non-/api routes (live under src/app/<path>/route.ts) ---
  "src/app/mcp/route.ts": {
    classification: "api_key",
    rationale: "MCP Streamable HTTP gateway — requires Bearer tr_live_ for tools/call. validateRequest gate at line 139.",
  },
  "src/app/auth/callback/route.ts": {
    classification: "public",
    rationale: "Supabase OAuth callback. Establishes session via createServerClient. Input gate is the Supabase ?code= param, not validateRequest/getUserFromSession/etc.",
  },
  "src/app/llms.txt/route.ts": {
    classification: "public",
    rationale: "Public AI-agent discovery file (toolroute.ai/llms.txt). Static text serve.",
  },
  "src/app/llms-full.txt/route.ts": {
    classification: "public",
    rationale: "Public AI-agent discovery file (toolroute.ai/llms-full.txt). Static text serve.",
  },
};

const AUTH_MARKERS: Record<AuthClass, RegExp[]> = {
  public: [], // no markers required
  api_key: [/\bvalidateRequest\s*\(/],
  session: [/\bgetUserFromSession\s*\(/],
  admin: [/\bvalidateAdmin\s*\(/],
  dual: [/\bvalidateRequest\s*\(/, /\bgetUserFromSession\s*\(/],
  stripe_webhook: [/stripe\.webhooks\.constructEvent\s*\(/],
  key_info: [/\bgetKeyInfo\s*\(/],
};

// For "public" classification we ASSERT NEGATIVE: no auth marker is present.
// (If a public route accidentally gains an auth check, that's worth surfacing.)
const ALL_AUTH_MARKERS: RegExp[] = [
  /\bvalidateRequest\s*\(/,
  /\bgetUserFromSession\s*\(/,
  /\bvalidateAdmin\s*\(/,
  /\bgetKeyInfo\s*\(/,
  /stripe\.webhooks\.constructEvent\s*\(/,
];

function walkRoutes(): string[] {
  // Lane 4.116 — scan all of src/app/, not just src/app/api/. Non-/api
  // routes (mcp, auth/callback, llms*.txt) are still real HTTP endpoints
  // with auth implications and must be classified by ROUTE_MAP.
  const appRoot = path.join(process.cwd(), "src", "app");
  const out: string[] = [];
  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name === "route.ts") {
        out.push(path.relative(process.cwd(), full).replace(/\\/g, "/"));
      }
    }
  }
  walk(appRoot);
  return out;
}

describe("Lane 4.33 + 4.116 — route auth coverage (src/app/**/route.ts)", () => {
  const routes = walkRoutes();

  it("every route on disk has a classification in ROUTE_MAP", () => {
    const missing = routes.filter((r) => !(r in ROUTE_MAP));
    if (missing.length) {
      throw new Error(
        `\n${missing.length} route file(s) lack an auth classification:\n${missing.map((r) => `  ${r}`).join("\n")}\n\nAdd each to ROUTE_MAP in this test file with one of: public | api_key | session | admin | dual | stripe_webhook | key_info\n`
      );
    }
  });

  it("every route in ROUTE_MAP exists on disk (catches deleted/renamed routes)", () => {
    const declared = Object.keys(ROUTE_MAP);
    const missing = declared.filter((r) => !routes.includes(r));
    expect(missing, `ROUTE_MAP references files that don't exist: ${missing.join(", ")}`).toHaveLength(0);
  });

  for (const route of Object.keys(ROUTE_MAP)) {
    const spec = ROUTE_MAP[route];
    it(`${route} — class=${spec.classification}`, () => {
      const full = path.join(process.cwd(), route);
      if (!fs.existsSync(full)) return; // covered by previous test
      const src = fs.readFileSync(full, "utf8");

      if (spec.classification === "public") {
        // Public routes must NOT contain any auth marker.
        for (const m of ALL_AUTH_MARKERS) {
          expect(
            m.test(src),
            `${route} is classified public but contains auth marker ${m}. Either remove the marker or reclassify.`
          ).toBe(false);
        }
      } else {
        // Authed route must contain ALL markers for its class.
        const markers = AUTH_MARKERS[spec.classification];
        for (const m of markers) {
          expect(
            m.test(src),
            `${route} class=${spec.classification} missing required auth marker: ${m}`
          ).toBe(true);
        }
      }
    });
  }
});
