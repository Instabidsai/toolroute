import { NextRequest, NextResponse } from "next/server";
import { getUserFromSession, supabaseAdmin, AUTHED_RESPONSE_HEADERS } from "@/lib/gateway";
import { GatewayError } from "@/lib/gateway-types";
import { getStripeClient } from "@/lib/stripe-billing";

const CHECKOUT_ORIGIN = "https://toolroute.ai";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const { userId, email } = await getUserFromSession(authHeader);

    const stripe = getStripeClient();
    if (!stripe) {
      return NextResponse.json(
        { error: { message: "Stripe is not configured", code: "stripe_not_configured" } },
        { status: 503, headers: AUTHED_RESPONSE_HEADERS }
      );
    }

    const sb = supabaseAdmin();
    const { data: user, error: userError } = await sb
      .from("gateway_users")
      .select("email, stripe_customer_id")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: { message: "User not found", code: "user_not_found" } },
        { status: 404, headers: AUTHED_RESPONSE_HEADERS }
      );
    }

    let customerId = user.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || email,
        metadata: {
          user_id: userId,
          source: "toolroute_auto_topup_setup",
        },
      });
      customerId = customer.id;

      await sb
        .from("gateway_users")
        .update({
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "setup",
      customer: customerId,
      payment_method_types: ["card"],
      success_url: `${CHECKOUT_ORIGIN}/dashboard/billing?setup=success`,
      cancel_url: `${CHECKOUT_ORIGIN}/dashboard/billing?setup=canceled`,
      metadata: {
        user_id: userId,
        type: "setup_payment_method",
      },
      setup_intent_data: {
        metadata: {
          user_id: userId,
          type: "auto_topup_payment_method",
        },
      },
    });

    return NextResponse.json(
      { checkout_url: session.url, customer_id: customerId },
      { headers: AUTHED_RESPONSE_HEADERS }
    );
  } catch (err) {
    if (err instanceof GatewayError) {
      return NextResponse.json(
        { error: { message: err.message, code: err.code } },
        { status: err.status, headers: AUTHED_RESPONSE_HEADERS }
      );
    }

    console.error("Setup payment error:", err);
    return NextResponse.json(
      { error: { message: "Failed to create setup session", code: "setup_payment_failed" } },
      { status: 500, headers: AUTHED_RESPONSE_HEADERS }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: AUTHED_RESPONSE_HEADERS });
}
