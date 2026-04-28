import { NextRequest, NextResponse } from "next/server";
import { searchTools } from "@/lib/api";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
const MAX_QUERY_LENGTH = 200;

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");
  const rawLimit = parseInt(
    request.nextUrl.searchParams.get("limit") ?? `${DEFAULT_LIMIT}`,
    10
  );
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, MAX_LIMIT)
      : DEFAULT_LIMIT;

  if (!q) {
    return NextResponse.json(
      { error: "Missing 'q' query parameter" },
      { status: 400 }
    );
  }
  if (q.length > MAX_QUERY_LENGTH) {
    return NextResponse.json(
      { error: `'q' must be ${MAX_QUERY_LENGTH} characters or fewer` },
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
