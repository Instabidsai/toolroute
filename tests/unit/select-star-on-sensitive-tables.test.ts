import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// Lane 4.49 — defense-in-depth column projection on sensitive tables.
//
// Why: Supabase returns whatever columns SELECT projects. `.select("*")`
// pulls everything, including COGS (`cost_to_us`, `cost_to_user`) and
// PII (`user_id`, `email`, `stripe_customer_id`, `service_role_jwt`,
// encrypted-at-rest BYOK fields). TypeScript narrows the row type to
// the declared interface, so the extra columns are invisible to the
// reader of the helper — but every column lives on the runtime object
// and crosses any RSC→client boundary, JSON.stringify, or future caller
// that spreads the row.
//
// Detection rule: any `.from("<sensitive>").select("*")` is a
// violation. Sensitive table list below is curated from
// supabase-schema.sql + Lane 4.10/4.12/4.27/4.36 audits.

const SOURCE_ROOTS = ["src/app", "src/lib"];

// Tables that contain COGS, PII, credentials, or billing state. Curated
// from supabase-schema.sql + Lane 4.10/4.12/4.27/4.36 audits.
//
// Excluded on purpose:
//   - `usage_events` / `inventory` (registry analytics, not COGS/PII —
//     and existing app code uses `.select("*")` against them with a
//     stale TS type; locking them down is a separate refactor).
//   - `tools`, `category_beliefs`, `composites`, `skills` (public
//     catalog).
const SENSITIVE_TABLES = [
  "gateway_usage_log",
  "gateway_users",
  "gateway_api_keys",
  "byok_keys",
  "user_byok_preferences",
  "credit_transactions",
  "billing_customers",
  "stripe_events",
  "auth_users",
  "providers", // master pool API keys live here
  "provider_master_keys",
  "auth_sessions",
];

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

describe("`.select(\"*\")` on sensitive tables (Lane 4.49)", () => {
  it("no source file calls `.select(\"*\")` against any COGS/PII/credential table", () => {
    const violations: { file: string; table: string; line: number }[] = [];
    for (const root of SOURCE_ROOTS) {
      for (const file of walk(join(process.cwd(), root))) {
        const content = readFileSync(file, "utf8");
        const lines = content.split("\n");
        // Track the most recent .from("<table>") seen so we can pair it
        // with the .select("*") that may follow on the next 3 lines.
        let recentTable: string | null = null;
        let recentTableLine = -1;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const fromMatch = /\.from\(\s*['"`]([a-z0-9_]+)['"`]\s*\)/.exec(line);
          if (fromMatch) {
            recentTable = fromMatch[1];
            recentTableLine = i;
          }
          if (
            /\.select\(\s*['"`]\*['"`]\s*\)/.test(line) &&
            recentTable &&
            i - recentTableLine <= 3 &&
            SENSITIVE_TABLES.includes(recentTable)
          ) {
            violations.push({
              file: relative(process.cwd(), file),
              table: recentTable,
              line: i + 1,
            });
          }
        }
      }
    }
    expect(
      violations,
      `\nLEAK: ${violations.length} \`.select("*")\` against sensitive table(s).\n\n` +
        `Why this matters: '*' returns COGS/PII/credential columns invisible ` +
        `to TypeScript narrowing. Future caller spreads the row → leak.\n\n` +
        `Fix: list explicit columns. e.g. .select("id, tool_slug, outcome").\n\n` +
        `Violations:\n` +
        violations
          .map((v) => `  - ${v.file}:${v.line}  table=${v.table}`)
          .join("\n")
    ).toEqual([]);
  });
});
