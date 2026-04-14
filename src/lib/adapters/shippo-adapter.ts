import type { ToolAdapter, AdapterResult } from "../gateway-types";

const BASE_URL = "https://api.goshippo.com";

function getApiKey(byokKey?: string): string | null {
  return byokKey || process.env.SHIPPO_API_KEY || null;
}

export const shippoAdapter: ToolAdapter = {
  slug: "shippo",
  name: "Shippo",
  description:
    "Shipping labels and tracking — create shipments, get rates, print labels, and track packages",
  operations: ["create-shipment", "get-rates", "create-label", "track"],

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
          "No API key configured. Set SHIPPO_API_KEY or provide your own key via BYOK.",
        provider: "shippo",
      };
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `ShippoToken ${apiKey}`,
    };

    try {
      if (operation === "create-shipment") {
        const addressFrom = input.address_from as Record<string, unknown>;
        const addressTo = input.address_to as Record<string, unknown>;
        const parcels = input.parcels as Record<string, unknown>[];

        if (!addressFrom || !addressTo || !parcels) {
          return {
            success: false,
            error:
              "Missing required fields: address_from, address_to, parcels",
            provider: "shippo",
          };
        }

        const res = await fetch(`${BASE_URL}/shipments`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            address_from: addressFrom,
            address_to: addressTo,
            parcels,
            async: false,
          }),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: `Shippo create-shipment failed: ${res.status} ${errText}`,
            provider: "shippo",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data: {
            object_id: data.object_id,
            status: data.status,
            address_from: data.address_from,
            address_to: data.address_to,
            parcels: data.parcels,
            rates: (data.rates ?? []).map(
              (r: Record<string, unknown>) => ({
                object_id: r.object_id,
                provider: r.provider,
                servicelevel: r.servicelevel,
                amount: r.amount,
                currency: r.currency,
                estimated_days: r.estimated_days,
                duration_terms: r.duration_terms,
              })
            ),
          },
          provider: "shippo",
          units_consumed: 1,
        };
      }

      if (operation === "get-rates") {
        const shipmentId = input.shipment_id as string;
        if (!shipmentId) {
          return {
            success: false,
            error: "Missing required field: shipment_id",
            provider: "shippo",
          };
        }

        const res = await fetch(
          `${BASE_URL}/shipments/${shipmentId}/rates`,
          {
            headers: { Authorization: `ShippoToken ${apiKey}` },
          }
        );

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: `Shippo get-rates failed: ${res.status} ${errText}`,
            provider: "shippo",
          };
        }

        const data = await res.json();
        const rates = (data.results ?? []).map(
          (r: Record<string, unknown>) => ({
            object_id: r.object_id,
            provider: r.provider,
            servicelevel: r.servicelevel,
            amount: r.amount,
            currency: r.currency,
            estimated_days: r.estimated_days,
            duration_terms: r.duration_terms,
          })
        );

        return {
          success: true,
          data: { rates },
          provider: "shippo",
          units_consumed: 1,
        };
      }

      if (operation === "create-label") {
        const rateId = input.rate_id as string;
        if (!rateId) {
          return {
            success: false,
            error: "Missing required field: rate_id",
            provider: "shippo",
          };
        }

        const res = await fetch(`${BASE_URL}/transactions`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            rate: rateId,
            label_file_type: "PDF",
            async: false,
          }),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: `Shippo create-label failed: ${res.status} ${errText}`,
            provider: "shippo",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data: {
            object_id: data.object_id,
            status: data.status,
            tracking_number: data.tracking_number,
            tracking_url_provider: data.tracking_url_provider,
            label_url: data.label_url,
            rate: data.rate,
          },
          provider: "shippo",
          units_consumed: 1,
        };
      }

      if (operation === "track") {
        const carrier = input.carrier as string;
        const trackingNumber = input.tracking_number as string;

        if (!carrier || !trackingNumber) {
          return {
            success: false,
            error: "Missing required fields: carrier, tracking_number",
            provider: "shippo",
          };
        }

        const res = await fetch(
          `${BASE_URL}/tracks/${carrier}/${trackingNumber}`,
          {
            headers: { Authorization: `ShippoToken ${apiKey}` },
          }
        );

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: `Shippo track failed: ${res.status} ${errText}`,
            provider: "shippo",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data: {
            carrier: data.carrier,
            tracking_number: data.tracking_number,
            tracking_status: data.tracking_status,
            tracking_history: data.tracking_history,
            eta: data.eta,
            address_from: data.address_from,
            address_to: data.address_to,
          },
          provider: "shippo",
          units_consumed: 1,
        };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "shippo",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "shippo" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    const apiKey = getApiKey();
    if (!apiKey) {
      return { healthy: false, latency_ms: Date.now() - start };
    }

    try {
      const res = await fetch(`${BASE_URL}/shipments?results=1`, {
        headers: { Authorization: `ShippoToken ${apiKey}` },
      });
      return { healthy: res.ok, latency_ms: Date.now() - start };
    } catch {
      return { healthy: false, latency_ms: Date.now() - start };
    }
  },

  estimateCost(operation: string): number {
    if (operation === "create-label") return 0.05;
    if (operation === "create-shipment" || operation === "get-rates")
      return 0.005;
    if (operation === "track") return 0.001;
    return 0.005;
  },
};
