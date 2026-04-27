import { readFile } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";
import { CORS_HEADERS } from "@/lib/gateway";

export async function GET() {
  const filePath = join(process.cwd(), "public", "openapi.json");
  const content = await readFile(filePath, "utf-8");

  return new NextResponse(content, {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
