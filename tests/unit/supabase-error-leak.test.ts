import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

// Lane 4.117 — broadened scope from src/app/api → src/app to cover non-/api
// route handlers (mcp, auth/callback, llms*.txt). Sibling pattern to Lane
// 4.116 (route-auth-coverage scope extension): Next.js App Router accepts
// route.ts anywhere under src/app/, so any drift test scoped to
// src/app/api/ has a write-time scope-claim gap.
const APP_ROOT = resolve(process.cwd(), "src", "app");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = `${dir}${sep}${entry}`;
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
    } else if (entry === "route.ts" || entry === "route.tsx") {
      out.push(full);
    }
  }
  return out;
}

describe("Supabase RPC error.message leak guard (Lane 4.117 — src/app/**/route.ts)", () => {
  const offenders: { file: string; line: number; snippet: string }[] = [];

  const files = walk(APP_ROOT);

  for (const file of files) {
    const src = readFileSync(file, "utf8");
    const lines = src.split("\n");

    lines.forEach((line, idx) => {
      // Match `message: error.message` returned to clients.
      // `err.message` (catch-block GatewayError) is intentional and safe.
      // We only flag the Supabase-style `error.message` pattern.
      if (/message:\s*error\.message/.test(line)) {
        offenders.push({
          file: file.replace(process.cwd(), ""),
          line: idx + 1,
          snippet: line.trim(),
        });
      }
    });
  }

  it("no route returns raw Supabase error.message to clients", () => {
    expect(
      offenders,
      [
        "Routes returning raw Supabase RPC/query error.message leak schema, RPC argument types, and RLS policy details.",
        "Replace with a generic client message and log the full error server-side via console.error.",
        "Pattern to fix:",
        '  if (error) {',
        '    console.error("<route> RPC error:", error.message);',
        '    return NextResponse.json(',
        '      { error: { message: "Operation failed", code: "rpc_error" } },',
        '      { status: 500, headers: CORS_HEADERS }',
        '    );',
        '  }',
        "",
        "Offenders:",
        ...offenders.map((o) => `  ${o.file}:${o.line}  ${o.snippet}`),
      ].join("\n")
    ).toEqual([]);
  });

  it("scanner found the api route tree (smoke test — guards against 0-files false-pass)", () => {
    expect(files.length).toBeGreaterThan(5);
  });
});
