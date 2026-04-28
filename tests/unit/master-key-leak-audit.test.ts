import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Lane 4.12 regression guard — sibling to Lane 4.10's cogs-leak-audit.test.ts.
 *
 * Fails if either of these credential columns appears in any source file
 * outside an explicit allowlist:
 *
 *   - tool_providers.auth_key_encrypted   (master pool keys)
 *   - byok_provider_keys.api_key_encrypted (customer BYOK keys)
 *
 * If a future PR adds `select("*")` or surfaces these columns in a
 * customer-facing route, this test fails before it can ship.
 */

const ROOT = process.cwd();
const SRC = resolve(ROOT, "src");

const MASTER_KEY_REGEX = /\bauth_key_encrypted\b/;
const BYOK_KEY_REGEX = /\bapi_key_encrypted\b/;

const MASTER_KEY_ALLOWLIST = new Set([
  // Internal read path (never on response wire, consumed as resolvedKey)
  "src/lib/gateway.ts",
  // Admin-guarded write path (validateAdmin + x-admin-secret)
  "src/app/api/admin/providers/route.ts",
]);

const BYOK_KEY_ALLOWLIST = new Set([
  // Internal read path (BYOK lookup inside executeAdapter)
  "src/lib/gateway.ts",
  // Customer-authenticated write path (registers their own key)
  "src/app/api/v1/byok/route.ts",
]);

function walkSrc(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walkSrc(full, files);
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      files.push(full);
    }
  }
  return files;
}

function relPosix(absPath: string): string {
  return relative(ROOT, absPath).split(sep).join("/");
}

describe("master/byok key leak-class audit", () => {
  it("auth_key_encrypted (master pool) only appears in allowlisted files", () => {
    const violations: string[] = [];
    for (const file of walkSrc(SRC)) {
      const rel = relPosix(file);
      if (MASTER_KEY_ALLOWLIST.has(rel)) continue;
      if (MASTER_KEY_REGEX.test(readFileSync(file, "utf8"))) {
        violations.push(rel);
      }
    }
    expect(violations).toEqual([]);
  });

  it("api_key_encrypted (BYOK) only appears in allowlisted files", () => {
    const violations: string[] = [];
    for (const file of walkSrc(SRC)) {
      const rel = relPosix(file);
      if (BYOK_KEY_ALLOWLIST.has(rel)) continue;
      if (BYOK_KEY_REGEX.test(readFileSync(file, "utf8"))) {
        violations.push(rel);
      }
    }
    expect(violations).toEqual([]);
  });

  it("admin GET handler does not select either credential column", () => {
    const adminProviders = readFileSync(
      resolve(SRC, "app/api/admin/providers/route.ts"),
      "utf8"
    );
    const getHandlerStart = adminProviders.indexOf("export async function GET");
    expect(getHandlerStart).toBeGreaterThan(-1);
    const getHandler = adminProviders.slice(getHandlerStart);
    const selectMatch = getHandler.match(/\.select\(([\s\S]*?)\)/);
    expect(selectMatch).not.toBeNull();
    expect(selectMatch![1]).not.toMatch(/auth_key_encrypted/);
    expect(selectMatch![1]).not.toMatch(/api_key_encrypted/);
  });
});
