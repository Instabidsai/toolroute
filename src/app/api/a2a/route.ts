import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { assertBodyUnder, BODY_LIMITS } from "@/lib/body-limit";
import { GatewayError } from "@/lib/gateway-types";

// In-memory task store for status lookups
const taskStore = new Map<
  string,
  {
    id: string;
    status: { state: string };
    artifacts: { name: string; parts: { type: string; text: string }[] }[];
    created_at: string;
    updated_at: string;
  }
>();

// Clean old tasks every 100 new tasks (prevent memory leak)
let taskCount = 0;
function maybeCleanTasks() {
  taskCount++;
  if (taskCount % 100 === 0) {
    const cutoff = Date.now() - 60 * 60 * 1000; // 1 hour
    for (const [id, task] of taskStore) {
      if (new Date(task.created_at).getTime() < cutoff) {
        taskStore.delete(id);
      }
    }
  }
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

const A2A_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function POST(request: NextRequest) {
  try {
    assertBodyUnder(request, BODY_LIMITS.a2a);
  } catch (err) {
    if (err instanceof GatewayError) {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: { code: -32600, message: err.message },
        },
        { status: err.status, headers: A2A_CORS }
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
      { status: 400, headers: A2A_CORS }
    );
  }

  const response: JsonRpcResponse = { jsonrpc: "2.0", id: body.id };

  switch (body.method) {
    case "tasks/send": {
      const params = body.params as
        | {
            id?: string;
            message?: {
              role?: string;
              parts?: { type?: string; text?: string }[];
            };
          }
        | undefined;

      const taskId =
        params?.id ?? `task_${randomBytes(12).toString("hex")}`;
      const messageParts = params?.message?.parts ?? [];
      const textContent = messageParts
        .filter((p) => p.type === "text")
        .map((p) => p.text ?? "")
        .join("\n");

      if (!textContent) {
        response.error = {
          code: -32602,
          message: "Missing message content. Provide parts with type 'text'.",
        };
        break;
      }

      // Check for API key
      const authHeader = request.headers.get("authorization");
      if (!authHeader || !authHeader.startsWith("Bearer tr_live_")) {
        response.error = {
          code: -32001,
          message:
            "API key required. Set Authorization: Bearer tr_live_xxx header. Get key at https://toolroute.ai/dashboard/keys",
        };
        break;
      }

      const { validateRequest, checkRateLimit, executeToolRequest } =
        await import("@/lib/gateway");
      const { GatewayError } = await import("@/lib/gateway-types");

      try {
        const ctx = await validateRequest(authHeader);
        await checkRateLimit(ctx);

        // Use auto/route to let ToolRoute pick the best tool
        const result = await executeToolRequest(ctx, "auto/route", {
          task: textContent,
        });

        const now = new Date().toISOString();

        // Check if auto-router found a tool but execution failed (e.g. missing API key)
        const resultData = result.data as Record<string, unknown> | undefined;
        const executionFailed = resultData?.execution_failed === true;

        // Build artifacts -- if execution failed, include routing info as a separate artifact
        const artifacts: { name: string; parts: { type: string; text: string }[] }[] = [];

        if (executionFailed) {
          // Routing succeeded but execution failed -- still "completed" because we gave useful info
          artifacts.push({
            name: "routing",
            parts: [
              {
                type: "text",
                text: JSON.stringify(resultData?.routing ?? {}, null, 2),
              },
            ],
          });
          artifacts.push({
            name: "recommendation",
            parts: [
              {
                type: "text",
                text: [
                  `Auto-router found the right tool but could not execute it.`,
                  `Error: ${resultData?.error ?? "Unknown"}`,
                  ``,
                  `Suggestions:`,
                  ...((resultData?.suggestions as string[]) ?? []).map(
                    (s: string) => `  - ${s}`
                  ),
                  ``,
                  `Free alternatives (no API key needed):`,
                  ...((resultData?.free_alternatives as { slug: string; name: string }[]) ?? []).map(
                    (a: { slug: string; name: string }) => `  - ${a.slug}: ${a.name}`
                  ),
                ].join("\n"),
              },
            ],
          });
        } else {
          artifacts.push({
            name: "result",
            parts: [
              {
                type: "text",
                text: JSON.stringify(
                  result.data ?? { error: result.error },
                  null,
                  2
                ),
              },
            ],
          });
        }

        const task = {
          id: taskId,
          // "completed" if routing succeeded (even if execution failed with helpful info)
          // "failed" only if routing itself failed
          status: {
            state: result.success ? "completed" : "failed",
          },
          artifacts,
          created_at: now,
          updated_at: now,
        };

        taskStore.set(taskId, task);
        maybeCleanTasks();

        response.result = task;
      } catch (err) {
        const now = new Date().toISOString();
        const errMsg =
          err instanceof GatewayError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Internal error";

        const task = {
          id: taskId,
          status: { state: "failed" },
          artifacts: [
            {
              name: "error",
              parts: [{ type: "text", text: errMsg }],
            },
          ],
          created_at: now,
          updated_at: now,
        };

        taskStore.set(taskId, task);
        maybeCleanTasks();

        response.result = task;
      }
      break;
    }

    case "tasks/get": {
      const params = body.params as { id?: string } | undefined;
      const taskId = params?.id;

      if (!taskId) {
        response.error = { code: -32602, message: "Missing task id" };
        break;
      }

      const task = taskStore.get(taskId);
      if (!task) {
        response.error = {
          code: -32602,
          message: `Task not found: ${taskId}`,
        };
        break;
      }

      response.result = task;
      break;
    }

    case "tasks/cancel": {
      const params = body.params as { id?: string } | undefined;
      const taskId = params?.id;

      if (!taskId) {
        response.error = { code: -32602, message: "Missing task id" };
        break;
      }

      const task = taskStore.get(taskId);
      if (!task) {
        response.error = {
          code: -32602,
          message: `Task not found: ${taskId}`,
        };
        break;
      }

      task.status = { state: "canceled" };
      task.updated_at = new Date().toISOString();

      response.result = task;
      break;
    }

    default:
      response.error = {
        code: -32601,
        message: `Method not found: ${body.method}. Supported: tasks/send, tasks/get, tasks/cancel`,
      };
  }

  return NextResponse.json(response, { headers: A2A_CORS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: A2A_CORS });
}
