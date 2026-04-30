import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.142 — drift guard: gateway_usage_log direct-mutation allow-list.
//
// gateway_usage_log is the gateway's per-call audit + billing reconciliation
// table. Every /api/v1/execute, /mcp, /api/a2a invocation lands one row here
// with (user_id, tool_slug, provider_used, response_status, latency_ms,
// cost_to_us, cost_to_user, error_message, key_source, created_at).
// It feeds:
//   - admin COGS reconciliation (cost_to_us minus cost_to_user)
//   - per-user usage history surfaced in /dashboard
//   - rate-limit / fraud detection (latency_ms, error_message patterns)
//   - the Stripe-side billing trail (key_source = master_pool vs byok)
//
// Today every row is written by the `log_gateway_request` PG RPC, called from
// exactly one TS callsite (src/lib/gateway.ts) — see Lane 4.131 RPC allow-list.
// The PG function is the single chokepoint that scrubs `p_error` via redactCreds
// (Lane 4.139) and stamps server-trusted columns. RPC-internal INSERTs aren't
// reached by these regexes; that's intentional.
//
// This guard freezes the write-side surface area at "RPC-only" and complements
// Lane 4.140's read-side owner-filter guard. Three drift classes it blocks:
//
//   1. INSERT — a future code path that bypasses log_gateway_request and writes
//      directly. Skips error redaction, can spoof user_id/cost columns, and
//      breaks the invariant that every row was server-classified.
//   2. UPDATE — rewriting a historical row's cost_to_user or response_status.
//      Direct billing-fraud surface (turn a $0.42 success into a $0.00 error).
//   3. DELETE — disappearing rows. Reconciliation sees Stripe charges with no
//      matching gateway_usage_log entry → undercounts COGS, masks abuse.
//   4. UPSERT — UPDATE-or-INSERT smuggling either #1 or #2 through one verb.
//
// Allow-list is intentionally EMPTY: no application-layer file may direct-DML
// gateway_usage_log. If a future feature genuinely needs to (e.g. a backfill
// job), add the file path here AND extend the rationale in this header.
//
// Source-file regex parser (NOT runtime import) — registry imports often pull
// in createClient() and crash without prod env (memory feedback rule #59).
// Sibling guards: Lane 4.131 RPC allow-list, Lane 4.139 redactCreds drift,
// Lane 4.140 SELECT owner-filter, Lane 4.126 credit_transactions immutability
// (this file's structural template).

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

// Files allowed to direct-DML gateway_usage_log.
// EMPTY today — every write goes through the log_gateway_request PG RPC
// (called from src/lib/gateway.ts, Lane 4.131 allow-listed).
// Adding an entry here means accepting that the file bypasses the RPC's
// p_error redaction (Lane 4.139) and server-side column trust boundary —
// so add the rationale to the header above and link the lane that authorized it.
const GATEWAY_USAGE_LOG_DML_ALLOWLIST = new Set<string>([]);

describe("Lane 4.142 — gateway_usage_log direct-mutation allow-list", () => {
  const files = walk(SRC_ROOT);

  it("no .from('gateway_usage_log').insert(...) outside the (empty) allow-list", () => {
    const re = /\.from\(\s*["']gateway_usage_log["']\s*\)[\s\S]{0,500}?\.insert\(/;
    const violators: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      if (re.test(src)) {
        const rel = file.replace(SRC_ROOT, "src").replace(/\\/g, "/");
        if (!GATEWAY_USAGE_LOG_DML_ALLOWLIST.has(rel)) {
          violators.push(rel);
        }
      }
    }
    expect(violators).toEqual([]);
  });

  it("no .from('gateway_usage_log').update(...) anywhere in src/", () => {
    const re = /\.from\(\s*["']gateway_usage_log["']\s*\)[\s\S]{0,500}?\.update\(/;
    const violators: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      if (re.test(src)) {
        violators.push(file.replace(SRC_ROOT, "src").replace(/\\/g, "/"));
      }
    }
    expect(violators).toEqual([]);
  });

  it("no .from('gateway_usage_log').delete(...) anywhere in src/", () => {
    const re = /\.from\(\s*["']gateway_usage_log["']\s*\)[\s\S]{0,500}?\.delete\(/;
    const violators: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      if (re.test(src)) {
        violators.push(file.replace(SRC_ROOT, "src").replace(/\\/g, "/"));
      }
    }
    expect(violators).toEqual([]);
  });

  it("no .from('gateway_usage_log').upsert(...) anywhere in src/", () => {
    const re = /\.from\(\s*["']gateway_usage_log["']\s*\)[\s\S]{0,500}?\.upsert\(/;
    const violators: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      if (re.test(src)) {
        violators.push(file.replace(SRC_ROOT, "src").replace(/\\/g, "/"));
      }
    }
    expect(violators).toEqual([]);
  });

  it("no raw SQL UPDATE/DELETE/INSERT against gateway_usage_log in src/", () => {
    const re = /(UPDATE|DELETE\s+FROM|INSERT\s+INTO)\s+gateway_usage_log\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      if (re.test(src)) {
        violators.push(file.replace(SRC_ROOT, "src").replace(/\\/g, "/"));
      }
    }
    expect(violators).toEqual([]);
  });
});
