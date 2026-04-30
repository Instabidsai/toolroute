import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.173 — drift guard: api_keys.rate_limit_rpm + rate_limit_rpd
// SELECT-projection EMPTY allow-list (no readers today).
// Doublet lane — both columns share identical risk class, write-path,
// read-path, and exposure profile. One regex via alternation.
//
// `api_keys.rate_limit_rpm` (per-minute) and `api_keys.rate_limit_rpd`
// (per-day) are the per-key rate-limit overrides applied by
// `check_rate_limit` RPC (Lane 4.131). Today the application reads
// these columns from ZERO files: they are exposed to the app layer
// only via the `validate_api_key` RPC return shape (gateway.ts:98-99
// — `result.rate_limit_rpm`, `result.rate_limit_rpd`), which is RPC
// return-shape consumption, NOT a SELECT projection of the table.
//
// Write-path:
//   - `src/app/api/v1/signup/route.ts:191-198` INSERTs api_keys with
//     `rate_limit_rpm: 10`. `rate_limit_rpd` is not seeded explicitly
//     (defaults via SQL).
//   - No UPDATE callsites in src/.
//
// Read-path (today):
//   - `src/lib/gateway.ts:98-99` reads `result.rate_limit_rpm` /
//     `result.rate_limit_rpd` off the validate_api_key RPC result.
//     RPC return-shape consumption, NOT SELECT projection.
//   - `src/lib/gateway-types.ts:47-48` declares the fields on the Plan
//     interface (TypeScript declaration, no runtime read).
//   - `plans` table also has rate_limit_rpm/rpd (per-plan defaults,
//     publicly readable per Lane 4.114). Out of scope — this guard
//     is api_keys-specific via the regex `\.from\(['"]api_keys['"]\)`.
//
// This guard freezes that property. Any future SELECT-projection of
// `rate_limit_rpm` or `rate_limit_rpd` from `api_keys` is a NEW exposure
// surface for the per-account quota signal — and almost certainly
// redundant with the validate_api_key RPC return shape that Lane 4.131
// already locks to gateway.ts.
//
// Why guard this column even though it's not a credential:
//
//   - Per-key rate limits fingerprint customer tier and traffic
//     economics. A SELECT projection without `.eq("user_id", ...)`
//     would expose other tenants' quota configurations.
//   - The risk class is identical to Lane 4.158 (gateway_usage_log.
//     used_byok empty allow-list): RPC-only reads, denormalized from
//     a quota signal already accessible via the locked-RPC layer.
//     Empty-allow-list is the strongest possible drift guard:
//     "don't project this column, anywhere."
//   - Defensible because the same information is reachable via the
//     `validate_api_key` RPC (gateway.ts:98-99), which Lane 4.131
//     allow-lists to gateway.ts only.
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('api_keys').select('… rate_limit_rpm/rpd …')` anywhere
//      in src/.
//   2. `.returns<{ rate_limit_rpm: … }>()` /
//      `.returns<{ rate_limit_rpd: … }>()` generic anywhere in src/.
//   3. Raw SQL `SELECT … rate_limit_rpm/rpd … FROM api_keys` anywhere
//      in src/.
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards:
//   - Lane 4.131 (validate_api_key + check_rate_limit RPC callsite allow-list)
//   - Lane 4.143 (api_keys.key_hash projection)
//   - Lane 4.166 (api_keys.key_prefix projection)
//   - Lane 4.167 (api_keys.is_active projection)
//   - Lane 4.168 (api_keys.allowed_tools projection)
//   - Lane 4.169 (api_keys.expires_at projection)
//   - Lane 4.170 (api_keys.last_used_at projection)
//   - Lane 4.158 (gateway_usage_log.used_byok empty allow-list — same pattern)

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

// Strip /* … */ block comments and // line comments before regex
// matching so JSDoc references to the column don't trigger false
// positives (memory rule from prior drift-guard work).
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function rel(file: string): string {
  return file.replace(SRC_ROOT, "src").replace(/\\/g, "/");
}

// Empty allow-list — neither rate_limit_rpm nor rate_limit_rpd has any
// SELECT-projection reader today. Both surface only via the
// validate_api_key RPC result (Lane 4.131-locked to gateway.ts).
// Adding a reader requires a deliberate allow-list expansion +
// reviewer justification.
const PROJECTION_ALLOWLIST = new Set<string>([]);

describe("Lane 4.173 — api_keys.rate_limit_rpm/rpd empty SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("no files SELECT rate_limit_rpm or rate_limit_rpd from api_keys (empty allow-list)", () => {
    const re =
      /\.from\(\s*["']api_keys["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\b(?:rate_limit_rpm|rate_limit_rpd)\b[^"'`]*["'`]/;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) {
        const r = rel(file);
        if (!PROJECTION_ALLOWLIST.has(r)) violators.push(r);
      }
    }
    expect(violators).toEqual([]);
  });

  it("no files declare rate_limit_rpm/rpd in an api_keys .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']api_keys["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\b(?:rate_limit_rpm|rate_limit_rpd)\b/;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) {
        const r = rel(file);
        if (!PROJECTION_ALLOWLIST.has(r)) violators.push(r);
      }
    }
    expect(violators).toEqual([]);
  });

  it("no raw SQL SELECT rate_limit_rpm/rpd FROM api_keys in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\b(?:rate_limit_rpm|rate_limit_rpd)\b[\s\S]*?\bFROM\s+api_keys\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
