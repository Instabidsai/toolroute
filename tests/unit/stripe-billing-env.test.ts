import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanStripeEnvValue,
  getStripeEnvValue,
  getStripeSecretKey,
} from "@/lib/stripe-billing";

describe("Stripe billing env normalization", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("strips pasted whitespace, quotes, and newlines from Stripe env values", () => {
    expect(cleanStripeEnvValue("  'sk_live_abc123'\r\n")).toBe("sk_live_abc123");
    expect(cleanStripeEnvValue('"price_123"\n')).toBe("price_123");
    expect(cleanStripeEnvValue("sk_live_a b\tc")).toBe("sk_live_abc");
  });

  it("treats empty or placeholder Stripe values as unconfigured", () => {
    expect(cleanStripeEnvValue(undefined)).toBeNull();
    expect(cleanStripeEnvValue("  ")).toBeNull();
    expect(cleanStripeEnvValue("placeholder")).toBeNull();
  });

  it("normalizes STRIPE_SECRET_KEY and price env values through one helper", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "\nsk_test_local\r\n");
    vi.stubEnv("STRIPE_PRICE_CREDITS_5", " price_local_5\n");

    expect(getStripeSecretKey()).toBe("sk_test_local");
    expect(getStripeEnvValue("STRIPE_PRICE_CREDITS_5")).toBe("price_local_5");
  });

  it("keeps checkout on the shared Stripe helper instead of reading the secret directly", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/app/api/v1/checkout/route.ts"),
      "utf8"
    );

    expect(source).toMatch(/getStripeClient/);
    expect(source).not.toMatch(/process\.env\.STRIPE_SECRET_KEY/);
    expect(source).not.toMatch(/new\s+Stripe\s*\(/);
  });
});
