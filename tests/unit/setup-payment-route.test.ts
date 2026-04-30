import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAccountActor: vi.fn(),
  getUserFromSession: vi.fn(),
  supabaseAdmin: vi.fn(),
  stripe: {
    customers: {
      create: vi.fn(),
    },
    checkout: {
      sessions: {
        create: vi.fn(),
      },
    },
  },
  getStripeClient: vi.fn(),
}));

vi.mock("@/lib/stripe-billing", () => ({
  getStripeClient: mocks.getStripeClient,
}));

vi.mock("@/lib/account-auth", () => ({
  getAccountActor: mocks.getAccountActor,
}));

vi.mock("@/lib/gateway", () => ({
  CORS_HEADERS: {},
  AUTHED_RESPONSE_HEADERS: {},
  NO_STORE_HEADERS: {},
  getUserFromSession: mocks.getUserFromSession,
  supabaseAdmin: mocks.supabaseAdmin,
}));

import { POST } from "@/app/api/v1/billing/setup-payment/route";

function requestFor() {
  return new Request("https://toolroute.ai/api/v1/billing/setup-payment", {
    method: "POST",
    headers: {
      Authorization: "Bearer user-token",
    },
  }) as NextRequest;
}

function buildSupabaseMock(user: { email: string; stripe_customer_id: string | null }) {
  const selectChain = {
    eq: vi.fn(() => selectChain),
    single: vi.fn().mockResolvedValue({ data: user, error: null }),
  };
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const table = {
    select: vi.fn(() => selectChain),
    update: vi.fn(() => ({ eq: updateEq })),
  };
  const from = vi.fn(() => table);
  mocks.supabaseAdmin.mockReturnValue({ from });

  return { from, selectChain, table, updateEq };
}

describe("POST /api/v1/billing/setup-payment", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    mocks.getStripeClient.mockReturnValue(mocks.stripe);
    mocks.getAccountActor.mockResolvedValue({
      userId: "user_123",
      email: "agent@example.com",
      authKind: "session",
    });
    mocks.stripe.customers.create.mockResolvedValue({ id: "cus_new" });
    mocks.stripe.checkout.sessions.create.mockResolvedValue({
      url: "https://checkout.stripe.test/setup",
    });
  });

  it("creates a Stripe customer when one is not stored", async () => {
    const supabase = buildSupabaseMock({
      email: "agent@example.com",
      stripe_customer_id: null,
    });

    const response = await POST(requestFor());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.checkout_url).toBe("https://checkout.stripe.test/setup");
    expect(payload.customer_id).toBe("cus_new");
    expect(mocks.stripe.customers.create).toHaveBeenCalledWith({
      email: "agent@example.com",
      metadata: {
        user_id: "user_123",
        source: "toolroute_auto_topup_setup",
      },
    });
    expect(supabase.table.update).toHaveBeenCalledWith(
      expect.objectContaining({ stripe_customer_id: "cus_new" })
    );
    expect(mocks.stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "setup",
        customer: "cus_new",
        payment_method_types: ["card"],
      })
    );
  });

  it("reuses an existing Stripe customer", async () => {
    const supabase = buildSupabaseMock({
      email: "agent@example.com",
      stripe_customer_id: "cus_existing",
    });

    const response = await POST(requestFor());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.customer_id).toBe("cus_existing");
    expect(mocks.stripe.customers.create).not.toHaveBeenCalled();
    expect(supabase.table.update).not.toHaveBeenCalled();
    expect(mocks.stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "setup",
        customer: "cus_existing",
      })
    );
  });
});
