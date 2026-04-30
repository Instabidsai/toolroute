import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.223 — drift guard: GITHUB_TOKEN env-var direct-read
// allow-list.
//
// `GITHUB_TOKEN` is the platform-level GitHub master credential.
// It carries a higher-than-usual blast radius for two reasons that
// make it stricter than the API-cost master pools (Anthropic /
// OpenAI):
//
//   1. PRIVATE-DATA EXPOSURE — Lane 4.104 audit memo found that
//      `search_repos`, `get_readme`, and `list_issues` invoked
//      against the platform token return PRIVATE repository data
//      from any GitHub org the token has membership in. The
//      adapter advertises these as "public" operations to end
//      users; a master-pool fallback silently leaks private code
//      into the gateway's response. (See ToolRoute issue tracker
//      Lane 4.104.) A new file reading the env var directly to
//      "just call GitHub for this server-side flow" recreates
//      this leak class.
//
//   2. COST + RATE-LIMIT QUOTA — like other Class-A providers,
//      end-user-attributable calls flow into the platform's
//      GitHub bill / 5000 RPH user-quota rather than the user's
//      BYOK GitHub account.
//
// Today's env-var read surface is exactly ONE file:
//
//   - src/lib/adapters/github-adapter.ts — the canonical adapter
//     used by the gateway's github tool. Implements the BYOK
//     fallback (line 8: `byokKey || process.env.GITHUB_TOKEN`).
//
// Out-of-scope (not a process.env read):
//
//   - src/lib/adapter-availability.ts:24 — `github: ["GITHUB_TOKEN"]`
//     is a string literal in the adapter→required-env config map,
//     used to compute the platform-availability boolean. Not a
//     credential read; the regex (process.env. prefix) excludes it.
//   - src/app/blog/shadow-mcp-risks/page.tsx:446 — JSX text-content
//     literal showing an MCP server config example to readers
//     (e.g., `"GITHUB_TOKEN": "ghp_..."` shown in a code block).
//     Not an env-var read; the regex excludes it.
//
// EMPTY-style strictness: with only 1 known reader, this guard is
// just one notch above an empty allow-list — any second file that
// touches the env var trips the test. Given the Lane 4.104 leak
// class, this strictness is intentional.
//
// Source-file regex parser only — registry imports often pull in
// createClient() / Octokit() at module load and crash without
// prod env (memory rule #59).
//
// Sibling guards:
//   - Lane 4.152 (SUPABASE_SERVICE_ROLE_KEY env-var allow-list)
//   - Lane 4.153 (STRIPE_SECRET_KEY env-var allow-list)
//   - Lane 4.154 (STRIPE_WEBHOOK_SECRET env-var allow-list)
//   - Lane 4.155 (TOOLROUTE_ADMIN_SECRET env-var allow-list)
//   - Lane 4.220 (RESEND_API_KEY env-var allow-list)
//   - Lane 4.221 (ANTHROPIC_API_KEY env-var allow-list)
//   - Lane 4.222 (OPENAI_API_KEY env-var allow-list)
//
// Audit memos referenced:
//   - Lane 4.100 (P0 ACTIVE LEAK memo, master-pool keys live in prod)
//   - Lane 4.102 (broken-by-design master-pool class audit)
//   - Lane 4.104 (github master-pool private-repo leak)

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

// Files allowed to read `GITHUB_TOKEN` from process.env.
// Each entry has a real reason — see lane comment above.
const ENV_READ_ALLOWLIST = new Set<string>([
  "src/lib/adapters/github-adapter.ts",
]);

describe("Lane 4.223 — GITHUB_TOKEN env-var direct-read allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files read process.env.GITHUB_TOKEN", () => {
    // Match `process.env.GITHUB_TOKEN` (dot access) and
    // `process.env["GITHUB_TOKEN"]` (bracket access).
    const re =
      /process\.env\s*(?:\.\s*GITHUB_TOKEN\b|\[\s*["']GITHUB_TOKEN["']\s*\])/;
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

  it("no destructured `const { GITHUB_TOKEN } = process.env` outside allow-list", () => {
    // Destructuring assignment leaks the same value but evades dot/bracket
    // access regex. Match `{ GITHUB_TOKEN` ... `} = process.env`.
    const re =
      /\{\s*[^}]*\bGITHUB_TOKEN\b[^}]*\}\s*=\s*process\.env/;
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
