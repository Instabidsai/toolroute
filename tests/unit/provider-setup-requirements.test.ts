import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getProviderSetupRequirement,
  getToolSetupRequirement,
  listProviderSetupRequirements,
  summarizeSetupRequirements,
} from "@/lib/provider-setup-requirements";

describe("provider setup requirements", () => {
  it("returns no setup for ToolRoute-native providers", () => {
    expect(getProviderSetupRequirement("toolroute")).toMatchObject({
      adapter_slug: "toolroute",
      setup_required: false,
      agent_can_complete_now: true,
      setup_endpoint: null,
      required_auth: null,
      required_fields: [],
    });
  });

  it("returns BYOK setup steps for API-key providers", () => {
    expect(getProviderSetupRequirement("openai")).toMatchObject({
      adapter_slug: "openai",
      setup_required: true,
      agent_can_complete_now: true,
      setup_endpoint: "/api/v1/byok",
      required_auth: "ToolRoute management key or Supabase session JWT",
      required_fields: ["tool_slug", "api_key"],
      offerability: {
        status: "customer_byok",
      },
    });
  });

  it("returns not-yet-agent-completable setup for OAuth providers", () => {
    const requirement = getProviderSetupRequirement("drive");

    expect(requirement).toMatchObject({
      adapter_slug: "drive",
      setup_required: true,
      agent_can_complete_now: false,
      setup_endpoint: null,
      required_auth: "Provider OAuth or connected-account consent",
      offerability: {
        status: "customer_oauth",
        oauth_required: true,
      },
    });
    expect(requirement.blockers.join(" ")).toContain("not fully exposed");
  });

  it("maps public tool slugs to provider requirements", () => {
    expect(getToolSetupRequirement("google-drive")).toMatchObject({
      adapter_slug: "drive",
      offerability: { status: "customer_oauth" },
    });
    expect(getToolSetupRequirement("fal-ai")).toMatchObject({
      adapter_slug: "image",
      setup_endpoint: "/api/v1/byok",
      offerability: { status: "customer_byok" },
    });
  });

  it("summarizes the full setup matrix", () => {
    const requirements = listProviderSetupRequirements();
    const summary = summarizeSetupRequirements(requirements);

    expect(requirements).toHaveLength(51);
    expect(summary).toEqual({
      total: 51,
      setup_required: 49,
      agent_can_complete_now: 38,
      oauth_required: 12,
      pool_contract_required: 49,
      by_status: {
        native: 2,
        customer_byok: 36,
        customer_oauth: 12,
        unavailable: 1,
      },
    });
  });

  it("ships a public route for the setup matrix", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/app/api/v1/provider-requirements/route.ts"),
      "utf8"
    );

    expect(source).toMatch(/listProviderSetupRequirements/);
    expect(source).toMatch(/getToolSetupRequirement/);
    expect(source).toMatch(/getProviderSetupRequirement/);
  });
});
