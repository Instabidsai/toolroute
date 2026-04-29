import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// Walk src/app/** and assert every numeric query-param read used as a
// list-size / pagination bound is BOTH clamped (Math.min) AND NaN-guarded
// (Number.isFinite). Without both, an anon attacker can hit
// `?limit=999999999` (DB scan / bandwidth) or `?limit=abc` → NaN
// (Postgres LIMIT NaN; either coerces to "no limit" or 500s the route).
//
// Lane 4.47 — the live probe that found this:
//   /api/search?q=a&limit=999999  → 200, 42KB (entire catalog)
//   /api/search?q=a&limit=abc     → 200, 42KB (NaN treated as unlimited)
//
// Lane 4.118 — scope broadened from src/app/api/ to src/app/** to cover
// non-/api route handlers (mcp, auth/callback, llms*.txt). Pre-extension
// audit confirmed no current pagination usage in non-/api routes; this
// locks in coverage for future drift. Sibling to Lane 4.116/4.117.

const APP_ROOT = join(process.cwd(), "src", "app");
const PAGINATION_PARAMS =
  /searchParams\.get\(\s*['"`](limit|offset|page|page_size|per_page|days|count|size)['"`]\s*\)/;
// Detect parseInt result flowing somewhere — used to find files that DO
// integer-parse a query param (so we can require clamping).
const PARSE_INT_QUERY =
  /parseInt\(\s*[^)]*searchParams\.get\(\s*['"`](limit|offset|page|page_size|per_page|days|count|size)['"`]/;

const REQUIRED_CLAMP = /Math\.min\s*\(/;
const REQUIRED_FINITE = /Number\.isFinite\s*\(/;

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      walk(path, out);
    } else if (/\.(ts|tsx)$/.test(name)) {
      out.push(path);
    }
  }
  return out;
}

describe("pagination clamping (Lane 4.47 + 4.118 — src/app/**)", () => {
  it("every route that integer-parses a pagination param clamps it AND guards NaN", () => {
    const violations: { file: string; reason: string }[] = [];
    for (const file of walk(APP_ROOT)) {
      const content = readFileSync(file, "utf8");
      if (!PAGINATION_PARAMS.test(content)) continue;
      if (!PARSE_INT_QUERY.test(content)) continue;
      const rel = relative(process.cwd(), file);
      if (!REQUIRED_CLAMP.test(content)) {
        violations.push({
          file: rel,
          reason: "missing Math.min clamp on parsed pagination value",
        });
      }
      if (!REQUIRED_FINITE.test(content)) {
        violations.push({
          file: rel,
          reason:
            "missing Number.isFinite guard — `?limit=abc` parses to NaN, " +
            "Math.min(NaN, max) = NaN, Postgres LIMIT NaN is undefined behavior",
        });
      }
    }
    expect(
      violations,
      `\nLEAK: ${violations.length} pagination DoS vector(s).\n` +
        `\nIn each violating file, replace this pattern:\n` +
        `  const limit = parseInt(searchParams.get("limit") ?? "10", 10);\n` +
        `\nWith this:\n` +
        `  const rawLimit = parseInt(searchParams.get("limit") ?? "10", 10);\n` +
        `  const limit =\n` +
        `    Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX) : DEFAULT;\n` +
        `\nViolations:\n` +
        violations
          .map((v) => `  - ${v.file}\n      ${v.reason}`)
          .join("\n")
    ).toEqual([]);
  });
});
