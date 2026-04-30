import { NextResponse } from "next/server";
import { buildAgentsJson, discoveryHeaders } from "@/lib/agent-discovery";

export async function GET() {
  return NextResponse.json(buildAgentsJson(), {
    headers: discoveryHeaders(),
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: discoveryHeaders(),
  });
}
