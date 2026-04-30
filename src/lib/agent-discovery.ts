const API_BASE_URL = "https://toolroute.ai";

const CACHE_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Cache-Control": "public, max-age=300, s-maxage=3600",
};

export function discoveryHeaders() {
  return CACHE_HEADERS;
}

export function buildOpenApiSpec() {
  return {
    openapi: "3.1.0",
    info: {
      title: "ToolRoute API",
      version: "1.2.0",
      summary: "OpenRouter-style gateway for MCP and agent tools",
      description:
        "ToolRoute gives agents one gateway key, a machine-readable catalog, BYOK/provider-key storage, Stripe funding, and REST/MCP/A2A tool execution.",
      contact: {
        name: "ToolRoute",
        url: API_BASE_URL,
      },
    },
    servers: [{ url: API_BASE_URL }],
    tags: [
      { name: "Discovery" },
      { name: "Onboarding" },
      { name: "Account" },
      { name: "Billing" },
      { name: "Tools" },
      { name: "Execution" },
      { name: "MCP" },
    ],
    paths: {
      "/api/v1/agent/manifest": {
        get: {
          tags: ["Discovery"],
          operationId: "getAgentManifest",
          summary: "Get the agent-controlled onboarding manifest",
          security: [],
          responses: {
            "200": {
              description: "Agent setup graph and capability metadata",
              content: {
                "application/json": {
                  schema: { type: "object", additionalProperties: true },
                },
              },
            },
          },
        },
      },
      "/api/v1/signup": {
        post: {
          tags: ["Onboarding"],
          operationId: "createAccount",
          summary: "Create an account and receive a management key",
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SignupRequest" },
              },
            },
          },
          responses: {
            "201": {
              description:
                "Account created. The returned tr_test key is management-scoped and cannot execute tools.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/SignupResponse" },
                },
              },
            },
            "400": { $ref: "#/components/responses/Error" },
            "409": { $ref: "#/components/responses/Error" },
          },
        },
      },
      "/api/v1/key": {
        get: {
          tags: ["Account"],
          operationId: "getKeyInfo",
          summary: "Inspect API key scope, account plan, limits, and balance",
          security: [{ ToolRouteBearer: [] }],
          responses: {
            "200": {
              description: "Key and account state",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/KeyInfo" },
                },
              },
            },
            "401": { $ref: "#/components/responses/Error" },
          },
        },
      },
      "/api/v1/tools": {
        get: {
          tags: ["Tools"],
          operationId: "listTools",
          summary: "List ToolRoute tools and export agent tool formats",
          description:
            "Default catalog responses include access_mode, byok_required, and offerability metadata so agents can distinguish native, BYOK, OAuth, partner-contract, and unavailable providers.",
          security: [],
          parameters: [
            {
              name: "format",
              in: "query",
              required: false,
              schema: {
                type: "string",
                enum: ["openai", "anthropic", "mcp"],
              },
              description:
                "Return OpenAI function tools, Anthropic tools, or MCP tools/list shape.",
            },
          ],
          responses: {
            "200": {
              description: "Tool catalog",
              content: {
                "application/json": {
                  schema: { type: "object", additionalProperties: true },
                },
              },
            },
          },
        },
      },
      "/api/v1/provider-requirements": {
        get: {
          tags: ["Tools"],
          operationId: "listProviderRequirements",
          summary: "List provider setup requirements for agents",
          description:
            "Returns the concrete setup path for each provider: no setup, BYOK via /api/v1/byok, provider OAuth/connected account, partner-contract support, or unavailable.",
          security: [],
          parameters: [
            {
              name: "tool_slug",
              in: "query",
              required: false,
              schema: { type: "string" },
              description:
                "Optional public catalog/tool slug such as google-drive or fal-ai.",
            },
            {
              name: "adapter_slug",
              in: "query",
              required: false,
              schema: { type: "string" },
              description:
                "Optional runtime adapter slug such as drive, openai, or slack.",
            },
          ],
          responses: {
            "200": {
              description: "Provider setup requirements",
              content: {
                "application/json": {
                  schema: { type: "object", additionalProperties: true },
                },
              },
            },
          },
        },
      },
      "/api/v1/execute": {
        post: {
          tags: ["Execution"],
          operationId: "executeTool",
          summary: "Execute a provider/operation through ToolRoute",
          security: [{ ToolRouteBearer: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ExecuteRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "Tool execution result",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ExecuteResponse" },
                },
              },
            },
            "401": { $ref: "#/components/responses/Error" },
            "402": { $ref: "#/components/responses/Error" },
            "404": { $ref: "#/components/responses/Error" },
            "429": { $ref: "#/components/responses/Error" },
          },
        },
      },
      "/mcp": {
        post: {
          tags: ["MCP"],
          operationId: "mcpJsonRpc",
          summary: "MCP Streamable HTTP JSON-RPC endpoint",
          description:
            "Supports initialize, tools/list, and tools/call. tools/list is public; tools/call requires a ToolRoute execution key.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/JsonRpcRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "JSON-RPC response",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/JsonRpcResponse" },
                },
              },
            },
          },
        },
      },
      "/api/a2a": {
        post: {
          tags: ["Execution"],
          operationId: "a2aJsonRpc",
          summary: "A2A JSON-RPC endpoint for agent interoperability",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/JsonRpcRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "JSON-RPC response",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/JsonRpcResponse" },
                },
              },
            },
          },
        },
      },
      "/api/v1/checkout": {
        post: {
          tags: ["Billing"],
          operationId: "createCheckoutSession",
          summary: "Create a Stripe Checkout URL for credits or subscription",
          security: [{ ToolRouteManagementBearer: [] }, { SupabaseSession: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CheckoutRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "Stripe checkout URL and next-step metadata",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/CheckoutResponse" },
                },
              },
            },
            "401": { $ref: "#/components/responses/Error" },
            "403": { $ref: "#/components/responses/Error" },
          },
        },
      },
      "/api/v1/billing/setup-payment": {
        post: {
          tags: ["Billing"],
          operationId: "createSetupPaymentSession",
          summary: "Create a Stripe setup URL for a saved payment method",
          security: [{ ToolRouteManagementBearer: [] }, { SupabaseSession: [] }],
          responses: {
            "200": {
              description: "Stripe setup URL and customer id",
              content: {
                "application/json": {
                  schema: { type: "object", additionalProperties: true },
                },
              },
            },
            "401": { $ref: "#/components/responses/Error" },
            "403": { $ref: "#/components/responses/Error" },
          },
        },
      },
      "/api/v1/settings": {
        get: {
          tags: ["Account"],
          operationId: "getAccountSettings",
          summary: "Read account billing and auto-top-up settings",
          security: [{ ToolRouteManagementBearer: [] }, { SupabaseSession: [] }],
          responses: {
            "200": {
              description: "Account settings",
              content: {
                "application/json": {
                  schema: { type: "object", additionalProperties: true },
                },
              },
            },
            "401": { $ref: "#/components/responses/Error" },
          },
        },
        patch: {
          tags: ["Account"],
          operationId: "updateAccountSettings",
          summary: "Update allow-listed account settings",
          security: [{ ToolRouteManagementBearer: [] }, { SupabaseSession: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SettingsPatch" },
              },
            },
          },
          responses: {
            "200": {
              description: "Updated settings",
              content: {
                "application/json": {
                  schema: { type: "object", additionalProperties: true },
                },
              },
            },
            "400": { $ref: "#/components/responses/Error" },
            "401": { $ref: "#/components/responses/Error" },
            "403": { $ref: "#/components/responses/Error" },
          },
        },
      },
      "/api/v1/keys": {
        get: {
          tags: ["Account"],
          operationId: "listApiKeys",
          summary: "List account API keys",
          security: [{ ToolRouteManagementBearer: [] }, { SupabaseSession: [] }],
          responses: {
            "200": {
              description: "API keys without secret values",
              content: {
                "application/json": {
                  schema: { type: "object", additionalProperties: true },
                },
              },
            },
          },
        },
        post: {
          tags: ["Account"],
          operationId: "createApiKey",
          summary: "Create an execution or management key",
          security: [{ ToolRouteManagementBearer: [] }, { SupabaseSession: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateKeyRequest" },
              },
            },
          },
          responses: {
            "201": {
              description: "Created key. Full key value is returned once.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/CreateKeyResponse" },
                },
              },
            },
            "400": { $ref: "#/components/responses/Error" },
            "401": { $ref: "#/components/responses/Error" },
            "403": { $ref: "#/components/responses/Error" },
          },
        },
        patch: {
          tags: ["Account"],
          operationId: "renameApiKey",
          summary: "Rename an API key",
          security: [{ ToolRouteManagementBearer: [] }, { SupabaseSession: [] }],
          responses: {
            "200": {
              description: "Renamed key",
              content: {
                "application/json": {
                  schema: { type: "object", additionalProperties: true },
                },
              },
            },
          },
        },
        delete: {
          tags: ["Account"],
          operationId: "revokeApiKey",
          summary: "Revoke an API key",
          security: [{ ToolRouteManagementBearer: [] }, { SupabaseSession: [] }],
          responses: {
            "200": {
              description: "Revoked key",
              content: {
                "application/json": {
                  schema: { type: "object", additionalProperties: true },
                },
              },
            },
          },
        },
      },
      "/api/v1/byok": {
        get: {
          tags: ["Account"],
          operationId: "listProviderKeys",
          summary: "List saved provider-key connections without secrets",
          security: [{ ToolRouteManagementBearer: [] }, { SupabaseSession: [] }],
          responses: {
            "200": {
              description: "Provider-key status",
              content: {
                "application/json": {
                  schema: { type: "object", additionalProperties: true },
                },
              },
            },
          },
        },
        post: {
          tags: ["Account"],
          operationId: "saveProviderKey",
          summary: "Encrypt and save a BYOK provider key",
          security: [{ ToolRouteManagementBearer: [] }, { SupabaseSession: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ByokRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "Provider key saved",
              content: {
                "application/json": {
                  schema: { type: "object", additionalProperties: true },
                },
              },
            },
            "400": { $ref: "#/components/responses/Error" },
            "401": { $ref: "#/components/responses/Error" },
            "403": { $ref: "#/components/responses/Error" },
          },
        },
        delete: {
          tags: ["Account"],
          operationId: "deleteProviderKey",
          summary: "Delete a BYOK provider key",
          security: [{ ToolRouteManagementBearer: [] }, { SupabaseSession: [] }],
          responses: {
            "200": {
              description: "Provider key deleted",
              content: {
                "application/json": {
                  schema: { type: "object", additionalProperties: true },
                },
              },
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        ToolRouteBearer: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "tr_live",
          description:
            "ToolRoute execution key. Use for /api/v1/execute, /mcp tools/call, and /api/a2a execution.",
        },
        ToolRouteManagementBearer: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "tr_test or tr_live management",
          description:
            "ToolRoute management key. Use for billing, BYOK, settings, and key CRUD. Management keys cannot execute tools.",
        },
        SupabaseSession: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Supabase dashboard session JWT.",
        },
      },
      responses: {
        Error: {
          description: "Error response",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
            },
          },
        },
      },
      schemas: {
        ErrorResponse: {
          type: "object",
          properties: {
            error: {
              type: "object",
              properties: {
                message: { type: "string" },
                code: { type: "string" },
              },
              required: ["message", "code"],
            },
          },
          required: ["error"],
        },
        SignupRequest: {
          type: "object",
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 8 },
            accepted_tos: { type: "boolean", const: true },
          },
          required: ["email", "password", "accepted_tos"],
          additionalProperties: false,
        },
        SignupResponse: {
          type: "object",
          properties: {
            user_id: { type: "string" },
            api_key: { type: "string", description: "Returned once." },
            key_prefix: { type: "string" },
            key_scope: { type: "string", enum: ["management"] },
          },
          required: ["user_id", "api_key", "key_prefix", "key_scope"],
        },
        KeyInfo: {
          type: "object",
          properties: {
            valid: { type: "boolean" },
            key_prefix: { type: "string" },
            key_scope: { type: "string", enum: ["execute", "management"] },
            plan: { type: "string" },
            credit_balance: { type: "number" },
            rate_limit_rpm: { type: "number" },
          },
          additionalProperties: true,
        },
        ExecuteRequest: {
          type: "object",
          properties: {
            tool: {
              type: "string",
              examples: ["firecrawl/scrape", "toolroute/check_before_build"],
            },
            input: { type: "object", additionalProperties: true },
            provider: {
              type: "object",
              properties: {
                max_price: { type: "number" },
              },
              additionalProperties: true,
            },
          },
          required: ["tool", "input"],
          additionalProperties: false,
        },
        ExecuteResponse: {
          type: "object",
          properties: {
            id: { type: "string" },
            tool: { type: "string" },
            provider: { type: "string" },
            data: { type: "object", additionalProperties: true },
            usage: {
              type: "object",
              properties: {
                cost: { type: "number" },
                balance_remaining: { type: "number" },
                latency_ms: { type: "number" },
              },
            },
          },
          additionalProperties: true,
        },
        JsonRpcRequest: {
          type: "object",
          properties: {
            jsonrpc: { type: "string", const: "2.0" },
            id: { oneOf: [{ type: "string" }, { type: "number" }] },
            method: { type: "string", examples: ["tools/list", "tools/call"] },
            params: { type: "object", additionalProperties: true },
          },
          required: ["jsonrpc", "id", "method"],
          additionalProperties: true,
        },
        JsonRpcResponse: {
          type: "object",
          properties: {
            jsonrpc: { type: "string", const: "2.0" },
            id: { oneOf: [{ type: "string" }, { type: "number" }] },
            result: { type: "object", additionalProperties: true },
            error: {
              type: "object",
              properties: {
                code: { type: "number" },
                message: { type: "string" },
              },
            },
          },
          additionalProperties: true,
        },
        CheckoutRequest: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["credits", "subscription"] },
            amount: { type: "string", enum: ["5", "10", "25", "50", "100"] },
            plan: { type: "string", enum: ["pro", "enterprise"] },
          },
          required: ["type"],
          additionalProperties: false,
        },
        CheckoutResponse: {
          type: "object",
          properties: {
            checkout_url: { type: "string", format: "uri" },
            next: { type: "object", additionalProperties: true },
          },
          required: ["checkout_url"],
          additionalProperties: true,
        },
        SettingsPatch: {
          type: "object",
          properties: {
            display_name: { type: "string" },
            auto_topup_enabled: { type: "boolean" },
            auto_topup_threshold: { type: "number", minimum: 0 },
            auto_topup_amount_cents: { type: "integer", minimum: 100 },
          },
          additionalProperties: false,
        },
        CreateKeyRequest: {
          type: "object",
          properties: {
            name: { type: "string" },
            purpose: { type: "string", enum: ["execute", "management"] },
            scope: { type: "string", enum: ["execute", "management"] },
            allowed_tools: {
              type: "array",
              items: { type: "string" },
              description:
                "Optional execution-key allow-list. Not allowed for management keys.",
            },
          },
          additionalProperties: false,
        },
        CreateKeyResponse: {
          type: "object",
          properties: {
            key: { type: "string", description: "Returned once." },
            id: { type: "string" },
            prefix: { type: "string" },
            scope: { type: "string", enum: ["execute", "management"] },
          },
          required: ["key", "id", "prefix", "scope"],
          additionalProperties: true,
        },
        ByokRequest: {
          type: "object",
          properties: {
            tool_slug: { type: "string", examples: ["openai", "elevenlabs"] },
            api_key: { type: "string", description: "Provider secret." },
          },
          required: ["tool_slug", "api_key"],
          additionalProperties: false,
        },
      },
    },
  };
}

export function buildAiPluginManifest() {
  return {
    schema_version: "v1",
    name_for_human: "ToolRoute",
    name_for_model: "toolroute",
    description_for_human:
      "One API for MCP and agent tools with billing, BYOK, and usage metering.",
    description_for_model:
      "Use ToolRoute to discover, fund, configure, and execute third-party tools through one gateway. Start with /api/v1/agent/manifest, create a management key through /api/v1/signup, fund the account with /api/v1/checkout, create an execution key through /api/v1/keys, then call /api/v1/execute or /mcp.",
    auth: {
      type: "service_http",
      authorization_type: "bearer",
      verification_tokens: {},
    },
    api: {
      type: "openapi",
      url: `${API_BASE_URL}/.well-known/openapi.json`,
      is_user_authenticated: true,
    },
    logo_url: `${API_BASE_URL}/icon.png`,
    contact_email: "support@toolroute.ai",
    legal_info_url: `${API_BASE_URL}/terms`,
  };
}

export function buildMcpManifest() {
  return {
    name: "ToolRoute",
    description: "OpenRouter-style MCP gateway for agent tools.",
    protocol: "mcp-streamable-http",
    endpoint: `${API_BASE_URL}/mcp`,
    authorization: {
      type: "bearer",
      header: "Authorization",
      format: "Bearer tr_live_xxx",
      management_keys_can_execute: false,
    },
    capabilities: {
      tools_list_public: true,
      tools_call_requires_execution_key: true,
      account_management_requires_management_key: true,
    },
    mcpServers: {
      toolroute: {
        url: `${API_BASE_URL}/mcp`,
        headers: {
          Authorization: "Bearer ${TOOLROUTE_API_KEY}",
        },
      },
    },
    discovery: {
      agent_manifest: `${API_BASE_URL}/api/v1/agent/manifest`,
      openapi: `${API_BASE_URL}/.well-known/openapi.json`,
      tools: `${API_BASE_URL}/api/v1/tools?format=mcp`,
    },
  };
}

export function buildAgentsJson() {
  return {
    name: "ToolRoute",
    url: API_BASE_URL,
    description:
      "Agent-controlled tool gateway: discover tools, create an account, fund credits, save BYOK keys, and execute via REST/MCP/A2A.",
    agent_controlled: true,
    discovery: {
      manifest: `${API_BASE_URL}/api/v1/agent/manifest`,
      openapi: `${API_BASE_URL}/.well-known/openapi.json`,
      ai_plugin: `${API_BASE_URL}/.well-known/ai-plugin.json`,
      mcp: `${API_BASE_URL}/.well-known/mcp.json`,
      llms_txt: `${API_BASE_URL}/llms.txt`,
      llms_full_txt: `${API_BASE_URL}/llms-full.txt`,
    },
    actions: [
      {
        name: "create_management_key",
        method: "POST",
        path: "/api/v1/signup",
        auth: "none",
      },
      {
        name: "fund_account",
        method: "POST",
        path: "/api/v1/checkout",
        auth: "ToolRoute management key",
      },
      {
        name: "create_execution_key",
        method: "POST",
        path: "/api/v1/keys",
        auth: "ToolRoute management key",
      },
      {
        name: "save_provider_key",
        method: "POST",
        path: "/api/v1/byok",
        auth: "ToolRoute management key",
      },
      {
        name: "execute_tool",
        method: "POST",
        path: "/api/v1/execute",
        auth: "ToolRoute execution key",
      },
    ],
    human_required_boundaries: [
      "Stripe Checkout or Setup URLs still require a browser/payment-capable agent or human payment approval.",
      "Provider OAuth consent still requires provider-specific authorization.",
    ],
  };
}
