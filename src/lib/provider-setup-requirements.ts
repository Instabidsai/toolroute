import { listKnownAdapterSlugs } from "@/lib/adapter-availability";
import {
  getProviderOfferability,
  getToolOfferability,
  type ProviderOfferability,
} from "@/lib/provider-offerability";

export interface ProviderSetupRequirement {
  adapter_slug: string | null;
  offerability: ProviderOfferability;
  setup_required: boolean;
  agent_can_complete_now: boolean;
  setup_endpoint: string | null;
  required_auth: string | null;
  required_fields: string[];
  next_steps: string[];
  blockers: string[];
}

function requirementForOfferability(
  offerability: ProviderOfferability
): ProviderSetupRequirement {
  const adapterSlug = offerability.adapter_slug;

  if (offerability.status === "native") {
    return {
      adapter_slug: adapterSlug,
      offerability,
      setup_required: false,
      agent_can_complete_now: true,
      setup_endpoint: null,
      required_auth: null,
      required_fields: [],
      next_steps: [
        "Create or use a ToolRoute execution key.",
        "Call /api/v1/execute or /mcp tools/call with the target tool.",
      ],
      blockers: [],
    };
  }

  if (offerability.status === "customer_byok") {
    return {
      adapter_slug: adapterSlug,
      offerability,
      setup_required: true,
      agent_can_complete_now: true,
      setup_endpoint: "/api/v1/byok",
      required_auth: "ToolRoute management key or Supabase session JWT",
      required_fields: ["tool_slug", "api_key"],
      next_steps: [
        `POST /api/v1/byok with {"tool_slug":"${adapterSlug}","api_key":"<provider secret>"}.`,
        "Create or use a ToolRoute execution key.",
        `Call /api/v1/execute with a ${adapterSlug}/operation tool id.`,
      ],
      blockers: offerability.pool_contract_required
        ? ["ToolRoute-funded pooled execution requires provider approval."]
        : [],
    };
  }

  if (offerability.status === "customer_oauth") {
    return {
      adapter_slug: adapterSlug,
      offerability,
      setup_required: true,
      agent_can_complete_now: false,
      setup_endpoint: null,
      required_auth: "Provider OAuth or connected-account consent",
      required_fields: [],
      next_steps: [
        "Complete provider OAuth or connected-account authorization when ToolRoute exposes that flow.",
        "Use BYOK only if the provider token model and terms allow it for this account.",
        "After authorization, create or use a ToolRoute execution key.",
      ],
      blockers: [
        "Provider OAuth/connected-account flow is not fully exposed as an agent-completable ToolRoute API yet.",
        "ToolRoute-funded pooled execution requires provider approval.",
      ],
    };
  }

  if (offerability.status === "pool_contract_required") {
    return {
      adapter_slug: adapterSlug,
      offerability,
      setup_required: true,
      agent_can_complete_now: false,
      setup_endpoint: null,
      required_auth: "ToolRoute support/partner approval",
      required_fields: [],
      next_steps: [
        "Contact ToolRoute support for partner-contract or reseller approval.",
        "Do not assume ToolRoute-funded pooled execution is available.",
      ],
      blockers: ["Provider partner, marketplace, reseller, or OEM approval is required."],
    };
  }

  return {
    adapter_slug: adapterSlug,
    offerability,
    setup_required: true,
    agent_can_complete_now: false,
    setup_endpoint: null,
    required_auth: "ToolRoute support",
    required_fields: [],
    next_steps: [
      "Do not call this provider through ToolRoute until support marks it offerable.",
    ],
    blockers: [
      "Provider is unavailable pending waiver, legal decision, implementation, or removal.",
    ],
  };
}

export function getProviderSetupRequirement(
  adapterSlug: string | null | undefined
): ProviderSetupRequirement {
  return requirementForOfferability(getProviderOfferability(adapterSlug));
}

export function getToolSetupRequirement(
  toolSlug: string | null | undefined
): ProviderSetupRequirement {
  return requirementForOfferability(getToolOfferability(toolSlug));
}

export function listProviderSetupRequirements() {
  return listKnownAdapterSlugs()
    .sort()
    .map((slug) => getProviderSetupRequirement(slug));
}

export function summarizeSetupRequirements(
  requirements: ProviderSetupRequirement[]
) {
  return requirements.reduce(
    (acc, requirement) => {
      const status = requirement.offerability.status;
      acc.total += 1;
      acc.by_status[status] = (acc.by_status[status] ?? 0) + 1;
      if (requirement.setup_required) acc.setup_required += 1;
      if (requirement.agent_can_complete_now) acc.agent_can_complete_now += 1;
      if (requirement.offerability.oauth_required) acc.oauth_required += 1;
      if (requirement.offerability.pool_contract_required) {
        acc.pool_contract_required += 1;
      }
      return acc;
    },
    {
      total: 0,
      setup_required: 0,
      agent_can_complete_now: 0,
      oauth_required: 0,
      pool_contract_required: 0,
      by_status: {} as Record<string, number>,
    }
  );
}
