import type { ToolAdapter, AdapterResult } from "../gateway-types";

const HUBSPOT_BASE_URL = "https://api.hubapi.com";

function getApiKey(byokKey?: string): string | null {
  return byokKey || process.env.HUBSPOT_ACCESS_TOKEN || null;
}

function headers(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

export const hubspotAdapter: ToolAdapter = {
  slug: "hubspot",
  name: "HubSpot CRM",
  description:
    "CRM — contacts, deals, pipeline, notes. The #1 requested CRM integration for AI agents.",
  operations: [
    "create-contact",
    "search-contacts",
    "create-deal",
    "list-deals",
    "create-note",
  ],

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
          "No API key configured. Set HUBSPOT_ACCESS_TOKEN or provide your own key via BYOK.",
        provider: "hubspot",
      };
    }

    const hdrs = headers(apiKey);

    try {
      if (operation === "create-contact") {
        const email = input.email as string;
        if (!email) {
          return {
            success: false,
            error: "Missing required field: email",
            provider: "hubspot",
          };
        }

        const properties: Record<string, unknown> = { email };
        if (input.firstname) properties.firstname = input.firstname;
        if (input.lastname) properties.lastname = input.lastname;
        if (input.phone) properties.phone = input.phone;
        if (input.company) properties.company = input.company;

        const res = await fetch(
          `${HUBSPOT_BASE_URL}/crm/v3/objects/contacts`,
          {
            method: "POST",
            headers: hdrs,
            body: JSON.stringify({ properties }),
          }
        );

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: `HubSpot create-contact failed: ${res.status} ${errText}`,
            provider: "hubspot",
          };
        }

        const data = await res.json();
        return { success: true, data, provider: "hubspot", units_consumed: 1 };
      }

      if (operation === "search-contacts") {
        const query = input.query as string;
        if (!query) {
          return {
            success: false,
            error: "Missing required field: query",
            provider: "hubspot",
          };
        }

        const body = {
          filterGroups: [
            {
              filters: [
                {
                  propertyName: "email",
                  operator: "CONTAINS_TOKEN",
                  value: query,
                },
              ],
            },
          ],
        };

        const res = await fetch(
          `${HUBSPOT_BASE_URL}/crm/v3/objects/contacts/search`,
          {
            method: "POST",
            headers: hdrs,
            body: JSON.stringify(body),
          }
        );

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: `HubSpot search-contacts failed: ${res.status} ${errText}`,
            provider: "hubspot",
          };
        }

        const data = await res.json();
        return { success: true, data, provider: "hubspot", units_consumed: 1 };
      }

      if (operation === "create-deal") {
        const dealname = input.dealname as string;
        if (!dealname) {
          return {
            success: false,
            error: "Missing required field: dealname",
            provider: "hubspot",
          };
        }

        const properties: Record<string, unknown> = {
          dealname,
          pipeline: (input.pipeline as string) || "default",
          dealstage: (input.dealstage as string) || "appointmentscheduled",
        };
        if (input.amount !== undefined) properties.amount = input.amount;

        const res = await fetch(
          `${HUBSPOT_BASE_URL}/crm/v3/objects/deals`,
          {
            method: "POST",
            headers: hdrs,
            body: JSON.stringify({ properties }),
          }
        );

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: `HubSpot create-deal failed: ${res.status} ${errText}`,
            provider: "hubspot",
          };
        }

        const data = await res.json();
        return { success: true, data, provider: "hubspot", units_consumed: 1 };
      }

      if (operation === "list-deals") {
        const limit = (input.limit as number) || 10;

        const res = await fetch(
          `${HUBSPOT_BASE_URL}/crm/v3/objects/deals?limit=${limit}`,
          {
            method: "GET",
            headers: hdrs,
          }
        );

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: `HubSpot list-deals failed: ${res.status} ${errText}`,
            provider: "hubspot",
          };
        }

        const data = await res.json();
        return { success: true, data, provider: "hubspot", units_consumed: 1 };
      }

      if (operation === "create-note") {
        const contactId = input.contact_id as string;
        const body = input.body as string;
        if (!contactId || !body) {
          return {
            success: false,
            error: "Missing required fields: contact_id, body",
            provider: "hubspot",
          };
        }

        // Step 1: Create the note
        const noteRes = await fetch(
          `${HUBSPOT_BASE_URL}/crm/v3/objects/notes`,
          {
            method: "POST",
            headers: hdrs,
            body: JSON.stringify({
              properties: {
                hs_note_body: body,
                hs_timestamp: new Date().toISOString(),
              },
            }),
          }
        );

        if (!noteRes.ok) {
          const errText = await noteRes.text().catch(() => noteRes.statusText);
          return {
            success: false,
            error: `HubSpot create-note failed: ${noteRes.status} ${errText}`,
            provider: "hubspot",
          };
        }

        const noteData = (await noteRes.json()) as { id: string };

        // Step 2: Associate note with contact
        const assocRes = await fetch(
          `${HUBSPOT_BASE_URL}/crm/v3/objects/notes/${noteData.id}/associations/contacts/${contactId}/note_to_contact`,
          {
            method: "PUT",
            headers: hdrs,
          }
        );

        if (!assocRes.ok) {
          const errText = await assocRes.text().catch(() => assocRes.statusText);
          return {
            success: false,
            error: `HubSpot associate note failed: ${assocRes.status} ${errText}`,
            provider: "hubspot",
            data: noteData, // Return the note even if association failed
          };
        }

        return {
          success: true,
          data: { ...noteData, associated_contact_id: contactId },
          provider: "hubspot",
          units_consumed: 1,
        };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "hubspot",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "hubspot" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    const apiKey = getApiKey();
    if (!apiKey) {
      return { healthy: false, latency_ms: Date.now() - start };
    }

    try {
      const res = await fetch(
        `${HUBSPOT_BASE_URL}/crm/v3/objects/contacts?limit=1`,
        {
          method: "GET",
          headers: headers(apiKey),
        }
      );
      return { healthy: res.ok, latency_ms: Date.now() - start };
    } catch {
      return { healthy: false, latency_ms: Date.now() - start };
    }
  },

  estimateCost(): number {
    return 0.003;
  },
};
