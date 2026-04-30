const CREDIT_PACKS = [5, 10, 25, 50, 100];

export async function buildAgentManifest() {
  const [{ listAdapters }, { getAdapterAvailability }] = await Promise.all([
    import("@/lib/adapters/index"),
    import("@/lib/adapter-availability"),
  ]);
  const { summarizeOfferability } = await import("@/lib/provider-offerability");
  const adapters = listAdapters();
  const accessModes = adapters.reduce<Record<string, number>>((acc, adapter) => {
    const mode = getAdapterAvailability(adapter.slug).access_mode;
    acc[mode] = (acc[mode] ?? 0) + 1;
    return acc;
  }, {});
  const offerability = summarizeOfferability(
    adapters.map((adapter) => adapter.slug)
  );

  return {
    name: "ToolRoute",
    description:
      "OpenRouter-style gateway for AI-agent tools: one ToolRoute key, multiple tool protocols, BYOK/provider-key vaulting where required.",
    api_base_url: "https://toolroute.ai",
    agent_ready: true,
    humanless_status: {
      can_discover_tools: true,
      can_create_test_key_by_api: true,
      can_manage_account_with_toolroute_key: true,
      account_management_requires_management_key_scope: true,
      can_start_stripe_checkout_by_api: true,
      can_start_saved_payment_method_setup_by_api: true,
      can_enable_auto_topup_by_api: true,
      checkout_completion_requires_browser_or_payment_agent: true,
      provider_oauth_requires_provider_consent: true,
    },
    discovery: {
      manifest: "/api/v1/agent/manifest",
      openapi: "/.well-known/openapi.json",
      ai_plugin: "/.well-known/ai-plugin.json",
      mcp_manifest: "/.well-known/mcp.json",
      agents_json: "/agents.json",
      llms_txt: "/llms.txt",
      llms_full_txt: "/llms-full.txt",
      tool_catalog: "/api/v1/tools",
      mcp_tools: "/api/v1/tools?format=mcp",
      openai_tools: "/api/v1/tools?format=openai",
    },
    onboarding: [
      {
        step: "create_test_account",
        method: "POST",
        path: "/api/v1/signup",
        auth: "none",
        body: {
          email: "agent@example.com",
          password: "long-random-password",
          accepted_tos: true,
        },
        returns: ["user_id", "api_key", "key_prefix"],
        key_scope: "management",
        notes:
          "The returned tr_test key is an account-management key. It can inspect account state and begin funding/BYOK setup, but it cannot execute tools.",
      },
      {
        step: "inspect_key_and_balance",
        method: "GET",
        path: "/api/v1/key",
        auth: "Authorization: Bearer tr_test_xxx or tr_live_xxx",
      },
      {
        step: "start_credit_checkout",
        method: "POST",
        path: "/api/v1/checkout",
        auth: "Supabase session JWT or ToolRoute API key",
        body: { type: "credits", amount: "5" },
        returns: ["checkout_url"],
        browser_required: true,
        notes:
          "Open checkout_url with a browser-capable payment agent or human card entry. After webhook credit grant, create a live key.",
      },
      {
        step: "create_live_key_after_payment",
        method: "POST",
        path: "/api/v1/keys",
        auth: "Supabase session JWT or ToolRoute API key",
        body: { name: "Production Agent Key", purpose: "execute" },
        returns: ["key", "id", "prefix", "scope"],
      },
      {
        step: "optionally_create_extra_management_key",
        method: "POST",
        path: "/api/v1/keys",
        auth: "Supabase session JWT or ToolRoute management key",
        body: { name: "Automation Management Key", purpose: "management" },
        returns: ["key", "id", "prefix", "scope"],
        notes:
          "Management keys can manage billing, BYOK, and key CRUD. They cannot execute tools.",
      },
      {
        step: "optionally_set_up_saved_payment_method",
        method: "POST",
        path: "/api/v1/billing/setup-payment",
        auth: "Supabase session JWT or ToolRoute management key",
        returns: ["checkout_url", "customer_id"],
        browser_required: true,
        notes:
          "Use this once to save a reusable payment method for auto top-up. Completing the Stripe setup URL still requires a browser/payment-capable agent or human card entry.",
      },
      {
        step: "optionally_enable_auto_topup",
        method: "PATCH",
        path: "/api/v1/settings",
        auth: "Supabase session JWT or ToolRoute management key",
        body: {
          auto_topup_enabled: true,
          auto_topup_threshold: 1,
          auto_topup_amount_cents: 1000,
        },
      },
      {
        step: "save_provider_key_when_required",
        method: "POST",
        path: "/api/v1/byok",
        auth: "Supabase session JWT or ToolRoute management key",
        body: { tool_slug: "openai", api_key: "provider-secret" },
        notes:
          "Provider keys are encrypted at rest. Use /api/v1/tools access_mode/byok_required fields to decide which providers need keys.",
      },
      {
        step: "execute_tool",
        method: "POST",
        path: "/api/v1/execute",
        auth: "Authorization: Bearer tr_live_xxx or tr_test_xxx",
        body: {
          tool: "toolroute/check_before_build",
          input: { task: "find the best tool for browser automation" },
        },
      },
    ],
    payments: {
      currency: "USD",
      credit_packs_usd: CREDIT_PACKS,
      checkout_endpoint: "/api/v1/checkout",
      setup_payment_endpoint: "/api/v1/billing/setup-payment",
      account_settings_endpoint: "/api/v1/settings",
      subscription_plans: ["pro", "enterprise"],
      supported_now: ["Stripe Checkout URL", "Stripe saved-card setup URL", "auto top-up after saved payment method"],
      not_supported_yet: [
        "card-token API charge without Stripe Checkout",
        "crypto/x402 payments",
        "provider OAuth purchase/consent automation",
      ],
    },
    protocols: {
      rest_execute: "/api/v1/execute",
      mcp_streamable_http: "/mcp",
      a2a_json_rpc: "/api/a2a",
      openai_function_catalog: "/api/v1/tools?format=openai",
      anthropic_tool_catalog: "/api/v1/tools?format=anthropic",
    },
    catalog_summary: {
      adapter_count: adapters.length,
      operation_count: adapters.reduce(
        (sum, adapter) => sum + adapter.operations.length,
        0
      ),
      access_modes: accessModes,
      offerability,
      access_mode_meanings: {
        byok: "Agent/customer must save a provider key before execution.",
        pool:
          "ToolRoute can execute with ToolRoute-funded provider capacity when configured.",
        free: "Internal/free ToolRoute capability.",
        unavailable:
          "Not offerable until implementation, provider terms, or funding is resolved.",
      },
      offerability_meanings: {
        native:
          "ToolRoute-native capability; no external provider credential needed.",
        customer_byok:
          "Customer can self-serve by saving a provider API key through /api/v1/byok.",
        customer_oauth:
          "Provider OAuth or connected-account consent is required before reliable self-serve execution.",
        pool_contract_required:
          "ToolRoute-funded pooling needs provider partner/reseller authorization first.",
        unavailable:
          "Do not offer until waiver, legal decision, or adapter removal is complete.",
      },
    },
    openrouter_parity_targets: [
      "machine-readable catalog",
      "one gateway key",
      "key/balance endpoint",
      "usage metering",
      "BYOK fee model",
      "fallback/auto-routing",
      "programmatic key management",
      "separate management/provisioning key scope",
      "well-known OpenAPI and plugin discovery",
    ],
  };
}
