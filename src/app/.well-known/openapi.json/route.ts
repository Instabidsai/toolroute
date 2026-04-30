import { NextResponse } from "next/server";
import { buildOpenApiSpec, discoveryHeaders } from "@/lib/agent-discovery";

export async function GET() {
  return NextResponse.json(buildOpenApiSpec(), {
    headers: discoveryHeaders(),
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: discoveryHeaders(),
  });
}
