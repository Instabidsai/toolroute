import { NextRequest, NextResponse } from "next/server";
import { searchTools } from "@/lib/api";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");
  const limit = parseInt(
    request.nextUrl.searchParams.get("limit") || "10",
    10
  );

  if (!q) {
    return NextResponse.json(
      { error: "Missing 'q' query parameter" },
      { status: 400 }
    );
  }

  try {
    const results = await searchTools(q, limit);
    return NextResponse.json({ results, count: results.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
