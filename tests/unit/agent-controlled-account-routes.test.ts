import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("agent-controlled onboarding routes", () => {
  it("exposes a public machine-readable agent manifest", () => {
    const manifest = source("src/lib/agent-manifest.ts");
    const route = source("src/app/api/v1/agent/manifest/route.ts");

    expect(route).toMatch(/buildAgentManifest\(\)/);
    expect(manifest).toMatch(/can_create_test_key_by_api:\s*true/);
    expect(manifest).toMatch(/can_manage_account_with_toolroute_key:\s*true/);
    expect(manifest).toMatch(/can_start_stripe_checkout_by_api:\s*true/);
    expect(manifest).toMatch(/can_start_saved_payment_method_setup_by_api:\s*true/);
    expect(manifest).toMatch(/can_enable_auto_topup_by_api:\s*true/);
    expect(manifest).toMatch(/checkout_completion_requires_browser_or_payment_agent:\s*true/);
    expect(manifest).toMatch(/\/api\/v1\/signup/);
    expect(manifest).toMatch(/\/api\/v1\/checkout/);
    expect(manifest).toMatch(/\/api\/v1\/billing\/setup-payment/);
    expect(manifest).toMatch(/\/api\/v1\/settings/);
    expect(manifest).toMatch(/\/api\/v1\/byok/);
    expect(manifest).toMatch(/\/api\/v1\/execute/);
  });

  it("lets agents use a ToolRoute key for funding, auto top-up, key creation, and BYOK setup", () => {
    for (const path of [
      "src/app/api/v1/checkout/route.ts",
      "src/app/api/v1/billing/setup-payment/route.ts",
      "src/app/api/v1/settings/route.ts",
      "src/app/api/v1/keys/route.ts",
      "src/app/api/v1/byok/route.ts",
    ]) {
      const route = source(path);
      expect(route, path).toMatch(/getAccountActor/);
      expect(route, path).not.toMatch(/getUserFromSession/);
    }
  });

  it("blocks limited execution keys from account management", () => {
    const accountAuth = source("src/lib/account-auth.ts");

    expect(accountAuth).toMatch(/ctx\.allowedTools\s*&&\s*ctx\.allowedTools\.length\s*>\s*0/);
    expect(accountAuth).toMatch(/restricted_key_no_account_management/);
  });

  it("checkout returns machine-readable next steps for autonomous setup", () => {
    const route = source("src/app/api/v1/checkout/route.ts");

    expect(route).toMatch(/browser_required:\s*true/);
    expect(route).toMatch(/after_success:\s*"\/dashboard\/keys\?new=1"/);
    expect(route).toMatch(/create_live_key:\s*"\/api\/v1\/keys"/);
    expect(route).toMatch(/check_balance:\s*"\/api\/v1\/key"/);
    expect(route).toMatch(/initiated_by:\s*authKind/);
  });
});
