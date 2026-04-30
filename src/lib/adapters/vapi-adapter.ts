import type { ToolAdapter, AdapterResult } from "../gateway-types";
import { fetchWithTimeout } from "../fetch-with-timeout";
import { redactCreds } from "../redact-creds";

const BASE_URL = "https://api.vapi.ai";

function getApiKey(byokKey?: string): string | null {
  return byokKey || process.env.VAPI_API_KEY || null;
}

export const vapiAdapter: ToolAdapter = {
  slug: "vapi",
  name: "Vapi",
  description:
    "Voice AI agents — create and manage AI phone calls with assistants",
  operations: ["create-call", "list-calls", "get-call", "list-assistants"],

  async execute(
    operation: string,
    input: Record<string, unknown>,
    byokKey?: string
  ): Promise<AdapterResult> {
    const apiKey = getApiKey(byokKey);
    if (!apiKey) {
      return {
        success: false,
        error:
          "No API key configured. Set VAPI_API_KEY or provide your own key via BYOK.",
        provider: "vapi",
      };
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };

    try {
      if (operation === "create-call") {
        const assistantId = input.assistant_id as string;
        const phoneNumberId = input.phone_number_id as string;
        const customer = input.customer as
          | { number: string }
          | undefined;

        if (!assistantId) {
          return {
            success: false,
            error: "Missing required field: assistant_id",
            provider: "vapi",
          };
        }

        const body: Record<string, unknown> = {
          assistantId,
        };
        if (phoneNumberId) body.phoneNumberId = phoneNumberId;
        if (customer) body.customer = customer;

        const res = await fetchWithTimeout(`${BASE_URL}/call`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          timeoutMs: 30_000,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Vapi create-call failed: ${res.status} ${errText}`),
            provider: "vapi",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data,
          provider: "vapi",
          units_consumed: 1,
        };
      }

      if (operation === "list-calls") {
        const limit = (input.limit as number) || 10;
        const params = new URLSearchParams({ limit: String(limit) });

        const res = await fetchWithTimeout(`${BASE_URL}/call?${params}`, {
          headers: { Authorization: `Bearer ${apiKey}` },
          timeoutMs: 15_000,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Vapi list-calls failed: ${res.status} ${errText}`),
            provider: "vapi",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data,
          provider: "vapi",
          units_consumed: 1,
        };
      }

      if (operation === "get-call") {
        const callId = input.call_id as string;
        if (!callId) {
          return {
            success: false,
            error: "Missing required field: call_id",
            provider: "vapi",
          };
        }

        const res = await fetchWithTimeout(`${BASE_URL}/call/${callId}`, {
          headers: { Authorization: `Bearer ${apiKey}` },
          timeoutMs: 15_000,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Vapi get-call failed: ${res.status} ${errText}`),
            provider: "vapi",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data,
          provider: "vapi",
          units_consumed: 1,
        };
      }

      if (operation === "list-assistants") {
        const limit = (input.limit as number) || 10;
        const params = new URLSearchParams({ limit: String(limit) });

        const res = await fetchWithTimeout(`${BASE_URL}/assistant?${params}`, {
          headers: { Authorization: `Bearer ${apiKey}` },
          timeoutMs: 15_000,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Vapi list-assistants failed: ${res.status} ${errText}`),
            provider: "vapi",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data,
          provider: "vapi",
          units_consumed: 1,
        };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "vapi",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "vapi" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    const apiKey = getApiKey();
    if (!apiKey) {
      return { healthy: false, latency_ms: Date.now() - start };
    }

    try {
      const res = await fetchWithTimeout(`${BASE_URL}/call?limit=1`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeoutMs: 10_000,
      });
      return { healthy: res.ok, latency_ms: Date.now() - start };
    } catch {
      return { healthy: false, latency_ms: Date.now() - start };
    }
  },

  estimateCost(operation: string): number {
    if (operation === "create-call") return 0.05;
    return 0.001;
  },
};
