import { NextRequest, NextResponse } from "next/server";
import { checkBeforeBuild } from "@/lib/api";

export async function POST(request: NextRequest) {
  try {
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
    // Don't leak raw PostgrestError.message (DB structure, RPC names, columns)
    // to public unauth callers. Log for ops, return generic to caller.
    console.error("api/check error:", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
