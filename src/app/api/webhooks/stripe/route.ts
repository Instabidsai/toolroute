import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/gateway";
import { sendDunningEmail } from "@/lib/stripe-dunning";
import { assertBodyUnder, BODY_LIMITS } from "@/lib/body-limit";
import { GatewayError } from "@/lib/gateway-types";

const PLAN_CREDITS: Record<string, number> = {
  pro: 5.0,
  enterprise: 50.0,
};

async function recordPaymentFailure({
  sb,
  customerId,
  stripePaymentId,
  eventType,
  reason,
  retryUrl,
  description,
}: {
  sb: ReturnType<typeof supabaseAdmin>;
  customerId: string | null;
  stripePaymentId: string;
  eventType: string;
  reason: string;
  retryUrl: string | null;
  description: string;
}) {
  if (!customerId) return;

  const { data: user } = await sb
    .from("gateway_users")
    .select("id, email, credit_balance")
    .eq("stripe_customer_id", customerId)
    .single();

  if (!user) return;

  const { data: existing } = await sb
    .from("credit_transactions")
    .select("id")
    .eq("stripe_payment_id", stripePaymentId)
    .eq("type", "payment_failed")
    .single();

  let shouldEmail = false;

  if (!existing) {
    const { error: insertError } = await sb.from("credit_transactions").insert({
      user_id: user.id,
      amount: 0,
      balance_after: user.credit_balance ?? 0,
      type: "payment_failed",
      description,
      stripe_payment_id: stripePaymentId,
      metadata: {
        status: "failed",
        event_type: eventType,
        reason,
        retry_url: retryUrl,
      },
    });

    shouldEmail = !insertError;
  }

  if (shouldEmail) {
    await sendDunningEmail(user.email, { retryUrl, reason }).catch(() => false);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertBodyUnder(request, BODY_LIMITS.stripe_webhook);
  } catch (err) {
    if (err instanceof GatewayError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status }
      );
    }
    throw err;
  }

  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey || secretKey.startsWith("placeholder") || !webhookSecret || webhookSecret.startsWith("placeholder")) {
    console.error("Stripe not configured");
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const stripe = new Stripe(secretKey);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook signature verification failed:", msg);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const sb = supabaseAdmin();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        const type = session.metadata?.type;

        if (!userId) {
          console.error("No user_id in session metadata");
          break;
        }

        if (type === "credits") {
          const creditAmount = parseFloat(session.metadata?.credit_amount ?? "0");
          if (creditAmount > 0) {
            // Idempotency check: skip if this payment was already processed
            const { data: existing } = await sb
              .from("credit_transactions")
              .select("id")
              .eq("stripe_payment_id", session.payment_intent as string)
              .single();

            if (existing) {
              console.log("Already processed payment:", session.payment_intent);
              break;
            }

            // Platform fee is handled by Stripe (we set the price). Net credit = purchase amount.
            await sb.rpc("add_credits", {
              p_user_id: userId,
              p_amount: creditAmount,
              p_type: "purchase",
              p_stripe_payment_id: session.payment_intent as string,
              p_description: `$${creditAmount} credit purchase`,
            });

            // Save stripe_customer_id if not already set (enables auto-top-up later)
            if (session.customer) {
              await sb
                .from("gateway_users")
                .update({
                  stripe_customer_id: session.customer as string,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", userId)
                .is("stripe_customer_id", null);
            }

            console.log(`Added $${creditAmount} credits for user ${userId}`);
          }
        }

        if (type === "subscription") {
          const plan = session.metadata?.plan;
          if (plan) {
            // Update user plan
            const { data: planRow } = await sb
              .from("plans")
              .select("id")
              .eq("slug", plan)
              .single();

            if (planRow) {
              await sb
                .from("gateway_users")
                .update({
                  plan_id: planRow.id,
                  plan_slug: plan,
                  stripe_customer_id: session.customer as string,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", userId);

              // Add included plan credits (idempotent on session.subscription)
              const planCredits = PLAN_CREDITS[plan] ?? 0;
              if (planCredits > 0 && session.subscription) {
                const { data: existingPlanTx } = await sb
                  .from("credit_transactions")
                  .select("id")
                  .eq("stripe_payment_id", session.subscription as string)
                  .maybeSingle();

                if (!existingPlanTx) {
                  await sb.rpc("add_credits", {
                    p_user_id: userId,
                    p_amount: planCredits,
                    p_type: "plan_credit",
                    p_stripe_payment_id: session.subscription as string,
                    p_description: `${plan} plan monthly credits`,
                  });
                } else {
                  console.log("Already granted plan credits for subscription:", session.subscription);
                }
              }
            }
            console.log(`Upgraded user ${userId} to ${plan} plan`);
          }
        }
        break;
      }

      case "invoice.paid": {
        // Monthly subscription renewal — add plan credits (idempotent on invoice.id)
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const { data: user } = await sb
          .from("gateway_users")
          .select("id, plan_slug")
          .eq("stripe_customer_id", customerId)
          .single();

        if (user && user.plan_slug && invoice.id) {
          const planCredits = PLAN_CREDITS[user.plan_slug] ?? 0;
          if (planCredits > 0) {
            const { data: existingRenewalTx } = await sb
              .from("credit_transactions")
              .select("id")
              .eq("stripe_payment_id", invoice.id)
              .maybeSingle();

            if (!existingRenewalTx) {
              await sb.rpc("add_credits", {
                p_user_id: user.id,
                p_amount: planCredits,
                p_type: "plan_credit",
                p_stripe_payment_id: invoice.id,
                p_description: `${user.plan_slug} plan monthly credits (renewal)`,
              });
              console.log(`Added $${planCredits} renewal credits for user ${user.id}`);
            } else {
              console.log("Already granted renewal credits for invoice:", invoice.id);
            }
          }
        }
        break;
      }

      case "payment_intent.succeeded": {
        // Handle auto-top-up payments (created off-session by triggerAutoTopup)
        const pi = event.data.object as Stripe.PaymentIntent;
        if (pi.metadata?.type === "auto_topup") {
          const userId = pi.metadata.user_id;
          const creditAmount = parseFloat(pi.metadata.credit_amount ?? "0");

          if (userId && creditAmount > 0) {
            // Idempotency check
            const { data: existing } = await sb
              .from("credit_transactions")
              .select("id")
              .eq("stripe_payment_id", pi.id)
              .single();

            if (!existing) {
              await sb.rpc("add_credits", {
                p_user_id: userId,
                p_amount: creditAmount,
                p_type: "purchase",
                p_stripe_payment_id: pi.id,
                p_description: `Auto top-up $${creditAmount.toFixed(2)}`,
              });
              console.log(`Auto-top-up: added $${creditAmount} credits for user ${userId}`);
            }
          }
        }
        break;
      }

      case "setup_intent.succeeded": {
        const setupIntent = event.data.object as Stripe.SetupIntent;
        const customerId = setupIntent.customer as string | null;
        const paymentMethodId = setupIntent.payment_method as string | null;

        if (customerId && paymentMethodId) {
          await stripe.customers.update(customerId, {
            invoice_settings: {
              default_payment_method: paymentMethodId,
            },
          });
          console.log(`Saved default payment method for customer ${customerId}`);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string | null;
        const reason =
          typeof invoice.last_finalization_error?.message === "string"
            ? invoice.last_finalization_error.message
            : "Invoice payment failed";

        await recordPaymentFailure({
          sb,
          customerId,
          stripePaymentId: invoice.id,
          eventType: event.type,
          reason,
          retryUrl: invoice.hosted_invoice_url ?? null,
          description: `Invoice payment failed${invoice.amount_due ? ` ($${(invoice.amount_due / 100).toFixed(2)})` : ""}`,
        });
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const customerId = paymentIntent.customer as string | null;
        const reason =
          paymentIntent.last_payment_error?.message || "Payment intent failed";

        await recordPaymentFailure({
          sb,
          customerId,
          stripePaymentId: paymentIntent.id,
          eventType: event.type,
          reason,
          retryUrl: null,
          description: `Payment failed${paymentIntent.amount ? ` ($${(paymentIntent.amount / 100).toFixed(2)})` : ""}`,
        });
        break;
      }

      case "customer.subscription.deleted": {
        // Downgrade to free
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        const { data: freePlan } = await sb
          .from("plans")
          .select("id")
          .eq("slug", "free")
          .single();

        if (freePlan) {
          await sb
            .from("gateway_users")
            .update({
              plan_id: freePlan.id,
              plan_slug: "free",
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_customer_id", customerId);
          console.log(`Downgraded customer ${customerId} to free plan`);
        }
        break;
      }
    }
  } catch (err) {
    console.error("Webhook processing error:", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
