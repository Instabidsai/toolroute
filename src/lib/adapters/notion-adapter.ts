import type { ToolAdapter, AdapterResult } from "../gateway-types";
import { redactCreds } from "../redact-creds";

const NOTION_BASE_URL = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

function getApiKey(byokKey?: string): string | null {
  return byokKey || process.env.NOTION_API_KEY || null;
}

function headers(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "Notion-Version": NOTION_VERSION,
  };
}

export const notionAdapter: ToolAdapter = {
  slug: "notion",
  name: "Notion",
  description:
    "Workspace — pages, databases, search, knowledge base. Used by millions of agents for notes and structured data.",
  operations: ["search", "get-page", "create-page", "query-database"],

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
          "No API key configured. Set NOTION_API_KEY or provide your own key via BYOK.",
        provider: "notion",
      };
    }

    const hdrs = headers(apiKey);

    try {
      if (operation === "search") {
        const query = input.query as string;
        if (!query) {
          return {
            success: false,
            error: "Missing required field: query",
            provider: "notion",
          };
        }

        const body: Record<string, unknown> = { query };
        if (input.filter) {
          body.filter = { property: "object", value: input.filter };
        }

        const res = await fetch(`${NOTION_BASE_URL}/search`, {
          method: "POST",
          headers: hdrs,
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Notion search failed: ${res.status} ${errText}`),
            provider: "notion",
          };
        }

        const data = await res.json();
        return { success: true, data, provider: "notion", units_consumed: 1 };
      }

      if (operation === "get-page") {
        const pageId = input.page_id as string;
        if (!pageId) {
          return {
            success: false,
            error: "Missing required field: page_id",
            provider: "notion",
          };
        }

        const res = await fetch(`${NOTION_BASE_URL}/pages/${pageId}`, {
          method: "GET",
          headers: hdrs,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Notion get-page failed: ${res.status} ${errText}`),
            provider: "notion",
          };
        }

        const data = await res.json();
        return { success: true, data, provider: "notion", units_consumed: 1 };
      }

      if (operation === "create-page") {
        const parentId = input.parent_id as string;
        const title = input.title as string;
        if (!parentId || !title) {
          return {
            success: false,
            error: "Missing required fields: parent_id, title",
            provider: "notion",
          };
        }

        // Determine if parent is a database or page
        const parentKey = (input.parent_type === "database" || parentId.length === 32)
          ? "database_id"
          : "page_id";

        const body: Record<string, unknown> = {
          parent: { [parentKey]: parentId },
          properties: {
            title: [{ text: { content: title } }],
          },
        };

        if (input.content) {
          body.children = [
            {
              type: "paragraph",
              paragraph: {
                rich_text: [{ text: { content: input.content as string } }],
              },
            },
          ];
        }

        const res = await fetch(`${NOTION_BASE_URL}/pages`, {
          method: "POST",
          headers: hdrs,
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Notion create-page failed: ${res.status} ${errText}`),
            provider: "notion",
          };
        }

        const data = await res.json();
        return { success: true, data, provider: "notion", units_consumed: 1 };
      }

      if (operation === "query-database") {
        const databaseId = input.database_id as string;
        if (!databaseId) {
          return {
            success: false,
            error: "Missing required field: database_id",
            provider: "notion",
          };
        }

        const body: Record<string, unknown> = {};
        if (input.filter) body.filter = input.filter;
        if (input.sorts) body.sorts = input.sorts;

        const res = await fetch(
          `${NOTION_BASE_URL}/databases/${databaseId}/query`,
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
            error: redactCreds(`Notion query-database failed: ${res.status} ${errText}`),
            provider: "notion",
          };
        }

        const data = await res.json();
        return { success: true, data, provider: "notion", units_consumed: 1 };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "notion",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "notion" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    const apiKey = getApiKey();
    if (!apiKey) {
      return { healthy: false, latency_ms: Date.now() - start };
    }

    try {
      const res = await fetch(`${NOTION_BASE_URL}/search`, {
        method: "POST",
        headers: headers(apiKey),
        body: JSON.stringify({ query: "test", page_size: 1 }),
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
