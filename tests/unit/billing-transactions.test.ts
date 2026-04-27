import { describe, expect, it } from "vitest";
import {
  getStripeReference,
  getTransactionStatus,
} from "@/lib/billing-transactions";

describe("billing transaction helpers", () => {
  it("derives paid invoice status and Stripe reference", () => {
    const tx = {
      amount: 5,
      type: "purchase",
      stripe_payment_id: "pi_123",
      metadata: null,
    };

    expect(getTransactionStatus(tx)).toBe("paid");
    expect(getStripeReference(tx)).toBe("pi_123");
  });

  it("uses metadata status and invoice id when present", () => {
    const tx = {
      amount: 0,
      type: "payment_failed",
      stripe_payment_id: null,
      metadata: {
        status: "failed",
        stripe_invoice_id: "in_123",
      },
    };

    expect(getTransactionStatus(tx)).toBe("failed");
    expect(getStripeReference(tx)).toBe("in_123");
  });
});
