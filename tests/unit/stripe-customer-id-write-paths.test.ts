import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.124 — drift guard: stripe_customer_id write paths.
//
// stripe_customer_id is the billing-binding column on gateway_users. It links
// a ToolRoute user to a Stripe customer record — every charge, refund, and
// auto-top-up draws against THAT customer. If a future PR introduces a write
// path that lets a user set someone else's stripe_customer_id (e.g. an admin
// "merge accounts" tool, a settings PATCH that forgets to exclude it from an
// ALLOWED_FIELDS allow-list, a misguided "transfer billing" feature), an
// attacker can rebind a victim's account to the attacker's Stripe customer
// and force the victim's auto-top-up to charge the attacker's saved card —
// or vice versa, rebind the attacker's account to the victim's customer to
// charge the victim. Either direction is financial fraud.
//
// Today stripe_customer_id writes happen only from:
//   1. Stripe webhook handler — checkout.session.completed (signed event):
//      a. credit purchase path: CAS-guarded with .is(stripe_customer_id, null)
//      b. subscription/plan path: not CAS-guarded but webhook-signed only
//   2. /api/v1/billing/setup-payment — null-checks on read before write
//
// This test enumerates every src/ file containing the literal string
// `stripe_customer_id` inside an `.update({` call site and asserts the set
// matches an explicit allow-list. Sibling assertion: Lane 4.22 ALLOWED_FIELDS
// in settings PATCH does NOT contain stripe_customer_id.
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

// Files allowed to mutate stripe_customer_id.
// Each entry must include a comment in the source explaining the surface.
const STRIPE_CUSTOMER_ID_WRITE_ALLOWLIST = new Set<string>([
  "src/app/api/webhooks/stripe/route.ts", // signed webhook event drives initial bind on checkout.session.completed
  "src/app/api/v1/billing/setup-payment/route.ts", // first-time customer creation when user has no stripe_customer_id yet
]);

describe("Lane 4.124 — stripe_customer_id writes are allow-listed", () => {
  const files = walk(SRC_ROOT);

  it("only allow-listed files contain stripe_customer_id inside an update payload", () => {
    // Multiline regex catches `.update({ ... stripe_customer_id ... })` payloads.
    const re = /\.update\(\s*\{[^}]*stripe_customer_id/s;
    const violators: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      if (re.test(src)) {
        const rel = file.replace(SRC_ROOT, "src").replace(/\\/g, "/");
        if (!STRIPE_CUSTOMER_ID_WRITE_ALLOWLIST.has(rel)) {
          violators.push(rel);
        }
      }
    }
    expect(violators).toEqual([]);
  });

  it("no raw SQL UPDATE ... SET stripe_customer_id in src/", () => {
    const re = /UPDATE\s+\w+\s+SET[^;]*stripe_customer_id\s*=/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      if (re.test(src)) {
        violators.push(file.replace(SRC_ROOT, "src").replace(/\\/g, "/"));
      }
    }
    expect(violators).toEqual([]);
  });

  it("settings PATCH ALLOWED_FIELDS does not contain stripe_customer_id", () => {
    // Lane 4.22 mass-assignment gate. If someone adds stripe_customer_id to the
    // settings PATCH allow-list, a user can rebind their billing to anyone's
    // Stripe customer record — instant financial-fraud surface. Sibling
    // assertion to Lane 4.122 (plan_slug exclusion).
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
    expect(/stripe_customer_id/.test(block)).toBe(false);
  });
});
