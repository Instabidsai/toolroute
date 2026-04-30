import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.126 — drift guard: credit_transactions ledger immutability.
//
// credit_transactions IS the gateway's financial ledger. Every credit grant,
// every per-call deduction, every refund, every payment_failed audit row
// lands here with (amount, balance_after, type, stripe_payment_id, metadata).
// Downstream auditing, Stripe-reconciliation jobs, and the user-visible
// billing history all read this table as authoritative.
//
// Three classes of violation would erase that authority:
//
//   1. UPDATE — an existing ledger row's amount or balance_after changes.
//      Direct financial fraud surface; rewriting "I paid $5" to "I paid $50"
//      while reconciliation still sees the original Stripe charge.
//
//   2. DELETE — a row disappears. Removes the trail entirely; auditor sees
//      $0 spent, Stripe shows real charges. Refund-without-clawback class.
//
//   3. UPSERT — a write path that's UPDATE-or-INSERT. Same fraud surface as
//      #1, just smuggled through a different verb.
//
// Today the application layer touches credit_transactions in only TWO ways:
//
//   - Direct .insert(...) for `payment_failed` audit rows from
//     webhooks/stripe/route.ts (the recordPaymentFailure helper). This is
//     the only file allow-listed for direct inserts.
//
//   - The `add_credits` PG RPC (inserts a row + bumps gateway_users.credit_balance
//     atomically). Lane 4.121's RPC-only credit_balance guard already covers
//     this path — RPCs aren't reached by the regexes below.
//
// All other src/ usage is SELECT-only (lib/gateway.ts:176 for recent-row
// dedup, dashboard/billing/page.tsx:281 for user-visible history).
//
// Source-file regex parser (NOT runtime import) — registry imports often pull
// in createClient() and crash without prod env (memory feedback rule #59).
// Sibling guards in this family: Lane 4.121 credit_balance, Lane 4.122
// plan_slug, Lane 4.123 api_keys.user_id, Lane 4.124 stripe_customer_id,
// Lane 4.125 auto_topup_*.

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

// Files allowed to direct-INSERT into credit_transactions.
// All credit grants happen through the add_credits PG RPC (see Lane 4.121),
// which lives below the application layer and isn't reached by these regexes.
// The one direct-insert path is the payment_failed audit-row helper.
const CREDIT_TRANSACTIONS_INSERT_ALLOWLIST = new Set<string>([
  "src/app/api/webhooks/stripe/route.ts", // recordPaymentFailure helper writes payment_failed audit rows
]);

describe("Lane 4.126 — credit_transactions ledger immutability", () => {
  const files = walk(SRC_ROOT);

  it("no .from('credit_transactions').update(...) anywhere in src/", () => {
    const re = /\.from\(\s*["']credit_transactions["']\s*\)[\s\S]{0,500}?\.update\(/;
    const violators: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      if (re.test(src)) {
        violators.push(file.replace(SRC_ROOT, "src").replace(/\\/g, "/"));
      }
    }
    expect(violators).toEqual([]);
  });

  it("no .from('credit_transactions').delete(...) anywhere in src/", () => {
    const re = /\.from\(\s*["']credit_transactions["']\s*\)[\s\S]{0,500}?\.delete\(/;
    const violators: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      if (re.test(src)) {
        violators.push(file.replace(SRC_ROOT, "src").replace(/\\/g, "/"));
      }
    }
    expect(violators).toEqual([]);
  });

  it("no .from('credit_transactions').upsert(...) anywhere in src/", () => {
    const re = /\.from\(\s*["']credit_transactions["']\s*\)[\s\S]{0,500}?\.upsert\(/;
    const violators: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      if (re.test(src)) {
        violators.push(file.replace(SRC_ROOT, "src").replace(/\\/g, "/"));
      }
    }
    expect(violators).toEqual([]);
  });

  it("no raw SQL UPDATE/DELETE/INSERT against credit_transactions in src/", () => {
    const re = /(UPDATE|DELETE\s+FROM|INSERT\s+INTO)\s+credit_transactions\b/i;
    const violators: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      if (re.test(src)) {
        violators.push(file.replace(SRC_ROOT, "src").replace(/\\/g, "/"));
      }
    }
    expect(violators).toEqual([]);
  });

  it("only allow-listed files direct-insert into credit_transactions", () => {
    const re = /\.from\(\s*["']credit_transactions["']\s*\)[\s\S]{0,500}?\.insert\(/;
    const violators: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      if (re.test(src)) {
        const rel = file.replace(SRC_ROOT, "src").replace(/\\/g, "/");
        if (!CREDIT_TRANSACTIONS_INSERT_ALLOWLIST.has(rel)) {
          violators.push(rel);
        }
      }
    }
    expect(violators).toEqual([]);
  });
});
