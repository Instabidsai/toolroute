import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.131 — drift guard: gateway RPC callsites file-allow-listed.
//
// The column-family lanes (4.121-4.130) cover the PostgREST surface
// (`.from("table").update/insert/delete`). They DON'T cover RPC-callable
// writes — `add_credits`, `deduct_credits`, `validate_api_key`,
// `log_gateway_request`, `check_rate_limit`. Those RPCs are SECURITY
// DEFINER + parameterized at the DB layer (Lane 4.92, 4.93, 4.94, 4.97),
// but the caller list is its own drift surface.
//
// Drift this lane closes:
//
//   1. add_credits — direct fraud surface. A new file (admin endpoint, UI
//      mutation route, even a "promo code" endpoint) that calls
//      add_credits without idempotency on stripe_payment_id is mint-class
//      RCE. Today only:
//        gateway.ts:207                        (auto-top-up after successful PaymentIntent)
//        webhooks/stripe/route.ts:142,202,245,281 (purchase, plan grant, renewal, auto_topup webhook)
//
//   2. deduct_credits — double-charge or unauthenticated-charge surface.
//      Today only:
//        gateway.ts:412                        (per-tool execution charge in executeToolRequest)
//
//   3. validate_api_key — drift = a new file bypasses validateRequest()
//      and its wrapping logic (expires_at check, GatewayError shape).
//      Today only:
//        gateway.ts:47                         (validateRequest)
//
//   4. check_rate_limit — drift = a new path skips rate limiting.
//      Today only:
//        gateway.ts:102                        (checkRateLimit)
//
//   5. log_gateway_request — drift = silent usage rows from new paths
//      that miss the redactCreds + key_source pattern, or worse, never
//      get logged at all (billing reconciliation gap). Today only:
//        gateway.ts:331,387                    (error + success path)
//
// Source-file regex parser (NOT runtime import) — registry imports often
// pull in createClient() and crash without prod env (memory rule #59).
//
// Sibling guards: 4.121-4.130 (PostgREST column families). Together with
// this PR, every gateway WRITE — both PostgREST and RPC — has CI drift
// coverage. Next-tier: gateway READ surface (anon-readable tables, JWT
// scope leaks) is covered by Lane 4.34 + 4.45.

const SRC_ROOT = resolve(process.cwd(), "src");

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      walk(full, files);
    } else if (
      st.isFile() &&
      (full.endsWith(".ts") || full.endsWith(".tsx")) &&
      !full.endsWith(".test.ts") &&
      !full.endsWith(".test.tsx")
    ) {
      files.push(full);
    }
  }
  return files;
}

const RPC_ALLOWLISTS: Record<string, Set<string>> = {
  add_credits: new Set([
    "src/lib/gateway.ts", // auto-top-up after successful off-session PaymentIntent
    "src/app/api/webhooks/stripe/route.ts", // 4 webhook event handlers
  ]),
  deduct_credits: new Set([
    "src/lib/gateway.ts", // executeToolRequest
  ]),
  validate_api_key: new Set([
    "src/lib/gateway.ts", // validateRequest
  ]),
  check_rate_limit: new Set([
    "src/lib/gateway.ts", // checkRateLimit
  ]),
  log_gateway_request: new Set([
    "src/lib/gateway.ts", // error + success paths
  ]),
};

describe("Lane 4.131 — gateway RPC callsite drift guard", () => {
  const files = walk(SRC_ROOT);

  for (const [rpcName, allowlist] of Object.entries(RPC_ALLOWLISTS)) {
    it(`only allow-listed files call .rpc("${rpcName}")`, () => {
      const re = new RegExp(`\\.rpc\\(\\s*["']${rpcName}["']`);
      const violators: string[] = [];
      for (const file of files) {
        const src = readFileSync(file, "utf-8");
        if (re.test(src)) {
          const rel = file.replace(SRC_ROOT, "src").replace(/\\/g, "/");
          if (!allowlist.has(rel)) {
            violators.push(rel);
          }
        }
      }
      expect(violators).toEqual([]);
    });
  }

  it("no raw SQL CALL/SELECT against the financial RPCs in src/", () => {
    // Catches `CALL add_credits(...)` or `SELECT add_credits(...)` style
    // raw SQL — the supabase-js .rpc() path is the canonical surface.
    const re =
      /(SELECT|CALL)\s+(add_credits|deduct_credits|validate_api_key|log_gateway_request|check_rate_limit)\s*\(/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      if (re.test(src)) {
        violators.push(file.replace(SRC_ROOT, "src").replace(/\\/g, "/"));
      }
    }
    expect(violators).toEqual([]);
  });
});
