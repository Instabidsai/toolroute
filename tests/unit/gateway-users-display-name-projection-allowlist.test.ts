import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.176 — drift guard: gateway_users.display_name
// SELECT-projection allow-list.
//
// `gateway_users.display_name` is a user-supplied profile label —
// the human name shown in the dashboard. It's seeded at signup
// (`email.split("@")[0]`) and at OAuth callback time, and is
// editable via PATCH /api/v1/settings (`display_name` is the
// only field validated as 1-100 chars in `EDITABLE_FIELDS`).
//
// It's free-form user-controlled string content — typically
// resolves to PII (a real first name) or a vanity handle. Same
// risk class as `api_keys.name` (Lane 4.174) but on the user
// row instead of the key row.
//
// Today's read surface is exactly 1 file:
//
//   - src/app/api/v1/settings/route.ts —
//       GET /api/v1/settings + the PATCH return-shape both project
//       `display_name` so the dashboard settings page can render
//       and re-render after edits (lines ~16 GET, ~191 PATCH).
//       Owner-scoped via `.eq("id", userId)` on both paths.
//
// Out of scope (intentionally NOT gateway_users SELECT projections):
//   - INSERT-only callsites: signup/route.ts:171, auth/callback/
//     route.ts:97, gateway.ts:649 (write-path).
//   - `lib/types.ts:26` — TypeScript interface declaration only.
//   - `categories/[super]/page.tsx:72` — different table (s.
//     display_name on sub_categories rows, not gateway_users).
//   - settings/route.ts return-shape consumption (lines ~35, ~66,
//     ~137, ~140, ~210) — all in the allow-listed file already.
//
// Why guard this column even though it's not a credential:
//
//   - User-supplied strings can carry PII (real name) or product
//     context (workspace name). A new SELECT reader without
//     `.eq("id", auth.uid())` would expose other tenants'
//     display names — disclosing identities cross-account.
//   - The 1-file projection surface is the natural lock — the
//     settings page is the only place this label needs to render.
//
// Three classes of violation handled here (all SELECT-side):
//
//   1. `.from('gateway_users').select('… display_name …')` outside
//      the allow-list.
//   2. `.returns<{ display_name: … }>()` generic outside the
//      allow-list (no callsite uses this today, but lock it down
//      anyway because TS-narrowing makes the leak invisible to
//      readers).
//   3. Raw SQL `SELECT … display_name … FROM gateway_users`
//      anywhere in src/.
//
// Source-file regex parser only — registry imports often pull in
// createClient() at module load and crash without prod env (memory
// rule #59).
//
// Sibling guards:
//   - Lane 4.147 (gateway_users.email projection — direct PII)
//   - Lane 4.148 (gateway_users.stripe_customer_id projection)
//   - Lane 4.151 (gateway_users.metadata projection)
//   - Lane 4.159 (gateway_users.plan_slug projection)
//   - Lane 4.160 (gateway_users.credit_balance projection)
//   - Lane 4.163/4.164/4.165 (gateway_users.auto_topup_* projection)
//   - Lane 4.174 (api_keys.name projection — same risk class on
//     api_keys row)

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

// Files allowed to SELECT `display_name` from `gateway_users`.
// Exactly one read path: owner-scoped settings GET + PATCH endpoint.
const PROJECTION_ALLOWLIST = new Set<string>([
  "src/app/api/v1/settings/route.ts",
]);

describe("Lane 4.176 — gateway_users.display_name SELECT-projection allow-list", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files SELECT display_name from gateway_users", () => {
    const re =
      /\.from\(\s*["']gateway_users["']\s*\)[\s\S]{0,500}?\.select\(\s*["'`][^"'`]*\bdisplay_name\b[^"'`]*["'`]/;
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

  it("only allow-listed files declare display_name in a gateway_users .returns<>() generic", () => {
    const re =
      /\.from\(\s*["']gateway_users["']\s*\)[\s\S]{0,500}?\.returns<[\s\S]*?\bdisplay_name\b/;
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

  it("no raw SQL SELECT display_name FROM gateway_users in src/", () => {
    const re =
      /SELECT\s+[\s\S]*?\bdisplay_name\b[\s\S]*?\bFROM\s+gateway_users\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(file, "utf-8"));
      if (re.test(src)) violators.push(rel(file));
    }
    expect(violators).toEqual([]);
  });
});
