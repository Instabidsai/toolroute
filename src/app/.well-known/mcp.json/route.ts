import { NextResponse } from "next/server";
import { buildMcpManifest, discoveryHeaders } from "@/lib/agent-discovery";

export async function GET() {
  return NextResponse.json(buildMcpManifest(), {
    headers: discoveryHeaders(),
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: discoveryHeaders(),
  });
}
