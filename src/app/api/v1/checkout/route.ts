import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getUserFromSession, CORS_HEADERS } from "@/lib/gateway";
import { GatewayError } from "@/lib/gateway-types";

const CREDIT_PRICES: Record<string, { amount: number; priceId: string }> = {
  "5": { amount: 5, priceId: process.env.STRIPE_PRICE_CREDITS_5 ?? "" },
  "10": { amount: 10, priceId: process.env.STRIPE_PRICE_CREDITS_10 ?? "" },
  "25": { amount: 25, priceId: process.env.STRIPE_PRICE_CREDITS_25 ?? "" },
  "50": { amount: 50, priceId: process.env.STRIPE_PRICE_CREDITS_50 ?? "" },
  "100": { amount: 100, priceId: process.env.STRIPE_PRICE_CREDITS_100 ?? "" },
};

const PLAN_PRICES: Record<string, string> = {
  pro: process.env.STRIPE_PRICE_PRO ?? "",
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE ?? "",
};

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.startsWith("placeholder")) {
    throw new GatewayError(
      "Stripe is not configured yet. Contact support.",
      503,
      "stripe_not_configured"
    );
  }
  return new Stripe(key);
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const { userId, email } = await getUserFromSession(authHeader);

    const body = await request.json();
    const { type, amount, plan } = body as {
      type: "credits" | "subscription";
      amount?: string;
      plan?: string;
    };

    if (!type) {
      return NextResponse.json(
        { error: { message: "Missing type: 'credits' or 'subscription'", code: "missing_type" } },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const stripe = getStripe();
    const origin = "https://toolroute.ai"; // Always use production URL for Stripe redirects

    if (type === "credits") {
      const credit = CREDIT_PRICES[amount ?? ""];
      if (!credit) {
        return NextResponse.json(
          { error: { message: "Invalid amount. Choose: 5, 10, 25, 50, or 100", code: "invalid_amount" } },
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: email,
        line_items: [{ price: credit.priceId, quantity: 1 }],
        metadata: {
          user_id: userId,
          type: "credits",
          credit_amount: String(credit.amount),
        },
        success_url: `${origin}/dashboard/billing?success=true&amount=${credit.amount}`,
        cancel_url: `${origin}/dashboard/billing?canceled=true`,
      });

      return NextResponse.json(
        { checkout_url: session.url },
        { headers: CORS_HEADERS }
      );
    }

    if (type === "subscription") {
      const priceId = PLAN_PRICES[plan ?? ""];
      if (!priceId) {
        return NextResponse.json(
          { error: { message: "Invalid plan. Choose: pro or enterprise", code: "invalid_plan" } },
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer_email: email,
        line_items: [{ price: priceId, quantity: 1 }],
        metadata: {
          user_id: userId,
          type: "subscription",
          plan: plan!,
        },
        success_url: `${origin}/dashboard/billing?success=true&plan=${plan}`,
        cancel_url: `${origin}/dashboard/billing?canceled=true`,
      });

      return NextResponse.json(
        { checkout_url: session.url },
        { headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      { error: { message: "type must be 'credits' or 'subscription'", code: "invalid_type" } },
      { status: 400, headers: CORS_HEADERS }
    );
  } catch (err) {
    if (err instanceof GatewayError) {
      return NextResponse.json(
        { error: { message: err.message, code: err.code } },
        { status: err.status, headers: CORS_HEADERS }
      );
    }
    console.error("Checkout error:", err);
    return NextResponse.json(
      { error: { message: "Failed to create checkout session", code: "checkout_error" } },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
