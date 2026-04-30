import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.125 — drift guard: auto_topup_* write paths.
//
// Three columns control the auto-top-up billing loop:
//   - auto_topup_enabled    (bool — kicks in the trigger)
//   - auto_topup_threshold  (number — credit_balance <= threshold fires charge)
//   - auto_topup_amount_cents (int — how much to charge per fire)
//
// If a future PR adds a write path that lets a user set someone else's
// auto_topup_enabled=true with their own card on file, OR sets a victim's
// threshold absurdly high (forcing perpetual auto-charges), OR sets the
// amount_cents to a malicious value, the financial-fraud surface is direct.
// The triggerAutoTopup() call in gateway.ts reads these columns from the
// authenticated user's row — the integrity of those columns IS the financial
// boundary.
//
// Today auto_topup_* writes happen only from:
//   /api/v1/settings/route.ts — Lane 4.22 ALLOWED_FIELDS gate + per-field
//   type validation + capability check (verify payment method exists before
//   enabling).
//
// This test enumerates every src/ file containing the literal `auto_topup_`
// inside an `.update({` call site and asserts the set is exactly that one
// file. Sibling assertion: ALLOWED_FIELDS still contains the exact 3
// auto_topup_* fields (no addition that would bypass validation, no removal
// that would silently break the feature).
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

// Files allowed to mutate auto_topup_* columns.
// Each entry must include a comment in the source explaining why.
const AUTO_TOPUP_WRITE_ALLOWLIST = new Set<string>([
  "src/app/api/v1/settings/route.ts", // Lane 4.22 ALLOWED_FIELDS + per-field validation + payment-method capability check
]);

const REQUIRED_AUTO_TOPUP_FIELDS = [
  "auto_topup_enabled",
  "auto_topup_threshold",
  "auto_topup_amount_cents",
];

describe("Lane 4.125 — auto_topup_* writes are allow-listed", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files contain auto_topup_ inside an update payload", () => {
    // Catches `.update({ ... auto_topup_xxx ... })` payloads.
    const re = /\.update\(\s*\{[^}]*auto_topup_/s;
    const violators: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      if (re.test(src)) {
        const rel = file.replace(SRC_ROOT, "src").replace(/\\/g, "/");
        if (!AUTO_TOPUP_WRITE_ALLOWLIST.has(rel)) {
          violators.push(rel);
        }
      }
    }
    expect(violators).toEqual([]);
  });

  it("no raw SQL UPDATE ... SET auto_topup_ in src/", () => {
    const re = /UPDATE\s+\w+\s+SET[^;]*auto_topup_\w+\s*=/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      if (re.test(src)) {
        violators.push(file.replace(SRC_ROOT, "src").replace(/\\/g, "/"));
      }
    }
    expect(violators).toEqual([]);
  });

  it("settings PATCH ALLOWED_FIELDS contains all 3 auto_topup_* fields", () => {
    // Lane 4.22 mass-assignment gate. Removal would silently break the feature
    // (auto-top-up settings PATCH would no-op). Addition of new auto_topup_*
    // fields not validated would bypass the per-field type check below.
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
    for (const field of REQUIRED_AUTO_TOPUP_FIELDS) {
      expect(
        block.includes(field),
        `ALLOWED_FIELDS missing required field: ${field}`
      ).toBe(true);
    }
  });

  it("settings route validates each auto_topup_* field with a switch case", () => {
    // Per-field type validation is the second line of defense after the
    // ALLOWED_FIELDS gate. A bypass would let a user post non-boolean to
    // auto_topup_enabled, or out-of-range threshold/amount values.
    const settingsRoute = readFileSync(
      resolve(SRC_ROOT, "app/api/v1/settings/route.ts"),
      "utf-8"
    );
    for (const field of REQUIRED_AUTO_TOPUP_FIELDS) {
      const caseRe = new RegExp(`case\\s+["']${field}["']\\s*:`);
      expect(
        caseRe.test(settingsRoute),
        `settings/route.ts missing 'case "${field}":' validation switch`
      ).toBe(true);
    }
  });
});
