import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// Lane 4.29 — drift-prevention test for Stripe webhook replay-window hardening.
// Sibling to Lane 4.17 (sig verification audit) and Lane 4.20/4.23 (idempotency).
// Asserts shape; does not import the route module (which would require prod env).

const webhookSrc = readFileSync(
  join(process.cwd(), "src/app/api/webhooks/stripe/route.ts"),
  "utf8"
);

describe("Lane 4.29 — Stripe webhook replay-window shape", () => {
  it("F-2: reads raw body via request.text(), not request.json()", () => {
    expect(webhookSrc).toMatch(/await\s+request\.text\s*\(\s*\)/);
    expect(webhookSrc).not.toMatch(/await\s+request\.json\s*\(\s*\)/);
  });

  it("F-1: constructEvent uses default 300s tolerance (3-arg form) OR explicit ≤300", () => {
    const matches = [...webhookSrc.matchAll(
      /stripe\.webhooks\.constructEvent\s*\(([^)]*)\)/g
    )];
    expect(matches.length).toBe(1);

    const args = matches[0][1].split(",").map((a) => a.trim());
    expect(args.length).toBeGreaterThanOrEqual(3);
    expect(args.length).toBeLessThanOrEqual(4);

    if (args.length === 4) {
      const toleranceLiteral = args[3];
      const numMatch = toleranceLiteral.match(/^(\d+)$/);
      expect(numMatch, `4th arg must be a literal integer ≤300, got: ${toleranceLiteral}`).not.toBeNull();
      const tolerance = parseInt(numMatch![1], 10);
      expect(tolerance).toBeGreaterThan(0);
      expect(tolerance).toBeLessThanOrEqual(300);
    }
  });

  it("F-3: placeholder env-var check rejects unconfigured webhooks", () => {
    expect(webhookSrc).toMatch(/STRIPE_WEBHOOK_SECRET/);
    expect(webhookSrc).toMatch(/webhookSecret\.startsWith\(["']placeholder["']\)/);
  });

  it("F-4: signature-failure path returns generic error (no leak)", () => {
    const sigBlock = webhookSrc.match(
      /constructEvent[\s\S]{0,400}?catch[\s\S]{0,300}?status:\s*\d+/
    );
    expect(sigBlock, "constructEvent must be wrapped in try/catch").not.toBeNull();
    expect(sigBlock![0]).toMatch(/status:\s*400/);
    expect(sigBlock![0]).toMatch(/Invalid signature|signature verification|Invalid/);
  });

  it("F-5: single Stripe SDK construction (no second instance with overrides)", () => {
    const stripeCtors = [...webhookSrc.matchAll(/new\s+Stripe\s*\(/g)];
    expect(stripeCtors.length).toBe(1);
  });

  it("F-6: switch over event.type has no default branch dispatching arbitrary types", () => {
    const switchStart = webhookSrc.indexOf("switch (event.type)");
    expect(switchStart).toBeGreaterThan(-1);

    let depth = 0;
    let i = webhookSrc.indexOf("{", switchStart);
    const start = i;
    depth = 1;
    i++;
    while (i < webhookSrc.length && depth > 0) {
      if (webhookSrc[i] === "{") depth++;
      else if (webhookSrc[i] === "}") depth--;
      i++;
    }
    const switchBody = webhookSrc.slice(start, i);

    expect(switchBody).not.toMatch(/^\s*default\s*:/m);
  });

  it("F-7: stripe-signature header read explicitly (no header-name drift)", () => {
    expect(webhookSrc).toMatch(/request\.headers\.get\(["']stripe-signature["']\)/);
  });
});
