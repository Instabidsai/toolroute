import { NextRequest, NextResponse } from "next/server";
import { getKeyInfo, CORS_HEADERS } from "@/lib/gateway";
import { GatewayError } from "@/lib/gateway-types";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const info = await getKeyInfo(authHeader);

    return NextResponse.json(info, { headers: CORS_HEADERS });
  } catch (err) {
    if (err instanceof GatewayError) {
      return NextResponse.json(
        { error: { message: err.message, code: err.code } },
        { status: err.status, headers: CORS_HEADERS }
      );
    }

    console.error("Key info error:", err);
    return NextResponse.json(
      { error: { message: "Internal server error", code: "internal_error" } },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
