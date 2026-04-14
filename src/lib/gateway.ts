import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "crypto";
import {
  GatewayError,
  GatewayContext,
  ToolResult,
} from "./gateway-types";
import { toolrouteAdapter } from "./adapters/toolroute-adapter";
import { autoAdapter } from "./adapters/auto-adapter";
import type { ToolAdapter } from "./gateway-types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export function supabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

const adapters: Record<string, ToolAdapter> = {
  toolroute: toolrouteAdapter,
  auto: autoAdapter,
};

export function registerAdapter(adapter: ToolAdapter) {
  adapters[adapter.slug] = adapter;
}

export function listRegisteredAdapters() {
  return Object.values(adapters);
}

function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export async function validateRequest(
  authHeader: string | null
): Promise<GatewayContext> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new GatewayError(
      "Missing or invalid Authorization header",
      401,
      "auth_required"
    );
  }

  const rawKey = authHeader.slice(7);
  if (!rawKey.startsWith("tr_live_") && !rawKey.startsWith("tr_test_")) {
    throw new GatewayError("Invalid API key format", 401, "invalid_key_format");
  }

  const keyHash = hashKey(rawKey);
  const sb = supabaseAdmin();

  const { data, error } = await sb.rpc("validate_api_key", {
    p_key_hash: keyHash,
  });

  if (error) {
    throw new GatewayError("Key validation failed", 500, "validation_error");
  }

  const result = data as Record<string, unknown>;

  if (!result.valid) {
    throw new GatewayError(
      (result.error as string) || "Invalid API key",
      401,
      "invalid_key"
    );
  }

  return {
    userId: result.user_id as string,
    keyId: result.key_id as string,
    keyName: result.key_name as string,
    planSlug: result.plan_slug as string,
    creditBalance: result.credit_balance as number,
    rateLimitRpm: result.rate_limit_rpm as number,
    rateLimitRpd: result.rate_limit_rpd as number,
    allowedTools: result.allowed_tools as string[] | null,
  };
}

export async function checkRateLimit(ctx: GatewayContext): Promise<void> {
  const sb = supabaseAdmin();

  const { data, error } = await sb.rpc("check_rate_limit", {
    p_key_id: ctx.keyId,
    p_rpm_limit: ctx.rateLimitRpm,
    p_rpd_limit: ctx.rateLimitRpd,
  });

  if (error) {
    console.error("Rate limit check failed:", error.message);
    return; // fail open — don't block requests if rate limiting is broken
  }

  const result = data as Record<string, unknown>;

  if (!result.allowed) {
    const err = new GatewayError(
      result.error as string,
      429,
      "rate_limit_exceeded"
    );
    (err as GatewayError & { retryAfter: number }).retryAfter =
      Math.ceil(result.retry_after_seconds as number);
    throw err;
  }
}

function resolveAdapter(
  toolPath: string
): { adapter: ToolAdapter; operation: string } {
  const parts = toolPath.split("/");
  if (parts.length < 2) {
    throw new GatewayError(
      'Invalid tool format. Expected "provider/operation", got: "' +
        toolPath + '"',
      400,
      "invalid_tool_format"
    );
  }

  const [providerSlug, ...rest] = parts;
  const operation = rest.join("/");
  const adapter = adapters[providerSlug];

  if (!adapter) {
    throw new GatewayError(
      'Unknown provider: "' + providerSlug + '". Available: ' +
        Object.keys(adapters).join(", "),
      404,
      "unknown_provider"
    );
  }

  if (!adapter.operations.includes(operation)) {
    throw new GatewayError(
      'Unknown operation "' + operation + '" for provider "' +
        providerSlug + '". Available: ' + adapter.operations.join(", "),
      404,
      "unknown_operation"
    );
  }

  return { adapter, operation };
}

export async function executeToolRequest(
  ctx: GatewayContext,
  toolPath: string,
  input: Record<string, unknown>
): Promise<ToolResult> {
  if (ctx.allowedTools && !ctx.allowedTools.includes(toolPath)) {
    throw new GatewayError(
      "This API key does not have access to the requested tool",
      403,
      "tool_not_allowed"
    );
  }

  const { adapter, operation } = resolveAdapter(toolPath);
  const estimatedCost = adapter.estimateCost(operation, input);

  if (ctx.creditBalance < estimatedCost && estimatedCost > 0) {
    throw new GatewayError(
      "Insufficient credits. Required: $" +
        estimatedCost.toFixed(4) +
        ", available: $" +
        ctx.creditBalance.toFixed(4),
      402,
      "insufficient_credits"
    );
  }

  // --- Key resolution: BYOK > Master > Env var ---
  let resolvedKey: string | undefined;
  let keySource: "byok" | "master" | "env_var" = "env_var";
  let costToUs = 0;
  let masterCostPerCall = 0;
  let masterCostModel: string | null = null;
  // markup_percent is stored per-provider for future dynamic pricing
  let _masterMarkupPercent = 0;

  const sb0 = supabaseAdmin();

  // 1. Check for user's BYOK key (highest priority)
  const { data: byokRow } = await sb0
    .from("user_provider_keys")
    .select("api_key_encrypted")
    .eq("user_id", ctx.userId)
    .eq("tool_slug", adapter.slug)
    .eq("is_active", true)
    .eq("prefer_own_key", true)
    .single();

  if (byokRow) {
    resolvedKey = byokRow.api_key_encrypted;
    keySource = "byok";
  }

  // 2. If no BYOK, check for master key in tool_providers
  if (!resolvedKey) {
    const { data: providerRow } = await sb0
      .from("tool_providers")
      .select(
        "auth_key_encrypted, cost_per_call, cost_model, markup_percent"
      )
      .eq("tool_slug", adapter.slug)
      .eq("is_active", true)
      .single();

    if (providerRow?.auth_key_encrypted) {
      resolvedKey = providerRow.auth_key_encrypted;
      keySource = "master";
      masterCostPerCall = Number(providerRow.cost_per_call) || 0;
      masterCostModel = providerRow.cost_model;
      _masterMarkupPercent = Number(providerRow.markup_percent) || 0;
    }
  }

  // 3. If neither BYOK nor master, adapter falls back to its own env var
  //    (resolvedKey stays undefined, adapter uses process.env internally)

  const requestId = randomBytes(16).toString("hex");
  const start = Date.now();

  let result;
  try {
    result = await adapter.execute(operation, input, resolvedKey);
  } catch (err) {
    const latencyMs = Date.now() - start;
    const errMsg = err instanceof Error ? err.message : String(err);

    // Log the failed request
    const sb = supabaseAdmin();
    await sb.rpc("log_gateway_request", {
      p_user_id: ctx.userId,
      p_key_id: ctx.keyId,
      p_tool_slug: adapter.slug,
      p_provider: adapter.name,
      p_status: 500,
      p_cost_to_us: 0,
      p_cost_to_user: 0,
      p_latency_ms: latencyMs,
      p_used_byok: keySource === "byok",
      p_error: errMsg,
      p_key_source: keySource,
    });

    return {
      success: false,
      error: errMsg,
      tool: toolPath,
      provider: adapter.name,
      latency_ms: latencyMs,
      cost: 0,
      request_id: requestId,
    };
  }

  const latencyMs = Date.now() - start;
  const actualCost = result.units_consumed
    ? estimatedCost * result.units_consumed
    : estimatedCost;
  const finalCost = result.success ? actualCost : 0;

  // Calculate COGS when using master key
  if (keySource === "master" && result.success) {
    if (masterCostModel === "per_unit" && result.units_consumed) {
      costToUs = masterCostPerCall * result.units_consumed;
    } else {
      costToUs = masterCostPerCall;
    }
  }

  const sb = supabaseAdmin();

  // Log the request with key source and COGS
  await sb.rpc("log_gateway_request", {
    p_user_id: ctx.userId,
    p_key_id: ctx.keyId,
    p_tool_slug: adapter.slug,
    p_provider: result.provider,
    p_status: result.success ? 200 : 500,
    p_cost_to_us: costToUs,
    p_cost_to_user: finalCost,
    p_latency_ms: latencyMs,
    p_used_byok: keySource === "byok",
    p_error: result.error ?? null,
    p_key_source: keySource,
  });

  // Deduct credits for successful requests
  if (result.success && finalCost > 0) {
    const { data: deductResult } = await sb.rpc("deduct_credits", {
      p_user_id: ctx.userId,
      p_amount: finalCost,
      p_tool_slug: adapter.slug,
      p_key_id: ctx.keyId,
      p_description: toolPath + " execution",
    });

    if (deductResult && !(deductResult as Record<string, unknown>).success) {
      console.error("Credit deduction failed:", deductResult);
    }
  }

  return {
    success: result.success,
    data: result.data,
    error: result.error,
    tool: toolPath,
    provider: result.provider,
    latency_ms: latencyMs,
    cost: finalCost,
    request_id: requestId,
  };
}

export async function getKeyInfo(authHeader: string | null) {
  const ctx = await validateRequest(authHeader);
  const sb = supabaseAdmin();

  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const monthStart = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);

  const [todayUsage, monthUsage] = await Promise.all([
    sb
      .from("gateway_usage_log")
      .select("cost_to_user")
      .eq("user_id", ctx.userId)
      .gte("created_at", dayStart.toISOString()),
    sb
      .from("gateway_usage_log")
      .select("cost_to_user")
      .eq("user_id", ctx.userId)
      .gte("created_at", monthStart.toISOString()),
  ]);

  const todayRequests = todayUsage.data?.length ?? 0;
  const todayCost =
    todayUsage.data?.reduce((s, r) => s + (r.cost_to_user ?? 0), 0) ?? 0;
  const monthRequests = monthUsage.data?.length ?? 0;
  const monthCost =
    monthUsage.data?.reduce((s, r) => s + (r.cost_to_user ?? 0), 0) ?? 0;

  return {
    key_name: ctx.keyName,
    plan: ctx.planSlug,
    credit_balance: ctx.creditBalance,
    rate_limit: { rpm: ctx.rateLimitRpm, rpd: ctx.rateLimitRpd },
    usage: {
      today: { requests: todayRequests, cost: todayCost },
      this_month: { requests: monthRequests, cost: monthCost },
    },
  };
}

export function generateApiKey(): {
  raw: string;
  hash: string;
  prefix: string;
} {
  const raw = "tr_live_" + randomBytes(20).toString("hex");
  const hash = hashKey(raw);
  const prefix = raw.slice(0, 16);
  return { raw, hash, prefix };
}

export async function getUserFromSession(
  authHeader: string | null
): Promise<{ userId: string; email: string }> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new GatewayError(
      "Missing or invalid Authorization header",
      401,
      "auth_required"
    );
  }

  const token = authHeader.slice(7);
  const sb = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: "Bearer " + token } },
  });

  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  if (error || !user) {
    throw new GatewayError("Invalid session token", 401, "invalid_session");
  }

  // Auto-provision gateway_users row if first time
  const admin = supabaseAdmin();
  const { data: existing } = await admin
    .from("gateway_users")
    .select("id")
    .eq("id", user.id)
    .single();

  if (!existing) {
    // Get free plan ID
    const { data: freePlan } = await admin
      .from("plans")
      .select("id")
      .eq("slug", "free")
      .single();

    await admin.from("gateway_users").insert({
      id: user.id,
      email: user.email,
      display_name: user.user_metadata?.full_name ?? user.email,
      plan_id: freePlan?.id,
      plan_slug: "free",
      credit_balance: 1.00, // $1 free starter credits
    });
  }

  return { userId: user.id, email: user.email ?? "" };
}

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};
