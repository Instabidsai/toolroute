import type { ToolAdapter, AdapterResult } from "../gateway-types";
import { fetchWithTimeout } from "../fetch-with-timeout";

const BASE_URL = "https://api.apollo.io/api/v1";

function getApiKey(byokKey?: string): string | null {
  return byokKey || process.env.APOLLO_API_KEY || null;
}

export const apolloAdapter: ToolAdapter = {
  slug: "apollo",
  name: "Apollo.io",
  description:
    "Contact enrichment and prospecting — search people, enrich contacts, and find companies",
  operations: ["search-people", "enrich", "search-companies"],

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
          "No API key configured. Set APOLLO_API_KEY or provide your own key via BYOK.",
        provider: "apollo",
      };
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    try {
      if (operation === "search-people") {
        const body: Record<string, unknown> = {
          api_key: apiKey,
        };
        if (input.person_titles)
          body.person_titles = input.person_titles;
        if (input.person_locations)
          body.person_locations = input.person_locations;
        if (input.q_organization_name)
          body.q_organization_name = input.q_organization_name;
        if (input.per_page) body.per_page = input.per_page;
        if (input.page) body.page = input.page;

        const res = await fetchWithTimeout(`${BASE_URL}/mixed_people/search`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          timeoutMs: 20_000,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: `Apollo search-people failed: ${res.status} ${errText}`,
            provider: "apollo",
          };
        }

        const data = await res.json();
        const people = (data.people ?? []).map(
          (p: Record<string, unknown>) => ({
            id: p.id,
            first_name: p.first_name,
            last_name: p.last_name,
            name: p.name,
            title: p.title,
            email: p.email,
            linkedin_url: p.linkedin_url,
            organization: (p.organization as Record<string, unknown>)?.name,
            city: p.city,
            state: p.state,
            country: p.country,
          })
        );

        return {
          success: true,
          data: {
            people,
            total_entries: data.pagination?.total_entries,
            page: data.pagination?.page,
          },
          provider: "apollo",
          units_consumed: 1,
        };
      }

      if (operation === "enrich") {
        const body: Record<string, unknown> = {
          api_key: apiKey,
        };
        if (input.email) body.email = input.email;
        if (input.first_name) body.first_name = input.first_name;
        if (input.last_name) body.last_name = input.last_name;
        if (input.domain) body.domain = input.domain;
        if (input.linkedin_url) body.linkedin_url = input.linkedin_url;

        const res = await fetchWithTimeout(`${BASE_URL}/people/match`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          timeoutMs: 20_000,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: `Apollo enrich failed: ${res.status} ${errText}`,
            provider: "apollo",
          };
        }

        const data = await res.json();
        const person = data.person;
        return {
          success: true,
          data: person
            ? {
                id: person.id,
                first_name: person.first_name,
                last_name: person.last_name,
                name: person.name,
                title: person.title,
                email: person.email,
                linkedin_url: person.linkedin_url,
                organization: person.organization?.name,
                phone_numbers: person.phone_numbers,
                city: person.city,
                state: person.state,
                country: person.country,
              }
            : null,
          provider: "apollo",
          units_consumed: 1,
        };
      }

      if (operation === "search-companies") {
        const body: Record<string, unknown> = {
          api_key: apiKey,
        };
        if (input.q_organization_name)
          body.q_organization_name = input.q_organization_name;
        if (input.organization_locations)
          body.organization_locations = input.organization_locations;
        if (input.per_page) body.per_page = input.per_page;
        if (input.page) body.page = input.page;

        const res = await fetchWithTimeout(`${BASE_URL}/mixed_companies/search`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          timeoutMs: 20_000,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: `Apollo search-companies failed: ${res.status} ${errText}`,
            provider: "apollo",
          };
        }

        const data = await res.json();
        const organizations = (data.organizations ?? []).map(
          (o: Record<string, unknown>) => ({
            id: o.id,
            name: o.name,
            website_url: o.website_url,
            linkedin_url: o.linkedin_url,
            estimated_num_employees: o.estimated_num_employees,
            industry: o.industry,
            city: o.city,
            state: o.state,
            country: o.country,
          })
        );

        return {
          success: true,
          data: {
            organizations,
            total_entries: data.pagination?.total_entries,
            page: data.pagination?.page,
          },
          provider: "apollo",
          units_consumed: 1,
        };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "apollo",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "apollo" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    const apiKey = getApiKey();
    if (!apiKey) {
      return { healthy: false, latency_ms: Date.now() - start };
    }

    try {
      const res = await fetchWithTimeout(`${BASE_URL}/mixed_people/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          per_page: 1,
          person_titles: ["CEO"],
        }),
        timeoutMs: 10_000,
      });
      return { healthy: res.ok, latency_ms: Date.now() - start };
    } catch {
      return { healthy: false, latency_ms: Date.now() - start };
    }
  },

  estimateCost(operation: string): number {
    if (operation === "enrich") return 0.03;
    return 0.01;
  },
};
