import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { assertBodyUnder, BODY_LIMITS } from "@/lib/body-limit";
import { GatewayError } from "@/lib/gateway-types";
import {
  hasToolRouteBearerToken,
  TOOLROUTE_KEY_HEADER_HINT,
} from "@/lib/toolroute-key-format";

// In-memory task store for status lookups.
// Lane 4.120 — every stored task carries `userId` so tasks/get + tasks/cancel
// can enforce ownership (closes Lane 4.89 IDOR; the audit memo shipped Apr 28
// but the implementation never landed and task #107 was wrongly marked complete).
const taskStore = new Map<
  string,
  {
    id: string;
    userId: string;
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
  "Cache-Control": "private, no-store",
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
      // Lane 4.120 — params.id intentionally not declared on this type;
      // the server always assigns task_id. Per Lane 4.89 fix Option A.
      const params = body.params as
        | {
            message?: {
              role?: string;
              parts?: { type?: string; text?: string }[];
            };
          }
        | undefined;

      // Lane 4.120 — always server-generate task_id. Customer-supplied IDs let
      // an attacker pre-claim predictable values ("task_1") that another
      // customer's client SDK might collide with, then read their artifact via
      // tasks/get. Per Lane 4.89 fix recommendation Option A.
      const taskId = `task_${randomBytes(12).toString("hex")}`;
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
      if (!hasToolRouteBearerToken(authHeader)) {
        response.error = {
          code: -32001,
          message: TOOLROUTE_KEY_HEADER_HINT,
        };
        break;
      }

      const { validateRequest, checkRateLimit, executeToolRequest } =
        await import("@/lib/gateway");
      const { GatewayError } = await import("@/lib/gateway-types");

      // Lane 4.120 — validate auth BEFORE the try/catch that owns task storage,
      // so a failed validateRequest never stores an unowned task.
      let ctx: Awaited<ReturnType<typeof validateRequest>>;
      try {
        ctx = await validateRequest(authHeader);
      } catch (err) {
        response.error = {
          code: -32001,
          message:
            err instanceof GatewayError
              ? err.message
              : err instanceof Error
                ? err.message
                : "Auth failed",
        };
        break;
      }

      try {
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
          userId: ctx.userId,
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
          userId: ctx.userId,
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

      // Lane 4.120 — require API key + ownership match. Without this, anyone
      // who learns or guesses a task_id can read another customer's artifacts.
      const authHeader = request.headers.get("authorization");
      if (!hasToolRouteBearerToken(authHeader)) {
        response.error = {
          code: -32001,
          message: TOOLROUTE_KEY_HEADER_HINT,
        };
        break;
      }

      const { validateRequest } = await import("@/lib/gateway");
      let getCtx;
      try {
        getCtx = await validateRequest(authHeader);
      } catch (err) {
        response.error = {
          code: -32001,
          message: err instanceof Error ? err.message : "Auth failed",
        };
        break;
      }

      const task = taskStore.get(taskId);
      // Same error message for not-found and not-owned: don't give callers an
      // enumeration oracle that distinguishes "exists, but yours" from "doesn't exist".
      if (!task || task.userId !== getCtx.userId) {
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

      // Lane 4.120 — same gate as tasks/get; without this, any caller can
      // cancel any in-flight task they can name (DoS the legitimate owner).
      const authHeader = request.headers.get("authorization");
      if (!hasToolRouteBearerToken(authHeader)) {
        response.error = {
          code: -32001,
          message: TOOLROUTE_KEY_HEADER_HINT,
        };
        break;
      }

      const { validateRequest } = await import("@/lib/gateway");
      let cancelCtx;
      try {
        cancelCtx = await validateRequest(authHeader);
      } catch (err) {
        response.error = {
          code: -32001,
          message: err instanceof Error ? err.message : "Auth failed",
        };
        break;
      }

      const task = taskStore.get(taskId);
      if (!task || task.userId !== cancelCtx.userId) {
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
