import { NextRequest, NextResponse } from "next/server";
import { AUTHED_RESPONSE_HEADERS } from "@/lib/gateway";
import { getAccountActor } from "@/lib/account-auth";
import { GatewayError } from "@/lib/gateway-types";
import { assertBodyUnder, BODY_LIMITS } from "@/lib/body-limit";
import { getStripeClient, getStripeEnvValue } from "@/lib/stripe-billing";

const CREDIT_PRICE_ENV: Record<string, { amount: number; env: string }> = {
  "5": { amount: 5, env: "STRIPE_PRICE_CREDITS_5" },
  "10": { amount: 10, env: "STRIPE_PRICE_CREDITS_10" },
  "25": { amount: 25, env: "STRIPE_PRICE_CREDITS_25" },
  "50": { amount: 50, env: "STRIPE_PRICE_CREDITS_50" },
  "100": { amount: 100, env: "STRIPE_PRICE_CREDITS_100" },
};

const PLAN_PRICE_ENV: Record<string, string> = {
  pro: "STRIPE_PRICE_PRO",
  enterprise: "STRIPE_PRICE_ENTERPRISE",
};

function getStripe() {
  const stripe = getStripeClient();
  if (!stripe) {
    throw new GatewayError(
      "Stripe is not configured yet. Contact support.",
      503,
      "stripe_not_configured"
    );
  }
  return stripe;
}

function getCreditPrice(amount: string | undefined) {
  const credit = CREDIT_PRICE_ENV[amount ?? ""];
  if (!credit) return null;
  const priceId = getStripeEnvValue(credit.env);
  if (!priceId) {
    throw new GatewayError(
      "Stripe credit price is not configured yet. Contact support.",
      503,
      "stripe_price_not_configured"
    );
  }
  return { amount: credit.amount, priceId };
}

function getPlanPrice(plan: string | undefined) {
  const envName = PLAN_PRICE_ENV[plan ?? ""];
  if (!envName) return null;
  const priceId = getStripeEnvValue(envName);
  if (!priceId) {
    throw new GatewayError(
      "Stripe subscription price is not configured yet. Contact support.",
      503,
      "stripe_price_not_configured"
    );
  }
  return priceId;
}

export async function POST(request: NextRequest) {
  try {
    assertBodyUnder(request, BODY_LIMITS.checkout);

    const authHeader = request.headers.get("authorization");
    const { userId, email, authKind } = await getAccountActor(authHeader);

    const body = await request.json();
    const { type, amount, plan } = body as {
      type: "credits" | "subscription";
      amount?: string;
      plan?: string;
    };

    if (!type) {
      return NextResponse.json(
        { error: { message: "Missing type: 'credits' or 'subscription'", code: "missing_type" } },
        { status: 400, headers: AUTHED_RESPONSE_HEADERS }
      );
    }

    const stripe = getStripe();
    const origin = "https://toolroute.ai"; // Always use production URL for Stripe redirects

    if (type === "credits") {
      const credit = getCreditPrice(amount);
      if (!credit) {
        return NextResponse.json(
          { error: { message: "Invalid amount. Choose: 5, 10, 25, 50, or 100", code: "invalid_amount" } },
          { status: 400, headers: AUTHED_RESPONSE_HEADERS }
        );
      }

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: email || undefined,
        line_items: [{ price: credit.priceId, quantity: 1 }],
        metadata: {
          user_id: userId,
          type: "credits",
          credit_amount: String(credit.amount),
          initiated_by: authKind,
        },
        success_url: `${origin}/dashboard/billing?success=true&amount=${credit.amount}`,
        cancel_url: `${origin}/dashboard/billing?canceled=true`,
      });

      return NextResponse.json(
        {
          checkout_url: session.url,
          next: {
            browser_required: true,
            after_success: "/dashboard/keys?new=1",
            create_live_key: "/api/v1/keys",
            check_balance: "/api/v1/key",
          },
        },
        { headers: AUTHED_RESPONSE_HEADERS }
      );
    }

    if (type === "subscription") {
      const priceId = getPlanPrice(plan);
      if (!priceId) {
        return NextResponse.json(
          { error: { message: "Invalid plan. Choose: pro or enterprise", code: "invalid_plan" } },
          { status: 400, headers: AUTHED_RESPONSE_HEADERS }
        );
      }

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer_email: email || undefined,
        line_items: [{ price: priceId, quantity: 1 }],
        metadata: {
          user_id: userId,
          type: "subscription",
          plan: plan!,
          initiated_by: authKind,
        },
        success_url: `${origin}/dashboard/billing?success=true&plan=${plan}`,
        cancel_url: `${origin}/dashboard/billing?canceled=true`,
      });

      return NextResponse.json(
        {
          checkout_url: session.url,
          next: {
            browser_required: true,
            after_success: "/dashboard/keys?new=1",
            create_live_key: "/api/v1/keys",
            check_balance: "/api/v1/key",
          },
        },
        { headers: AUTHED_RESPONSE_HEADERS }
      );
    }

    return NextResponse.json(
      { error: { message: "type must be 'credits' or 'subscription'", code: "invalid_type" } },
      { status: 400, headers: AUTHED_RESPONSE_HEADERS }
    );
  } catch (err) {
    if (err instanceof GatewayError) {
      return NextResponse.json(
        { error: { message: err.message, code: err.code } },
        { status: err.status, headers: AUTHED_RESPONSE_HEADERS }
      );
    }
    console.error("Checkout error:", err);
    return NextResponse.json(
      { error: { message: "Failed to create checkout session", code: "checkout_error" } },
      { status: 500, headers: AUTHED_RESPONSE_HEADERS }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: AUTHED_RESPONSE_HEADERS });
}
