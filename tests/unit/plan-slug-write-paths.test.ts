import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.122 — drift guard: plan_slug write paths.
//
// plan_slug is the access-tier gate. Lane 4.3 reads it to decide whether
// `tr_live_` key creation is allowed (free-tier blocked). If a future PR
// introduces a write path that accepts user-supplied plan_slug — e.g. a
// new admin tool, a feature flag handler, a settings PATCH that forgets
// to include plan_slug in an ALLOWED_FIELDS allow-list — that's a free-tier
// escalation surface (mint paid-tier access, then mint a tr_live_ key).
//
// Today plan_slug writes happen only from:
//   1. Stripe webhook handler (service_role, signed-event driven)
//   2. Initial INSERT during signup (hardcoded "free")
//   3. Internal lib/gateway.ts user-creation helper (hardcoded "free")
//
// This test enumerates every src/ file that contains the literal string
// `plan_slug:` inside an `.update({` call site and asserts the set matches
// an explicit allow-list.
//
// Source-file regex parser (NOT runtime import) — registry imports often pull
// in createClient() and crash without prod env (memory feedback rule #59).

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

// Files allowed to mutate plan_slug (service_role + audited business logic).
// Each entry must include a comment in the source explaining why.
const PLAN_SLUG_WRITE_ALLOWLIST = new Set<string>([
  "src/app/api/webhooks/stripe/route.ts", // signed webhook event drives plan upgrades + downgrades to "free"
]);

describe("Lane 4.122 — plan_slug writes are allow-listed", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files contain plan_slug inside an update payload", () => {
    // Multiline regex catches `.update({ ... plan_slug ... })` payloads.
    const re = /\.update\(\s*\{[^}]*plan_slug/s;
    const violators: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      if (re.test(src)) {
        const rel = file
          .replace(SRC_ROOT, "src")
          .replace(/\\/g, "/");
        if (!PLAN_SLUG_WRITE_ALLOWLIST.has(rel)) {
          violators.push(rel);
        }
      }
    }
    expect(violators).toEqual([]);
  });

  it("no raw SQL UPDATE ... SET plan_slug in src/", () => {
    const re = /UPDATE\s+\w+\s+SET[^;]*plan_slug\s*=/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      if (re.test(src)) {
        violators.push(
          file.replace(SRC_ROOT, "src").replace(/\\/g, "/")
        );
      }
    }
    expect(violators).toEqual([]);
  });

  it("settings PATCH ALLOWED_FIELDS does not contain plan_slug", () => {
    // Lane 4.22 mass-assignment gate. If someone adds plan_slug to the
    // settings PATCH allow-list, that's an instant free-tier escalation.
    const settingsRoute = readFileSync(
      resolve(SRC_ROOT, "app/api/v1/settings/route.ts"),
      "utf-8"
    );
    const allowedFieldsBlock = settingsRoute.match(
      /const\s+ALLOWED_FIELDS\s*=\s*new\s+Set\(\[([\s\S]*?)\]\)/
    );
    expect(
      allowedFieldsBlock,
      "ALLOWED_FIELDS Set not found in settings/route.ts"
    ).not.toBeNull();
    const block = allowedFieldsBlock![1];
    expect(/plan_slug/.test(block)).toBe(false);
    expect(/plan_id/.test(block)).toBe(false);
  });
});
