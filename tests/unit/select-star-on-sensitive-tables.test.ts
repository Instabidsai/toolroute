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
// violation. Sensitive table list below is curated from real
// production schema (gateway.ts callsites + Lane 4.106/4.127/4.131
// audits).
//
// Lane 4.141 fix:
//   The original Lane 4.49 list was authored against an aspirational
//   schema (gateway_api_keys / byok_keys / user_byok_preferences /
//   providers / provider_master_keys / billing_customers /
//   stripe_events / auth_users / auth_sessions) — none of those tables
//   exist in the live `isbratmfnnzipzyoefbo` Supabase project. The
//   real tables are `api_keys` / `user_provider_keys` /
//   `tool_providers`. Result: the original guard was vacuous on the
//   live schema (matched zero callsites, allowed any `.select("*")`
//   regression to slip through). The sanity assertion below freezes
//   this finding so every entry must actually appear via `.from(...)`
//   in src/ — a future renamed table that isn't updated here trips
//   the test.

const SOURCE_ROOTS = ["src/app", "src/lib"];

// Tables that contain COGS, PII, credentials, or billing state.
// Curated from REAL production schema (verified by .from() callsite
// scan in src/, Lane 4.141).
//
// Excluded on purpose:
//   - `usage_events` / `inventory` (registry analytics — and existing
//     `src/lib/api-server.ts` uses `.select("*")` against them with a
//     stale TS type; usage_events is locked at the DB layer via Lane
//     0.1, inventory is a public catalog table).
//   - `tools`, `tool_categories`, `category_beliefs`, `composites`,
//     `skills` (public catalog).
//   - `plans` (public pricing — no credentials/PII).
const SENSITIVE_TABLES = [
  "gateway_usage_log",   // user_id, error_message, cost_to_us, cost_to_user, key_source
  "gateway_users",       // email, stripe_customer_id, credit_balance, plan_slug, settings
  "api_keys",            // key_hash, user_id, plan-scoped tr_live_/tr_test_ keys
  "credit_transactions", // amount, balance_after, stripe_payment_id, type, metadata (ledger)
  "user_provider_keys",  // user_id, provider_slug, encrypted_key (Class-A BYOK plaintext today, Lane 4.106)
  "tool_providers",      // master pool auth_key_encrypted (plaintext today, Lane 4.106)
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

describe("`.select(\"*\")` on sensitive tables (Lane 4.49 + Lane 4.141)", () => {
  it("Lane 4.141 sanity: every SENSITIVE_TABLES entry actually appears via `.from(...)` in src/", () => {
    // Without this assertion, a renamed/dropped table silently makes
    // the column-projection guard below vacuous for that name (the
    // original Lane 4.49 list had 9 fake/aspirational table names that
    // never matched any production callsite). Catches future drift
    // where a real table is renamed without updating this list.
    const dead: string[] = [];
    const allSrc: string[] = [];
    for (const root of SOURCE_ROOTS) {
      for (const file of walk(join(process.cwd(), root))) {
        allSrc.push(readFileSync(file, "utf8"));
      }
    }
    const haystack = allSrc.join("\n");
    for (const t of SENSITIVE_TABLES) {
      const re = new RegExp(`\\.from\\(\\s*['"\`]${t}['"\`]\\s*\\)`);
      if (!re.test(haystack)) {
        dead.push(t);
      }
    }
    expect(
      dead,
      `\nDEAD ENTRIES in SENSITIVE_TABLES — these tables are listed but never read in src/.\n` +
        `If the table was renamed, update this list. If it was dropped, remove it.\n` +
        `If it's aspirational future-state, that's a footgun: the guard is vacuous today.\n\n` +
        `Dead names: ${dead.join(", ")}`
    ).toEqual([]);
  });

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
