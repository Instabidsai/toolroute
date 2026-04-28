import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const srcDir = resolve(root, "src");

type Classification =
  | "gateway-locked"
  | "gateway-leak-known"
  | "registry-public"
  | "admin-managed"
  | "ambiguous";

const EXPECTATION_MAP: Record<string, Classification> = {
  api_keys: "gateway-locked",
  credit_transactions: "gateway-locked",
  gateway_users: "gateway-locked",
  gateway_usage_log: "gateway-locked",
  user_provider_keys: "gateway-locked",

  usage_events: "gateway-leak-known",

  tools: "registry-public",
  tool_categories: "registry-public",
  category_beliefs: "registry-public",
  composites: "registry-public",
  inventory: "registry-public",
  skills: "registry-public",
  plans: "registry-public",

  tool_providers: "admin-managed",
};

const FROM_CALL_RE = /\.from\(["']([a-z_]+)["']\)/g;

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, files);
    } else if (
      entry.endsWith(".ts") ||
      entry.endsWith(".tsx") ||
      entry.endsWith(".js") ||
      entry.endsWith(".jsx")
    ) {
      files.push(full);
    }
  }
  return files;
}

function collectReferencedTables(): Set<string> {
  const tables = new Set<string>();
  for (const file of walk(srcDir)) {
    const source = readFileSync(file, "utf8");
    let match: RegExpExecArray | null;
    FROM_CALL_RE.lastIndex = 0;
    while ((match = FROM_CALL_RE.exec(source)) !== null) {
      tables.add(match[1]);
    }
  }
  return tables;
}

describe("RLS coverage", () => {
  it("every supabase.from() table in src/ is classified", () => {
    const referenced = collectReferencedTables();
    const unclassified = [...referenced]
      .filter((t) => !(t in EXPECTATION_MAP))
      .sort();
    expect(unclassified).toEqual([]);
  });

  it("every classified table is actually referenced in src/ (no stale entries)", () => {
    const referenced = collectReferencedTables();
    const stale = Object.keys(EXPECTATION_MAP)
      .filter((t) => !referenced.has(t))
      .sort();
    expect(stale).toEqual([]);
  });

  it("all gateway-tier tables are classified locked or leak-known (never registry-public)", () => {
    const gatewayTables = [
      "api_keys",
      "credit_transactions",
      "gateway_users",
      "gateway_usage_log",
      "user_provider_keys",
      "usage_events",
    ];
    for (const t of gatewayTables) {
      const c = EXPECTATION_MAP[t];
      expect(
        c === "gateway-locked" || c === "gateway-leak-known",
        `gateway table ${t} must be locked or leak-known, got ${c}`
      ).toBe(true);
    }
  });
});
