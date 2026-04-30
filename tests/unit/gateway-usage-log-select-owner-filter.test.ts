import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.140 — drift guard: gateway_usage_log SELECT chains must be either
// owner-filtered (.eq("user_id", ...)) or admin-aggregator (validateAdmin-gated).
//
// Sibling guards:
//   - Lane 4.133: same shape for gateway_users / api_keys / credit_transactions
//     / user_provider_keys (all strictly owner-only — no admin carve-out).
//   - Lane 4.139: log_gateway_request p_error redactCreds wrap (the WRITE
//     side of the same table).
//   - Lane 4.134: admin/* validateAdmin() coverage drift guard (which gates
//     the admin-aggregator carve-out below).
//
// What this lane closes:
//
// gateway_usage_log holds every gateway request: user_id, tool_slug,
// provider_used, response_status, latency_ms, cost_to_user, cost_to_us,
// error_message, key_source, created_at. Cross-user reads leak:
//   - PII: who is calling which tools and when
//   - Spend: cost_to_user reveals each user's monthly bill
//   - Build intent: tool_slug reveals what every user is building
//   - Error strings: post-Lane-4.139 these are redactCreds'd, but pre-
//     redaction historical rows could still leak Bearer/sk- fragments.
//
// Lane 4.33 + 4.116 verify the CALLER is auth'd; they DON'T verify rows
// belong to the caller. A new session-authed route that reads
// gateway_usage_log without filtering by user_id is a cross-user leak.
//
// Why a separate lane from 4.133:
//
// gateway_usage_log uniquely has a legitimate cross-user reader:
// /api/admin/stats aggregates revenue/COGS/top-users platform-wide.
// 4.133's ALLOW=must-have-owner-filter shape can't express
// "validateAdmin-gated bypass". This test introduces a per-file
// classification: OWNER_FILTER (must `.eq("user_id", ...)`) vs
// ADMIN_AGGREGATOR (must call `validateAdmin(request)` somewhere in the
// file).
//
// Drift class:
//   - Add a new endpoint that reads gateway_usage_log without filtering
//     by user_id AND without admin gate. Result: every user's spend +
//     timing + tool_slug visible to any logged-in caller.
//   - Modify an existing OWNER_FILTER callsite to drop the .eq filter.
//     Result: same.
//   - Add a new ADMIN_AGGREGATOR file that forgets validateAdmin().
//     Result: bypass admin gate via the new file.
//
// Source-file regex parser per memory rule #59 — never import registry
// modules in tests; they pull in createClient() and crash without prod
// env.

const SRC_ROOT = resolve(process.cwd(), "src");

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      walk(full, files);
    } else if (
      st.isFile() &&
      (full.endsWith(".ts") || full.endsWith(".tsx")) &&
      !full.endsWith(".test.ts") &&
      !full.endsWith(".test.tsx")
    ) {
      files.push(full);
    }
  }
  return files;
}

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

// Files allow-listed for owner-filtered reads of gateway_usage_log.
// Every callsite within these files MUST chain `.eq("user_id", ...)`.
const OWNER_FILTER_ALLOWLIST = new Set<string>([
  "src/lib/gateway.ts",                   // getKeyInfo today/month usage rollup
  "src/app/api/v1/usage/route.ts",        // GET /api/v1/usage paginated history
  "src/app/dashboard/page.tsx",           // dashboard tile counts
]);

// Files allow-listed for admin-aggregator reads of gateway_usage_log.
// These intentionally aggregate across users for platform-wide stats.
// They MUST call validateAdmin(request) somewhere in the file body.
const ADMIN_AGGREGATOR_ALLOWLIST = new Set<string>([
  "src/app/api/admin/stats/route.ts",     // platform revenue/COGS/by-tool/by-key-source/top-users
]);

describe("Lane 4.140 — gateway_usage_log SELECT owner-filter drift guard", () => {
  const files = walk(SRC_ROOT);

  it("every .from('gateway_usage_log').select(...) callsite is allow-listed", () => {
    const re = /\.from\(\s*["']gateway_usage_log["']\s*\)\s*\.select\(/g;
    const violators: string[] = [];

    for (const file of files) {
      const rel = file.replace(SRC_ROOT, "src").replace(/\\/g, "/");
      const src = stripComments(readFileSync(file, "utf-8"));
      re.lastIndex = 0;
      if (!re.test(src)) continue;

      if (
        !OWNER_FILTER_ALLOWLIST.has(rel) &&
        !ADMIN_AGGREGATOR_ALLOWLIST.has(rel)
      ) {
        violators.push(rel);
      }
    }

    expect(violators).toEqual([]);
  });

  it("OWNER_FILTER callsites all chain .eq('user_id', ...)", () => {
    // Each individual `.from("gateway_usage_log").select(...)` callsite
    // in an OWNER_FILTER file must have a .eq("user_id", ...) within the
    // chain (look-ahead 600 chars covers any reasonable chain length
    // including multi-line columns + multiple .eq + .order + .limit).
    const re = /\.from\(\s*["']gateway_usage_log["']\s*\)\s*\.select\(/g;
    const filterRe = /\.eq\(\s*["']user_id["']/;
    const violators: { file: string; offset: number }[] = [];

    for (const file of files) {
      const rel = file.replace(SRC_ROOT, "src").replace(/\\/g, "/");
      if (!OWNER_FILTER_ALLOWLIST.has(rel)) continue;

      const src = stripComments(readFileSync(file, "utf-8"));
      let m: RegExpExecArray | null;
      re.lastIndex = 0;
      while ((m = re.exec(src)) !== null) {
        const window = src.slice(m.index, m.index + 600);
        if (!filterRe.test(window)) {
          violators.push({ file: rel, offset: m.index });
        }
      }
    }

    expect(violators).toEqual([]);
  });

  it("ADMIN_AGGREGATOR files call validateAdmin(request) somewhere in the file", () => {
    // The admin-aggregator carve-out is conditional on the file being
    // admin-gated. validateAdmin() comes from src/lib/admin-auth.ts
    // (Lane 4.11). A future ADMIN_AGGREGATOR allow-list addition that
    // forgets the gate would silently bypass admin auth.
    const validateAdminRe = /\bvalidateAdmin\s*\(/;
    const violators: string[] = [];

    for (const file of files) {
      const rel = file.replace(SRC_ROOT, "src").replace(/\\/g, "/");
      if (!ADMIN_AGGREGATOR_ALLOWLIST.has(rel)) continue;

      const src = stripComments(readFileSync(file, "utf-8"));
      if (!validateAdminRe.test(src)) {
        violators.push(rel);
      }
    }

    expect(violators).toEqual([]);
  });

  it("sanity: at least one gateway_usage_log SELECT callsite exists", () => {
    // If this drops to zero, the regex is wrong (no false positive
    // tolerance — the table is heavily read in prod).
    const re = /\.from\(\s*["']gateway_usage_log["']\s*\)\s*\.select\(/g;
    let count = 0;
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      re.lastIndex = 0;
      while (re.exec(src) !== null) count++;
    }
    expect(count).toBeGreaterThan(0);
  });
});
