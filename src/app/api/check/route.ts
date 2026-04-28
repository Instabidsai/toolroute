import { NextRequest, NextResponse } from "next/server";
import { checkBeforeBuild } from "@/lib/api";
import { assertBodyUnder, BODY_LIMITS } from "@/lib/body-limit";
import { GatewayError } from "@/lib/gateway-types";

export async function POST(request: NextRequest) {
  try {
    assertBodyUnder(request, BODY_LIMITS.check);
    const body = await request.json();
    const task = body.task || body.p_task;
    if (!task || typeof task !== "string") {
      return NextResponse.json(
        { error: "Missing 'task' field" },
        { status: 400 }
      );
    }
    const result = await checkBeforeBuild(task);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof GatewayError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: e.status }
      );
    }
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
