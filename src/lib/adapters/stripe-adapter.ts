import type { ToolAdapter, AdapterResult } from "../gateway-types";
import { fetchWithTimeout } from "../fetch-with-timeout";
import { redactCreds } from "../redact-creds";

const BASE_URL = "https://api.stripe.com/v1";

function getApiKey(byokKey?: string): string | null {
  return byokKey || process.env.STRIPE_PLATFORM_KEY || null;
}

export const stripeAdapter: ToolAdapter = {
  slug: "stripe",
  name: "Stripe",
  description:
    "Stripe payment operations — list customers, create payment links, list products, and check balance",
  operations: ["list-customers", "create-payment-link", "list-products", "get-balance"],

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
          "No API key configured. Provide your own key via BYOK or set STRIPE_PLATFORM_KEY.",
        provider: "stripe",
      };
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
    };

    try {
      if (operation === "list-customers") {
        const limit = (input.limit as number) ?? 10;
        const url = `${BASE_URL}/customers?limit=${limit}`;

        const res = await fetchWithTimeout(url, { method: "GET", headers, timeoutMs: 15_000 });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Stripe list-customers failed: ${res.status} ${errText}`),
            provider: "stripe",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data,
          provider: "stripe",
          units_consumed: 1,
        };
      }

      if (operation === "create-payment-link") {
        const lineItems = input.line_items as Array<{
          price: string;
          quantity: number;
        }>;
        if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
          return {
            success: false,
            error:
              "Missing required field: line_items (array of {price, quantity})",
            provider: "stripe",
          };
        }

        const params = new URLSearchParams();
        lineItems.forEach((item, i) => {
          params.append(`line_items[${i}][price]`, item.price);
          params.append(
            `line_items[${i}][quantity]`,
            String(item.quantity ?? 1)
          );
        });

        if (input.after_completion_url) {
          params.append(
            "after_completion[type]",
            "redirect"
          );
          params.append(
            "after_completion[redirect][url]",
            input.after_completion_url as string
          );
        }

        const res = await fetchWithTimeout(`${BASE_URL}/payment_links`, {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
          timeoutMs: 20_000,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Stripe create-payment-link failed: ${res.status} ${errText}`),
            provider: "stripe",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data,
          provider: "stripe",
          units_consumed: 1,
        };
      }

      if (operation === "list-products") {
        const limit = (input.limit as number) ?? 10;
        const url = `${BASE_URL}/products?limit=${limit}&active=true`;

        const res = await fetchWithTimeout(url, { method: "GET", headers, timeoutMs: 15_000 });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Stripe list-products failed: ${res.status} ${errText}`),
            provider: "stripe",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data,
          provider: "stripe",
          units_consumed: 1,
        };
      }

      if (operation === "get-balance") {
        const res = await fetchWithTimeout(`${BASE_URL}/balance`, {
          method: "GET",
          headers,
          timeoutMs: 10_000,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Stripe get-balance failed: ${res.status} ${errText}`),
            provider: "stripe",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data,
          provider: "stripe",
          units_consumed: 1,
        };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "stripe",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "stripe" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    const apiKey = getApiKey();
    if (!apiKey) {
      return { healthy: false, latency_ms: Date.now() - start };
    }

    try {
      const res = await fetchWithTimeout(`${BASE_URL}/balance`, {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
        timeoutMs: 10_000,
      });
      return { healthy: res.ok, latency_ms: Date.now() - start };
    } catch {
      return { healthy: false, latency_ms: Date.now() - start };
    }
  },

  estimateCost(): number {
    return 0.002;
  },
};
