import { NextRequest, NextResponse } from "next/server";
import { listAdapters } from "@/lib/adapters/index";
import { assertBodyUnder, BODY_LIMITS } from "@/lib/body-limit";
import { GatewayError } from "@/lib/gateway-types";
import {
  BYOK_REQUIRED_SLUGS,
  BYOK_INSUFFICIENT_SLUGS,
} from "@/lib/byok-required-slugs";

function byokSuffix(slug: string): string {
  if (BYOK_REQUIRED_SLUGS.has(slug)) return " (BYOK required)";
  if (BYOK_INSUFFICIENT_SLUGS.has(slug)) return " (BYOK required)";
  return "";
}

// JSON-RPC types
interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

const MCP_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id",
};

export async function POST(request: NextRequest) {
  try {
    assertBodyUnder(request, BODY_LIMITS.mcp);
  } catch (err) {
    if (err instanceof GatewayError) {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: { code: -32600, message: err.message },
        },
        { status: err.status, headers: MCP_CORS }
      );
    }
    throw err;
  }

  let body: JsonRpcRequest;
  try {
    body = (await request.json()) as JsonRpcRequest;
  } catch {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error: invalid JSON" },
      },
      { status: 400, headers: MCP_CORS }
    );
  }

  const response: JsonRpcResponse = { jsonrpc: "2.0", id: body.id };

  switch (body.method) {
    case "initialize":
      response.result = {
        protocolVersion: "2025-03-26",
        capabilities: { tools: {} },
        serverInfo: {
          name: "ToolRoute",
          version: "1.0.0",
          description:
            "The OpenRouter for Tools — 51 adapters, 150+ operations via one API",
        },
      };
      break;

    case "tools/list": {
      const adapters = listAdapters();
      const tools = [];
      for (const adapter of adapters) {
        for (const op of adapter.operations) {
          tools.push({
            name: `${adapter.slug}/${op}`,
            description: `${adapter.name}: ${op}${byokSuffix(adapter.slug)}`,
            inputSchema: {
              type: "object" as const,
              properties: {
                input: {
                  type: "object" as const,
                  description: "Tool-specific input parameters",
                },
              },
              required: ["input"],
            },
          });
        }
      }
      response.result = { tools };
      break;
    }

    case "tools/call": {
      const params = body.params as
        | { name?: string; arguments?: Record<string, unknown> }
        | undefined;
      const toolName = params?.name;
      const args = params?.arguments;

      if (!toolName) {
        response.error = { code: -32602, message: "Missing tool name" };
        break;
      }

      // Check for API key in Authorization header
      const authHeader = request.headers.get("authorization");

      if (!authHeader || !authHeader.startsWith("Bearer tr_live_")) {
        response.error = {
          code: -32001,
          message:
            "API key required. Set Authorization: Bearer tr_live_xxx header. Get key at https://toolroute.ai/dashboard/keys",
        };
        break;
      }

      // Dynamic imports to avoid circular deps at module load time
      const { validateRequest, checkRateLimit, executeToolRequest } =
        await import("@/lib/gateway");
      const { GatewayError } = await import("@/lib/gateway-types");

      try {
        const ctx = await validateRequest(authHeader);
        await checkRateLimit(ctx);
        const input =
          (args?.input as Record<string, unknown>) ?? args ?? {};
        const result = await executeToolRequest(ctx, toolName, input);

        response.result = {
          content: [
            {
              type: "text",
              text: JSON.stringify(result.data ?? result, null, 2),
            },
          ],
          isError: !result.success,
          _meta: {
            tool: result.tool,
            provider: result.provider,
            latency_ms: result.latency_ms,
            cost: result.cost,
            request_id: result.request_id,
          },
        };
      } catch (err) {
        if (err instanceof GatewayError) {
          response.error = { code: err.status, message: err.message };
        } else {
          response.error = {
            code: -32603,
            message:
              err instanceof Error ? err.message : "Internal error",
          };
        }
      }
      break;
    }

    case "notifications/initialized":
      // Client notification — acknowledge silently
      response.result = {};
      break;

    default:
      response.error = {
        code: -32601,
        message: `Method not found: ${body.method}`,
      };
  }

  return NextResponse.json(response, { headers: MCP_CORS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: MCP_CORS });
}
