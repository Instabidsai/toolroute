import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const API_V1_ROOT = join(process.cwd(), "src", "app", "api", "v1");

function listRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...listRouteFiles(p));
    else if (entry === "route.ts") out.push(p);
  }
  return out;
}

const SENSITIVE_COLUMNS = [
  "plan_slug",
  "plan_id",
  "credit_balance",
  "lifetime_credits",
  "lifetime_usage",
  "is_active",
  "key_hash",
  "rate_limit_rpm",
];

describe("Lane 4.22 — mass-assignment shape (drift prevention)", () => {
  const routes = listRouteFiles(API_V1_ROOT);

  it("settings PATCH still has ALLOWED_FIELDS allowlist with expected 4 keys", () => {
    const src = readFileSync(
      join(API_V1_ROOT, "settings", "route.ts"),
      "utf8"
    );
    const allowlistMatch = src.match(
      /const\s+ALLOWED_FIELDS\s*=\s*new\s+Set\s*\(\s*\[([\s\S]*?)\]\s*\)/
    );
    expect(allowlistMatch, "ALLOWED_FIELDS Set must exist in settings/route.ts").not.toBeNull();
    const body = allowlistMatch![1];
    expect(body).toMatch(/"auto_topup_enabled"/);
    expect(body).toMatch(/"auto_topup_threshold"/);
    expect(body).toMatch(/"auto_topup_amount_cents"/);
    expect(body).toMatch(/"display_name"/);
    expect(src).toMatch(
      /if\s*\(\s*!\s*ALLOWED_FIELDS\.has\s*\(\s*key\s*\)\s*\)/
    );
  });

  it("no v1 mutation route spreads the raw request body into update/insert/upsert", () => {
    const violations: string[] = [];
    for (const file of routes) {
      const src = readFileSync(file, "utf8");
      const patterns = [
        /\.update\s*\(\s*body\s*[),]/,
        /\.insert\s*\(\s*body\s*[),]/,
        /\.upsert\s*\(\s*body\s*[),]/,
        /\.update\s*\(\s*\{\s*\.\.\.\s*body\s*\}/,
        /\.insert\s*\(\s*\{\s*\.\.\.\s*body\s*\}/,
        /\.upsert\s*\(\s*\{\s*\.\.\.\s*body\s*\}/,
      ];
      for (const pat of patterns) {
        if (pat.test(src)) {
          violations.push(`${file}: matches ${pat}`);
        }
      }
    }
    expect(violations, `Spread-from-body found:\n${violations.join("\n")}`).toEqual([]);
  });

  it("sensitive financial columns are never assigned from a destructured body field", () => {
    const violations: string[] = [];
    for (const file of routes) {
      const src = readFileSync(file, "utf8");

      // Find each destructure of a body / json result.
      // e.g. `const { plan_slug, foo } = await request.json();`
      // or   `const { plan_slug } = body;`
      const destructureRe =
        /const\s*\{\s*([^}]+)\}\s*=\s*(?:await\s+request\.json\s*\(\s*\)|body)/g;
      let m: RegExpExecArray | null;
      const destructuredNames = new Set<string>();
      while ((m = destructureRe.exec(src)) !== null) {
        for (const raw of m[1].split(",")) {
          const name = raw.trim().split(/[:=\s]/)[0];
          if (name) destructuredNames.add(name);
        }
      }

      for (const col of SENSITIVE_COLUMNS) {
        if (!destructuredNames.has(col)) continue;
        // Sensitive col was destructured from body. Now check if it's ever
        // used in an update/insert/upsert object literal in this file.
        const useRe = new RegExp(
          `\\.(?:update|insert|upsert)\\s*\\(\\s*\\{[^}]*\\b${col}\\b\\s*[,:}]`,
          "s"
        );
        if (useRe.test(src)) {
          violations.push(
            `${file}: ${col} destructured from body AND used in update/insert/upsert object`
          );
        }
      }
    }
    expect(
      violations,
      `Body-controlled financial field assignment:\n${violations.join("\n")}`
    ).toEqual([]);
  });

  it("keys PATCH still has user_id ownership filter (IDOR guard)", () => {
    const src = readFileSync(
      join(API_V1_ROOT, "keys", "route.ts"),
      "utf8"
    );
    // PATCH handler must filter by user_id from session before update completes
    const patchHandlerMatch = src.match(
      /export\s+async\s+function\s+PATCH[\s\S]*?(?=export\s+async\s+function|\Z)/
    );
    expect(patchHandlerMatch, "PATCH handler not found in keys/route.ts").not.toBeNull();
    const patchBody = patchHandlerMatch![0];
    expect(patchBody).toMatch(/\.eq\s*\(\s*["']user_id["']\s*,\s*userId\s*\)/);
  });
});
