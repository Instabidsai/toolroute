import { NextResponse } from "next/server";
import { CORS_HEADERS } from "@/lib/gateway";
import { buildAgentManifest } from "@/lib/agent-manifest";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await buildAgentManifest(), { headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
