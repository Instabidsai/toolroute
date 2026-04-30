import type { ToolAdapter, AdapterResult } from "../gateway-types";
import { fetchWithTimeout } from "../fetch-with-timeout";

const LINEAR_API_URL = "https://api.linear.app/graphql";

function getApiKey(byokKey?: string): string | null {
  return byokKey || process.env.LINEAR_API_KEY || null;
}

function headers(apiKey: string): Record<string, string> {
  return {
    Authorization: apiKey,
    "Content-Type": "application/json",
  };
}

async function graphql(
  apiKey: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<{ data?: unknown; errors?: Array<{ message: string }> }> {
  const res = await fetchWithTimeout(LINEAR_API_URL, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Linear API failed: ${res.status} ${errText}`);
  }

  return res.json();
}

export const linearAdapter: ToolAdapter = {
  slug: "linear",
  name: "Linear",
  description:
    "Project management — issues, projects, sprints, priorities. Built for engineering teams.",
  operations: ["create-issue", "list-issues", "update-issue", "list-projects"],

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
          "No API key configured. Set LINEAR_API_KEY or provide your own key via BYOK.",
        provider: "linear",
      };
    }

    try {
      if (operation === "create-issue") {
        const title = input.title as string;
        const teamId = input.team_id as string;
        if (!title || !teamId) {
          return {
            success: false,
            error: "Missing required fields: title, team_id",
            provider: "linear",
          };
        }

        const issueInput: Record<string, unknown> = {
          title,
          teamId,
        };
        if (input.description) issueInput.description = input.description;
        if (input.priority !== undefined) issueInput.priority = input.priority;
        if (input.assignee_id) issueInput.assigneeId = input.assignee_id;

        const result = await graphql(
          apiKey,
          `mutation CreateIssue($input: IssueCreateInput!) {
            issueCreate(input: $input) {
              success
              issue {
                id
                identifier
                title
                url
                priority
                state { name }
              }
            }
          }`,
          { input: issueInput }
        );

        if (result.errors?.length) {
          return {
            success: false,
            error: `Linear create-issue failed: ${result.errors.map((e) => e.message).join(", ")}`,
            provider: "linear",
          };
        }

        return {
          success: true,
          data: result.data,
          provider: "linear",
          units_consumed: 1,
        };
      }

      if (operation === "list-issues") {
        const first = (input.first as number) || 10;

        const variables: Record<string, unknown> = { first };
        if (input.filter) variables.filter = input.filter;

        // Build filter clause dynamically
        const filterParam = input.filter ? ", filter: $filter" : "";
        const filterVar = input.filter ? ", $filter: IssueFilter" : "";

        const result = await graphql(
          apiKey,
          `query ListIssues($first: Int${filterVar}) {
            issues(first: $first${filterParam}) {
              nodes {
                id
                identifier
                title
                state { name }
                priority
                assignee { name }
                url
                createdAt
              }
            }
          }`,
          variables
        );

        if (result.errors?.length) {
          return {
            success: false,
            error: `Linear list-issues failed: ${result.errors.map((e) => e.message).join(", ")}`,
            provider: "linear",
          };
        }

        return {
          success: true,
          data: result.data,
          provider: "linear",
          units_consumed: 1,
        };
      }

      if (operation === "update-issue") {
        const issueId = input.issue_id as string;
        if (!issueId) {
          return {
            success: false,
            error: "Missing required field: issue_id",
            provider: "linear",
          };
        }

        const updateInput: Record<string, unknown> = {};
        if (input.state_id) updateInput.stateId = input.state_id;
        if (input.priority !== undefined) updateInput.priority = input.priority;
        if (input.assignee_id) updateInput.assigneeId = input.assignee_id;

        if (Object.keys(updateInput).length === 0) {
          return {
            success: false,
            error:
              "No update fields provided. Use state_id, priority, or assignee_id.",
            provider: "linear",
          };
        }

        const result = await graphql(
          apiKey,
          `mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
            issueUpdate(id: $id, input: $input) {
              success
              issue {
                id
                identifier
                title
                url
                priority
                state { name }
                assignee { name }
              }
            }
          }`,
          { id: issueId, input: updateInput }
        );

        if (result.errors?.length) {
          return {
            success: false,
            error: `Linear update-issue failed: ${result.errors.map((e) => e.message).join(", ")}`,
            provider: "linear",
          };
        }

        return {
          success: true,
          data: result.data,
          provider: "linear",
          units_consumed: 1,
        };
      }

      if (operation === "list-projects") {
        const first = (input.first as number) || 10;

        const result = await graphql(
          apiKey,
          `query ListProjects($first: Int) {
            projects(first: $first) {
              nodes {
                id
                name
                state
                progress
                url
                startDate
                targetDate
              }
            }
          }`,
          { first }
        );

        if (result.errors?.length) {
          return {
            success: false,
            error: `Linear list-projects failed: ${result.errors.map((e) => e.message).join(", ")}`,
            provider: "linear",
          };
        }

        return {
          success: true,
          data: result.data,
          provider: "linear",
          units_consumed: 1,
        };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "linear",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "linear" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    const apiKey = getApiKey();
    if (!apiKey) {
      return { healthy: false, latency_ms: Date.now() - start };
    }

    try {
      const result = await graphql(apiKey, `{ viewer { id } }`);
      return {
        healthy: !result.errors?.length,
        latency_ms: Date.now() - start,
      };
    } catch {
      return { healthy: false, latency_ms: Date.now() - start };
    }
  },

  estimateCost(): number {
    return 0.002;
  },
};
