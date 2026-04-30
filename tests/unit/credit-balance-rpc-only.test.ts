import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.121 — drift guard: credit_balance must only be mutated via the
// add_credits / deduct_credits RPCs (or the initial INSERT on user creation).
//
// Why this matters: Lane 4.93 added input validation to add_credits/deduct_credits
// (mint-attack closure). Lane 4.97 REVOKEd authenticated WRITE on gateway_users.
// Lane 4.92 locked the RPCs to service_role. If a future PR adds
// `supabaseAdmin().from("gateway_users").update({ credit_balance: ... })`
// somewhere (admin tool, refund flow, manual adjustment), it bypasses every
// invariant the RPCs enforce — and service_role bypasses GRANT/RLS, so the
// 4.97 REVOKE doesn't catch it either.
//
// Detection: walk src/, regex-grep for `.update({...credit_balance...})`.
// One canonical INSERT path (signup) is allowed and explicitly listed.

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

describe("Lane 4.121 — credit_balance writes go through add_credits/deduct_credits RPC only", () => {
  const files = walk(SRC_ROOT);

  it("no .update({...credit_balance...}) calls anywhere in src/", () => {
    // Cross-line update payload object, ending at closing }
    const re = /\.update\(\s*\{[^}]*credit_balance/s;
    const violators: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      if (re.test(src)) {
        violators.push(file.replace(SRC_ROOT, "src"));
      }
    }
    expect(violators).toEqual([]);
  });

  it("no raw SQL UPDATE ... SET credit_balance in src/", () => {
    // Catches inline SQL strings that bypass the supabase-js builder entirely.
    const re = /UPDATE\s+\w+\s+SET[^;]*credit_balance\s*=/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      if (re.test(src)) {
        violators.push(file.replace(SRC_ROOT, "src"));
      }
    }
    expect(violators).toEqual([]);
  });
});
