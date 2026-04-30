import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.225 — drift guard: SUPABASE_MGMT_TOKEN env-var direct-read
// allow-list.
//
// IMPORTANT — this is NOT the same env var as
// SUPABASE_SERVICE_ROLE_KEY (Lane 4.152). The two are distinct
// credentials with very different blast radii:
//
//   - SUPABASE_SERVICE_ROLE_KEY → ToolRoute's OWN per-project
//     RLS-bypass key (locked by Lane 4.152). Reads/writes data
//     in `isbratmfnnzipzyoefbo` (gateway_users, api_keys, etc.).
//
//   - SUPABASE_MGMT_TOKEN → Supabase MANAGEMENT API token (this
//     lane). Cross-project; can create/delete entire projects,
//     rotate API keys, read project secrets/env vars, modify
//     auth providers, configure billing, and (critically) read
//     and modify any project the token has organization-level
//     access to. Used by the supabase MCP adapter so end-users
//     can manage Supabase projects through the gateway.
//
// Why SUPABASE_MGMT_TOKEN warrants a strict guard:
//
//   1. CROSS-TENANT BLAST — unlike a per-project anon/service key,
//      a leaked Mgmt token can read OTHER customers' Supabase
//      projects if the token holder has org membership across
//      multiple. ToolRoute's mgmt token has access to ALL
//      ToolRoute-owned projects (registry DB, public-site DB,
//      future per-customer dedicated DBs). A new file reading
//      this env var directly is a place ANY of those data sets
//      could leak.
//
//   2. PROJECT-DESTRUCTION CAPABILITY — Mgmt API includes
//      DELETE /projects/{ref}. A mistakenly-included Mgmt token
//      in a server-side helper that "just creates a Supabase
//      project for this customer" can also delete one.
//
//   3. SECRET-EXFILTRATION — Mgmt API exposes
//      GET /projects/{ref}/secrets, which returns ALL configured
//      secrets (database password, JWT secret, third-party env
//      vars). Any new reader is a key-exfiltration surface.
//
//   4. BYOK-BYPASS / COST-ATTRIBUTION — same as other Class-A
//      master pools (Lanes 4.100/4.102/4.103) — direct env-var
//      reads bypass the gating-aware adapter wrapper.
//
// Today's env-var read surface is exactly ONE file:
//
//   - src/lib/adapters/supabase-adapter.ts — the canonical
//     supabase-mcp adapter. Implements the BYOK fallback
//     (line 8: `byokKey || process.env.SUPABASE_MGMT_TOKEN`).
//     The two error-message string-literal references in this
//     same file (lines 30 / 81) are not env reads.
//
// Out-of-scope (not a process.env read):
//
//   - src/lib/adapter-availability.ts:51 — `supabase: ["SUPABASE_MGMT_TOKEN"]`
//     is a string literal in the adapter→required-env config map,
//     used to compute the platform-availability boolean. Not a
//     credential read; the regex (process.env. prefix) excludes it.
//
// EMPTY-style strictness: with only 1 known reader, this guard is
// just one notch above an empty allow-list — any second file that
// touches the env var trips the test. Given the cross-tenant
// blast radius, this strictness is intentional.
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env
// (memory rule #59).
//
// Sibling guards:
//   - Lane 4.152 (SUPABASE_SERVICE_ROLE_KEY env-var allow-list)  ← DIFFERENT KEY
//   - Lane 4.153 (STRIPE_SECRET_KEY env-var allow-list)
//   - Lane 4.154 (STRIPE_WEBHOOK_SECRET env-var allow-list)
//   - Lane 4.155 (TOOLROUTE_ADMIN_SECRET env-var allow-list)
//   - Lane 4.220 (RESEND_API_KEY env-var allow-list)
//   - Lane 4.221 (ANTHROPIC_API_KEY env-var allow-list)
//   - Lane 4.222 (OPENAI_API_KEY env-var allow-list)
//   - Lane 4.223 (GITHUB_TOKEN env-var allow-list)
//   - Lane 4.224 (STRIPE_PLATFORM_KEY env-var allow-list)

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
// matching so JSDoc references to the env var don't trigger false
// positives (memory rule from prior drift-guard work).
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function rel(file: string): string {
  return file.replace(SRC_ROOT, "src").replace(/\\/g, "/");
}

// Files allowed to read `SUPABASE_MGMT_TOKEN` from process.env.
// Each entry has a real reason — see lane comment above.
const ENV_READ_ALLOWLIST = new Set<string>([
  "src/lib/adapters/supabase-adapter.ts",
]);

describe("Lane 4.225 — SUPABASE_MGMT_TOKEN env-var direct-read allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files read process.env.SUPABASE_MGMT_TOKEN", () => {
    // Match `process.env.SUPABASE_MGMT_TOKEN` (dot access) and
    // `process.env["SUPABASE_MGMT_TOKEN"]` (bracket access).
    const re =
      /process\.env\s*(?:\.\s*SUPABASE_MGMT_TOKEN\b|\[\s*["']SUPABASE_MGMT_TOKEN["']\s*\])/;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) {
        const r = rel(file);
        if (!ENV_READ_ALLOWLIST.has(r)) violators.push(r);
      }
    }
    expect(violators).toEqual([]);
  });

  it("no destructured `const { SUPABASE_MGMT_TOKEN } = process.env` outside allow-list", () => {
    // Destructuring assignment leaks the same value but evades dot/bracket
    // access regex. Match `{ SUPABASE_MGMT_TOKEN` ... `} = process.env`.
    const re =
      /\{\s*[^}]*\bSUPABASE_MGMT_TOKEN\b[^}]*\}\s*=\s*process\.env/;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) {
        const r = rel(file);
        if (!ENV_READ_ALLOWLIST.has(r)) violators.push(r);
      }
    }
    expect(violators).toEqual([]);
  });
});
