export class GatewayError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string
  ) {
    super(message);
    this.name = "GatewayError";
  }
}

export interface GatewayContext {
  userId: string;
  keyId: string;
  keyName: string;
  planSlug: string;
  creditBalance: number;
  rateLimitRpm: number;
  rateLimitRpd: number;
  allowedTools: string[] | null;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  tool: string;
  provider: string;
  latency_ms: number;
  cost: number;
  request_id: string;
}

export interface ToolPricing {
  toolSlug: string;
  baseCostPerCall: number;
  perUnitCost: number;
  unit: string;
  freeCallsPerDay: number;
}

export interface Plan {
  id: string;
  slug: string;
  name: string;
  credits_per_month: number;
  rate_limit_rpm: number;
  rate_limit_rpd: number;
  price_cents: number;
  features: string[];
  created_at: string;
}

export interface GatewayUser {
  id: string;
  email: string;
  plan_slug: string;
  credit_balance: number;
  created_at: string;
  updated_at: string;
}

export interface ApiKey {
  id: string;
  user_id: string;
  name: string;
  key_hash: string;
  key_prefix: string;
  allowed_tools: string[] | null;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  amount: number;
  type: "purchase" | "usage" | "refund" | "bonus";
  description: string;
  reference_id: string | null;
  created_at: string;
}

export interface UsageLogEntry {
  id: string;
  user_id: string;
  key_id: string;
  tool_slug: string;
  operation: string;
  status: number;
  latency_ms: number;
  cost: number;
  error: string | null;
  request_id: string;
  created_at: string;
}

export interface AdapterResult {
  success: boolean;
  data?: unknown;
  error?: string;
  provider: string;
  units_consumed?: number;
}

export interface ToolAdapter {
  slug: string;
  name: string;
  description: string;
  operations: string[];
  execute(
    operation: string,
    input: Record<string, unknown>,
    byokKey?: string
  ): Promise<AdapterResult>;
  healthCheck(): Promise<{ healthy: boolean; latency_ms: number }>;
  estimateCost(operation: string, input: Record<string, unknown>): number;
}

export interface ExecuteRequest {
  tool: string;
  input: Record<string, unknown>;
  provider?: {
    prefer?: string;
    allow_fallbacks?: boolean;
    max_price?: number;
    max_latency_ms?: number;
  };
}
