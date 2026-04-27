import { describe, expect, it } from "vitest";
import { buildDunningEmailText } from "@/lib/stripe-dunning";

describe("buildDunningEmailText", () => {
  it("includes the retry URL and failure reason", () => {
    const text = buildDunningEmailText({
      retryUrl: "https://billing.stripe.test/retry",
      reason: "Card declined",
    });

    expect(text).toContain("Card declined");
    expect(text).toContain("https://billing.stripe.test/retry");
    expect(text).toContain("Auto top-up");
  });
});
