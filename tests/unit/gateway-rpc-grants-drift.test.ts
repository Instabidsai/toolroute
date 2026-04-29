import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Lane 4.15 regression guard — sibling to Lane 4.10 (cogs-leak-audit) and
 * Lane 4.12 (master-key-leak-audit).
 *
 * Pairs with scripts/lockdown-gateway-rpcs.sql (Lane 4.14, P0 fix).
 *
 * Postgres EXECUTE grants on RPCs are a separate audit surface from RLS —
 * they do not appear in `pg_policies` and are easy to miss in code review.
 * A SECURITY DEFINER function with default `EXECUTE TO PUBLIC` bypasses
 * every RLS policy on every table it touches.
 *
 * This test enforces three invariants statically (no DB needed):
 *
 *   1. The lockdown SQL covers every GATEWAY_INTERNAL RPC referenced in src/.
 *      → Adding a new gateway RPC + forgetting to lock it down fails CI.
 *
 *   2. The lockdown SQL has no dead REVOKE entries (every locked RPC is
 *      still called somewhere in src/).
 *      → Pruning a code path without pruning the SQL fails CI.
 *
 *   3. Every src/ call site for a GATEWAY_INTERNAL RPC originates from a
 *      file that uses supabaseAdmin() (service-role) — never the anon
 *      browser client.
 *      → After lockdown applies, anon callers get permission_denied; this
 *        test catches the regression at compile time, not runtime 500s.
 */

const ROOT = process.cwd();
const SRC = resolve(ROOT, "src");
const LOCKDOWN_SQL = resolve(ROOT, "scripts/lockdown-gateway-rpcs.sql");
const LANE_4_94_LOCKDOWN_SQL = resolve(ROOT, "scripts/lane-4.94-secdef-rpc-lockdown.sql");

// RPCs that MUST be locked to service_role only. Calling these as anon
// would let an attacker mint/drain credits, manipulate rate-limits,
// poison usage logs, or oracle key validity.
const GATEWAY_INTERNAL_RPCS = new Set([
  "validate_api_key",
  "check_rate_limit",
  "add_credits",
  "deduct_credits",
  "log_gateway_request",
]);

// Registry/discovery RPCs that are intentionally anon-callable. Listed
// here so the test can ignore them without flagging — and so any future
// auditor sees the explicit allowlist.
const REGISTRY_PUBLIC_RPCS = new Set([
  "check_before_build",
  "search_tools_text",
  "librarian_startup",
  "get_category_champion",
  "get_tool_catalog",
  "challenge_tool",
  "log_tool_request",
  "record_usage",
]);

// Admin-stats RPCs are gateway-internal but live behind the admin route.
// Lane 4.13 noted these RPCs do not exist in the DB today (admin route
// falls back to inline SQL). Keep them off both lists until they ship —
// when they do, move them into GATEWAY_INTERNAL_RPCS.
const ADMIN_STATS_RPCS_DEFERRED = new Set([
  "admin_stats_totals",
  "admin_stats_by_tool",
  "admin_stats_by_key_source",
  "admin_stats_top_users",
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

interface RpcCallSite {
  file: string;
  rpcName: string;
}

function findRpcCallSites(): RpcCallSite[] {
  const RPC_REGEX = /\.rpc\(\s*["']([a-z_]+)["']/g;
  const sites: RpcCallSite[] = [];
  for (const abs of walkSrc(SRC)) {
    const rel = relPosix(abs);
    const text = readFileSync(abs, "utf8");
    let m: RegExpExecArray | null;
    while ((m = RPC_REGEX.exec(text)) !== null) {
      sites.push({ file: rel, rpcName: m[1] });
    }
  }
  return sites;
}

function extractLockedDownRpcsFromFile(path: string): Set<string> {
  const sql = readFileSync(path, "utf8");
  // Match: REVOKE EXECUTE ON FUNCTION public.<name>(<args>)
  const REVOKE_REGEX = /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.([a-z_]+)\s*\(/gi;
  const GRANT_REGEX = /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.([a-z_]+)\s*\(/gi;
  const revoked = new Set<string>();
  const granted = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = REVOKE_REGEX.exec(sql)) !== null) revoked.add(m[1]);
  while ((m = GRANT_REGEX.exec(sql)) !== null) granted.add(m[1]);
  // Both REVOKE and GRANT must appear for each locked RPC.
  return new Set([...revoked].filter((n) => granted.has(n)));
}

function extractLockedDownRpcs(): Set<string> {
  return extractLockedDownRpcsFromFile(LOCKDOWN_SQL);
}

// Lane 4.94 surfaced two anon-callable SECURITY DEFINER RPCs that the
// Lane 4.78 audit missed because they have ZERO callers in src/ — the
// gateway-internal audit only enumerated RPCs called from code. Orphaned
// SECDEF RPCs are still attack surface (DB-discoverable via pg_proc),
// so this set is hard-coded here as a parallel registry.
const LANE_4_94_LOCKED_RPCS = new Set([
  "get_user_dashboard", // P0 IDOR — full PII + financial leak via uuid arg
  "cleanup_rate_limits", // LOW — anon-callable maintenance fn
]);

describe("gateway RPC EXECUTE grants drift", () => {
  it("lockdown SQL covers every GATEWAY_INTERNAL RPC referenced in src/", () => {
    const calls = findRpcCallSites();
    const calledInternal = new Set(
      calls.map((c) => c.rpcName).filter((n) => GATEWAY_INTERNAL_RPCS.has(n))
    );
    const lockedDown = extractLockedDownRpcs();

    const missing: string[] = [];
    for (const rpc of calledInternal) {
      if (!lockedDown.has(rpc)) missing.push(rpc);
    }
    expect(missing).toEqual([]);
  });

  it("lockdown SQL has no dead REVOKE entries (every locked RPC is still called)", () => {
    const calls = findRpcCallSites();
    const calledNames = new Set(calls.map((c) => c.rpcName));
    const lockedDown = extractLockedDownRpcs();

    const orphaned: string[] = [];
    for (const rpc of lockedDown) {
      if (!calledNames.has(rpc)) orphaned.push(rpc);
    }
    expect(orphaned).toEqual([]);
  });

  it("every GATEWAY_INTERNAL RPC call site lives in a file that uses supabaseAdmin()", () => {
    const calls = findRpcCallSites().filter((c) =>
      GATEWAY_INTERNAL_RPCS.has(c.rpcName)
    );
    const violations: string[] = [];
    for (const { file, rpcName } of calls) {
      const text = readFileSync(resolve(ROOT, file), "utf8");
      // File must contain a supabaseAdmin() call. If the file uses the
      // anon `supabase` import or `createClient(..., supabaseAnonKey)`,
      // the gateway-internal call would 403 post-lockdown.
      if (!text.includes("supabaseAdmin()")) {
        violations.push(`${file} calls .rpc("${rpcName}") without supabaseAdmin()`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("RPC categorization sets do not overlap", () => {
    const intersect = (a: Set<string>, b: Set<string>) =>
      [...a].filter((x) => b.has(x));
    expect(intersect(GATEWAY_INTERNAL_RPCS, REGISTRY_PUBLIC_RPCS)).toEqual([]);
    expect(intersect(GATEWAY_INTERNAL_RPCS, ADMIN_STATS_RPCS_DEFERRED)).toEqual([]);
    expect(intersect(REGISTRY_PUBLIC_RPCS, ADMIN_STATS_RPCS_DEFERRED)).toEqual([]);
  });

  it("every RPC referenced in src/ is classified (no unknown gateway RPCs)", () => {
    const calls = findRpcCallSites();
    const unknown: string[] = [];
    for (const { rpcName } of calls) {
      if (
        !GATEWAY_INTERNAL_RPCS.has(rpcName) &&
        !REGISTRY_PUBLIC_RPCS.has(rpcName) &&
        !ADMIN_STATS_RPCS_DEFERRED.has(rpcName)
      ) {
        unknown.push(rpcName);
      }
    }
    expect([...new Set(unknown)]).toEqual([]);
  });
});

describe("Lane 4.94 — orphaned SECURITY DEFINER RPC lockdown", () => {
  it("lane-4.94 SQL revokes + grants every RPC in LANE_4_94_LOCKED_RPCS", () => {
    const locked = extractLockedDownRpcsFromFile(LANE_4_94_LOCKDOWN_SQL);
    const missing: string[] = [];
    for (const rpc of LANE_4_94_LOCKED_RPCS) {
      if (!locked.has(rpc)) missing.push(rpc);
    }
    expect(missing).toEqual([]);
  });

  it("lane-4.94 SQL revokes from PUBLIC, anon, authenticated", () => {
    const sql = readFileSync(LANE_4_94_LOCKDOWN_SQL, "utf8");
    for (const rpc of LANE_4_94_LOCKED_RPCS) {
      const re = new RegExp(
        `REVOKE\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${rpc}\\s*\\([^)]*\\)\\s*FROM\\s+PUBLIC,\\s*anon,\\s*authenticated`,
        "i",
      );
      expect(sql, `${rpc} REVOKE clause missing PUBLIC/anon/authenticated`).toMatch(re);
    }
  });

  it("lane-4.94 SQL grants execute to service_role only", () => {
    const sql = readFileSync(LANE_4_94_LOCKDOWN_SQL, "utf8");
    for (const rpc of LANE_4_94_LOCKED_RPCS) {
      const re = new RegExp(
        `GRANT\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${rpc}\\s*\\([^)]*\\)\\s*TO\\s+service_role`,
        "i",
      );
      expect(sql, `${rpc} GRANT clause missing service_role`).toMatch(re);
    }
  });

  it("LANE_4_94_LOCKED_RPCS do not appear as callers in src/ (orphan invariant)", () => {
    // If a future feature adds a caller for one of these, the lane-4.94
    // assumption (orphaned, safe to lock) breaks — the call site would
    // 403 post-lockdown unless it uses supabaseAdmin(). Force re-audit.
    const calls = findRpcCallSites();
    const calledNames = new Set(calls.map((c) => c.rpcName));
    const newCallers: string[] = [];
    for (const rpc of LANE_4_94_LOCKED_RPCS) {
      if (calledNames.has(rpc)) newCallers.push(rpc);
    }
    expect(
      newCallers,
      "Lane 4.94 RPCs gained callers — re-classify into GATEWAY_INTERNAL_RPCS or audit caller for supabaseAdmin()",
    ).toEqual([]);
  });
});
