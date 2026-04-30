import {
  AMBIGUOUS_DEFAULT_BYOK_SLUGS,
  BYOK_INSUFFICIENT_SLUGS,
  BYOK_REQUIRED_SLUGS,
  TOOLROUTE_INTERNAL_SLUGS,
  classifyByokTier,
} from "@/lib/byok-required-slugs";
import { resolveAdapterSlug } from "@/lib/adapter-availability";

export type ProviderOfferabilityStatus =
  | "native"
  | "customer_byok"
  | "customer_oauth"
  | "pool_contract_required"
  | "unavailable";

export type ProviderCustomerAction =
  | "none"
  | "save_provider_key"
  | "complete_provider_oauth"
  | "contact_support";

export type ProviderResaleRisk = "low" | "medium" | "high" | "blocked";

export interface ProviderOfferability {
  adapter_slug: string | null;
  status: ProviderOfferabilityStatus;
  customer_action: ProviderCustomerAction;
  can_agent_self_serve: boolean;
  byok_ok: boolean;
  oauth_required: boolean;
  pool_contract_required: boolean;
  partner_program: string | null;
  resale_risk: ProviderResaleRisk;
  tos_tier: ReturnType<typeof classifyByokTier>;
  note: string;
}

const OAUTH_REQUIRED_SLUGS: ReadonlySet<string> = new Set([
  "calendar",
  "drive",
  "github",
  "hubspot",
  "linkedin",
  "linear",
  "notion",
  "sheets",
  "slack",
  "stripe",
  "twitter",
  "youtube",
]);

const PARTNER_PROGRAM_BY_SLUG: Readonly<Record<string, string>> = {
  github: "GitHub App or Marketplace approval",
  hubspot: "HubSpot App Marketplace approval",
  linkedin: "LinkedIn developer platform approval",
  shippo: "Shippo Software Providers partner program",
  slack: "Slack Marketplace or distributed app approval",
  stripe: "Stripe Connect/platform agreement",
  twitter: "X developer/commercial access approval",
  youtube: "Google OAuth verification and YouTube API Services compliance",
};

function isPoolContractRequired(adapterSlug: string) {
  return (
    BYOK_REQUIRED_SLUGS.has(adapterSlug) ||
    AMBIGUOUS_DEFAULT_BYOK_SLUGS.has(adapterSlug)
  );
}

function resaleRisk(adapterSlug: string): ProviderResaleRisk {
  if (BYOK_INSUFFICIENT_SLUGS.has(adapterSlug)) return "blocked";
  if (BYOK_REQUIRED_SLUGS.has(adapterSlug)) return "high";
  if (AMBIGUOUS_DEFAULT_BYOK_SLUGS.has(adapterSlug)) return "medium";
  return "low";
}

function noteFor(adapterSlug: string, status: ProviderOfferabilityStatus) {
  if (status === "native") {
    return "ToolRoute-native capability. No third-party provider credential is needed.";
  }

  if (status === "unavailable") {
    return "Do not offer through ToolRoute until provider waiver, direct approval, or removal decision is complete.";
  }

  if (status === "customer_oauth") {
    return "Customer/provider authorization is required. ToolRoute should not pool this provider without written partner or reseller approval.";
  }

  if (status === "pool_contract_required") {
    return "ToolRoute-funded pooling requires a provider contract or explicit written authorization.";
  }

  const tier = classifyByokTier(adapterSlug);
  if (tier === "ambiguous") {
    return "Default to customer BYOK while provider terms remain ambiguous for pooled resale.";
  }

  return "Customer BYOK is the launch-safe path. ToolRoute-funded pooling requires provider approval.";
}

export function getProviderOfferability(
  adapterSlug: string | null | undefined
): ProviderOfferability {
  const resolved = resolveAdapterSlug(adapterSlug);
  if (!resolved) {
    return {
      adapter_slug: null,
      status: "unavailable",
      customer_action: "contact_support",
      can_agent_self_serve: false,
      byok_ok: false,
      oauth_required: false,
      pool_contract_required: true,
      partner_program: null,
      resale_risk: "blocked",
      tos_tier: null,
      note: "No executable adapter is mapped for this catalog item.",
    };
  }

  const tosTier = classifyByokTier(resolved);

  if (TOOLROUTE_INTERNAL_SLUGS.has(resolved)) {
    return {
      adapter_slug: resolved,
      status: "native",
      customer_action: "none",
      can_agent_self_serve: true,
      byok_ok: false,
      oauth_required: false,
      pool_contract_required: false,
      partner_program: null,
      resale_risk: "low",
      tos_tier: tosTier,
      note: noteFor(resolved, "native"),
    };
  }

  if (BYOK_INSUFFICIENT_SLUGS.has(resolved)) {
    return {
      adapter_slug: resolved,
      status: "unavailable",
      customer_action: "contact_support",
      can_agent_self_serve: false,
      byok_ok: false,
      oauth_required: false,
      pool_contract_required: true,
      partner_program: null,
      resale_risk: "blocked",
      tos_tier: tosTier,
      note: noteFor(resolved, "unavailable"),
    };
  }

  const oauthRequired = OAUTH_REQUIRED_SLUGS.has(resolved);
  const partnerProgram = PARTNER_PROGRAM_BY_SLUG[resolved] ?? null;
  const poolContractRequired = isPoolContractRequired(resolved);

  if (oauthRequired) {
    return {
      adapter_slug: resolved,
      status: "customer_oauth",
      customer_action: "complete_provider_oauth",
      can_agent_self_serve: false,
      byok_ok: true,
      oauth_required: true,
      pool_contract_required: poolContractRequired,
      partner_program: partnerProgram,
      resale_risk: resaleRisk(resolved),
      tos_tier: tosTier,
      note: noteFor(resolved, "customer_oauth"),
    };
  }

  if (poolContractRequired) {
    return {
      adapter_slug: resolved,
      status: "customer_byok",
      customer_action: "save_provider_key",
      can_agent_self_serve: true,
      byok_ok: true,
      oauth_required: false,
      pool_contract_required: true,
      partner_program: partnerProgram,
      resale_risk: resaleRisk(resolved),
      tos_tier: tosTier,
      note: noteFor(resolved, "customer_byok"),
    };
  }

  if (partnerProgram) {
    return {
      adapter_slug: resolved,
      status: "pool_contract_required",
      customer_action: "contact_support",
      can_agent_self_serve: false,
      byok_ok: true,
      oauth_required: false,
      pool_contract_required: true,
      partner_program: partnerProgram,
      resale_risk: "medium",
      tos_tier: tosTier,
      note: noteFor(resolved, "pool_contract_required"),
    };
  }

  return {
    adapter_slug: resolved,
    status: "customer_byok",
    customer_action: "save_provider_key",
    can_agent_self_serve: true,
    byok_ok: true,
    oauth_required: false,
    pool_contract_required: false,
    partner_program: null,
    resale_risk: "low",
    tos_tier: tosTier,
    note: "Provider can be offered through customer credentials or a configured ToolRoute pool when funded.",
  };
}

export function getToolOfferability(
  toolSlug: string | null | undefined
): ProviderOfferability {
  return getProviderOfferability(resolveAdapterSlug(toolSlug));
}

export function summarizeOfferability(adapterSlugs: string[]) {
  return adapterSlugs.reduce<Record<ProviderOfferabilityStatus, number>>(
    (acc, slug) => {
      const status = getProviderOfferability(slug).status;
      acc[status] = (acc[status] ?? 0) + 1;
      return acc;
    },
    {
      native: 0,
      customer_byok: 0,
      customer_oauth: 0,
      pool_contract_required: 0,
      unavailable: 0,
    }
  );
}
