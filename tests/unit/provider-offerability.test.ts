import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { listKnownAdapterSlugs } from "@/lib/adapter-availability";
import {
  getProviderOfferability,
  getToolOfferability,
  summarizeOfferability,
} from "@/lib/provider-offerability";

describe("provider offerability metadata", () => {
  it("marks ToolRoute-native adapters as self-serve without external credentials", () => {
    expect(getProviderOfferability("toolroute")).toMatchObject({
      adapter_slug: "toolroute",
      status: "native",
      customer_action: "none",
      can_agent_self_serve: true,
      byok_ok: false,
      oauth_required: false,
      pool_contract_required: false,
      resale_risk: "low",
      tos_tier: "internal",
    });
  });

  it("marks standard premium providers as BYOK self-serve but pool-contract gated", () => {
    expect(getProviderOfferability("openai")).toMatchObject({
      adapter_slug: "openai",
      status: "customer_byok",
      customer_action: "save_provider_key",
      can_agent_self_serve: true,
      byok_ok: true,
      oauth_required: false,
      pool_contract_required: true,
      resale_risk: "medium",
      tos_tier: "ambiguous",
    });
  });

  it("marks OAuth or connected-account providers as not yet fully humanless", () => {
    expect(getProviderOfferability("drive")).toMatchObject({
      adapter_slug: "drive",
      status: "customer_oauth",
      customer_action: "complete_provider_oauth",
      can_agent_self_serve: false,
      byok_ok: true,
      oauth_required: true,
      pool_contract_required: true,
      resale_risk: "high",
      tos_tier: "required",
    });
  });

  it("hard-blocks providers where BYOK is not enough", () => {
    expect(getProviderOfferability("apollo")).toMatchObject({
      adapter_slug: "apollo",
      status: "unavailable",
      customer_action: "contact_support",
      can_agent_self_serve: false,
      byok_ok: false,
      pool_contract_required: true,
      resale_risk: "blocked",
      tos_tier: "insufficient",
    });
  });

  it("maps public catalog aliases to adapter offerability", () => {
    expect(getToolOfferability("google-drive")).toMatchObject({
      adapter_slug: "drive",
      status: "customer_oauth",
    });
    expect(getToolOfferability("fal-ai")).toMatchObject({
      adapter_slug: "image",
      status: "customer_byok",
    });
    expect(getToolOfferability("unknown")).toMatchObject({
      adapter_slug: null,
      status: "unavailable",
    });
  });

  it("covers every registered adapter with launch-offerability counts", () => {
    const summary = summarizeOfferability(listKnownAdapterSlugs());

    expect(summary).toEqual({
      native: 2,
      customer_byok: 37,
      customer_oauth: 12,
      pool_contract_required: 0,
      unavailable: 1,
    });
  });

  it("wires offerability into the public tools route response", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/app/api/v1/tools/route.ts"),
      "utf8"
    );

    expect(source).toMatch(/getToolOfferability/);
    expect(source).toMatch(/offerability/);
  });
});
