import { NextResponse } from "next/server";
import { getTools } from "@/lib/api";

export async function GET() {
  try {
    const tools = await getTools();
    return NextResponse.json({ tools, count: tools.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
