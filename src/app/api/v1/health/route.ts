import { NextResponse } from "next/server";
import { CORS_HEADERS } from "@/lib/gateway";
import { listAdapters } from "@/lib/adapters/index";

// Process started at module load
const BOOTED_AT = Date.now();

export async function GET() {
  const adapters = listAdapters();
  const operationCount = adapters.reduce(
    (acc, a) => acc + (a.operations?.length ?? 0),
    0
  );

  const uptimeSeconds = Math.round((Date.now() - BOOTED_AT) / 1000);

  return NextResponse.json(
    {
      status: "ok",
      service: "toolroute",
      version: "1.2.0",
      uptime_seconds: uptimeSeconds,
      booted_at: new Date(BOOTED_AT).toISOString(),
      timestamp: new Date().toISOString(),
      tools: {
        adapter_count: adapters.length,
        operation_count: operationCount,
      },
      endpoints: {
        execute: "https://toolroute.ai/api/v1/execute",
        mcp: "https://toolroute.ai/mcp",
        a2a: "https://toolroute.ai/api/a2a",
        catalog: "https://toolroute.ai/api/v1/tools",
      },
      discovery: {
        llms_txt: "https://toolroute.ai/llms.txt",
        openapi: "https://toolroute.ai/.well-known/openapi.json",
        ai_plugin: "https://toolroute.ai/.well-known/ai-plugin.json",
        mcp_manifest: "https://toolroute.ai/.well-known/mcp.json",
        agents_json: "https://toolroute.ai/agents.json",
      },
    },
    { headers: CORS_HEADERS }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
