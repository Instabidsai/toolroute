import { NextRequest, NextResponse } from "next/server";
import { CORS_HEADERS } from "@/lib/gateway";
import {
  getProviderSetupRequirement,
  getToolSetupRequirement,
  listProviderSetupRequirements,
  summarizeSetupRequirements,
} from "@/lib/provider-setup-requirements";

export async function GET(request: NextRequest) {
  const toolSlug = request.nextUrl.searchParams.get("tool_slug");
  const adapterSlug = request.nextUrl.searchParams.get("adapter_slug");

  if (toolSlug) {
    const requirement = getToolSetupRequirement(toolSlug);
    return NextResponse.json(
      {
        mode: "tool",
        requested_slug: toolSlug,
        requirement,
      },
      { headers: CORS_HEADERS }
    );
  }

  if (adapterSlug) {
    const requirement = getProviderSetupRequirement(adapterSlug);
    return NextResponse.json(
      {
        mode: "adapter",
        requested_slug: adapterSlug,
        requirement,
      },
      { headers: CORS_HEADERS }
    );
  }

  const requirements = listProviderSetupRequirements();
  return NextResponse.json(
    {
      mode: "all",
      summary: summarizeSetupRequirements(requirements),
      providers: requirements,
    },
    { headers: CORS_HEADERS }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
