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
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
