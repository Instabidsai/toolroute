import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Lane 4.10 — gateway COGS (cost_to_us) leak-class regression guard.
// Forbids cost_to_us references in customer-facing surfaces.
// Allowed: admin-only routes (guarded by validateAdmin + x-admin-secret) and
// the gateway write path (RPC arg only, no response selection).

const COGS_REGEX = /\bcost_to_us\b/;

const ALLOWED_FILES = new Set([
  "src/app/api/admin/stats/route.ts",
  "src/lib/gateway.ts",
]);

function* walkSourceFiles(dir: string, root = dir): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
    const full = join(dir, entry);
    const rel = full.slice(root.length + 1).replace(/\\/g, "/");
    if (statSync(full).isDirectory()) yield* walkSourceFiles(full, root);
    else if (/\.(ts|tsx|js|jsx)$/.test(entry)) yield rel;
  }
}

describe("Lane 4.10 — gateway COGS (cost_to_us) leak-class audit", () => {
  it("rejects cost_to_us references outside the admin allowlist", () => {
    const srcRoot = resolve(process.cwd(), "src");
    const offenders: string[] = [];

    for (const rel of walkSourceFiles(srcRoot)) {
      const fullRel = "src/" + rel;
      if (ALLOWED_FILES.has(fullRel)) continue;
      const body = readFileSync(join(srcRoot, rel), "utf-8");
      if (COGS_REGEX.test(body)) offenders.push(fullRel);
    }

    expect(offenders).toEqual([]);
  });

  it("verifies the admin route is the COGS response surface", () => {
    const adminRoute = readFileSync(
      resolve(process.cwd(), "src/app/api/admin/stats/route.ts"),
      "utf-8"
    );
    expect(adminRoute).toMatch(/cost_to_us/);
    expect(adminRoute).toMatch(/cogs/i);
  });

  it("verifies the admin route is guarded by validateAdmin + x-admin-secret", () => {
    const adminRoute = readFileSync(
      resolve(process.cwd(), "src/app/api/admin/stats/route.ts"),
      "utf-8"
    );
    expect(adminRoute).toMatch(/validateAdmin\(request\)/);
    expect(adminRoute).toMatch(/x-admin-secret/);
    expect(adminRoute).toMatch(/timingSafeEqual/);
  });
});
