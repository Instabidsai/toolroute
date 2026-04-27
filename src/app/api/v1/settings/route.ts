import { NextRequest, NextResponse } from "next/server";
import { getUserFromSession, supabaseAdmin, CORS_HEADERS } from "@/lib/gateway";
import { GatewayError } from "@/lib/gateway-types";
import { getPaymentMethodSummary, getStripeClient } from "@/lib/stripe-billing";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const { userId } = await getUserFromSession(authHeader);

    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("gateway_users")
      .select(
        "display_name, email, plan_slug, credit_balance, auto_topup_enabled, auto_topup_threshold, auto_topup_amount_cents, stripe_customer_id"
      )
      .eq("id", userId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: { message: "User not found", code: "user_not_found" } },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const paymentMethod = await getPaymentMethodSummary(
      getStripeClient(),
      data.stripe_customer_id
    );

    return NextResponse.json(
      {
        display_name: data.display_name,
        email: data.email,
        plan_slug: data.plan_slug,
        credit_balance: data.credit_balance,
        auto_topup_enabled: data.auto_topup_enabled ?? false,
        auto_topup_threshold: data.auto_topup_threshold ?? 1.0,
        auto_topup_amount_cents: data.auto_topup_amount_cents ?? 1000,
        has_payment_method: !!paymentMethod,
        payment_method: paymentMethod,
      },
      { headers: CORS_HEADERS }
    );
  } catch (err) {
    if (err instanceof GatewayError) {
      return NextResponse.json(
        { error: { message: err.message, code: err.code } },
        { status: err.status, headers: CORS_HEADERS }
      );
    }
    console.error("Settings GET error:", err);
    return NextResponse.json(
      { error: { message: "Failed to fetch settings", code: "settings_error" } },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

const ALLOWED_FIELDS = new Set([
  "auto_topup_enabled",
  "auto_topup_threshold",
  "auto_topup_amount_cents",
  "display_name",
]);

const VALID_THRESHOLDS = [1.0, 5.0, 10.0];
const VALID_AMOUNTS_CENTS = [1000, 2500, 5000, 10000];

export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const { userId } = await getUserFromSession(authHeader);

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(body)) {
      if (!ALLOWED_FIELDS.has(key)) {
        return NextResponse.json(
          {
            error: {
              message: `Field "${key}" is not allowed. Allowed: ${[...ALLOWED_FIELDS].join(", ")}`,
              code: "invalid_field",
            },
          },
          { status: 400, headers: CORS_HEADERS }
        );
      }

      // Validate each field
      switch (key) {
        case "auto_topup_enabled":
          if (typeof value !== "boolean") {
            return NextResponse.json(
              { error: { message: "auto_topup_enabled must be a boolean", code: "invalid_value" } },
              { status: 400, headers: CORS_HEADERS }
            );
          }
          updates[key] = value;
          break;

        case "auto_topup_threshold":
          if (typeof value !== "number" || !VALID_THRESHOLDS.includes(value)) {
            return NextResponse.json(
              {
                error: {
                  message: `auto_topup_threshold must be one of: ${VALID_THRESHOLDS.join(", ")}`,
                  code: "invalid_value",
                },
              },
              { status: 400, headers: CORS_HEADERS }
            );
          }
          updates[key] = value;
          break;

        case "auto_topup_amount_cents":
          if (typeof value !== "number" || !VALID_AMOUNTS_CENTS.includes(value)) {
            return NextResponse.json(
              {
                error: {
                  message: `auto_topup_amount_cents must be one of: ${VALID_AMOUNTS_CENTS.join(", ")}`,
                  code: "invalid_value",
                },
              },
              { status: 400, headers: CORS_HEADERS }
            );
          }
          updates[key] = value;
          break;

        case "display_name":
          if (typeof value !== "string" || value.length < 1 || value.length > 100) {
            return NextResponse.json(
              { error: { message: "display_name must be a string between 1 and 100 characters", code: "invalid_value" } },
              { status: 400, headers: CORS_HEADERS }
            );
          }
          updates[key] = value;
          break;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: { message: "No valid fields to update", code: "no_updates" } },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // If enabling auto-topup, verify a reusable payment method exists.
    if (updates.auto_topup_enabled === true) {
      const sb = supabaseAdmin();
      const { data: user } = await sb
        .from("gateway_users")
        .select("stripe_customer_id")
        .eq("id", userId)
        .single();

      const paymentMethod = await getPaymentMethodSummary(
        getStripeClient(),
        user?.stripe_customer_id ?? null
      );

      if (!paymentMethod) {
        return NextResponse.json(
          {
            error: {
              message: "Cannot enable auto top-up without a payment method on file. Please purchase credits first to set up a payment method.",
              code: "no_payment_method",
            },
          },
          { status: 400, headers: CORS_HEADERS }
        );
      }
    }

    updates.updated_at = new Date().toISOString();

    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("gateway_users")
      .update(updates)
      .eq("id", userId)
      .select(
        "display_name, plan_slug, credit_balance, auto_topup_enabled, auto_topup_threshold, auto_topup_amount_cents, stripe_customer_id"
      )
      .single();

    if (error) {
      console.error("Settings update error:", error);
      return NextResponse.json(
        { error: { message: "Failed to update settings", code: "update_error" } },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const paymentMethod = await getPaymentMethodSummary(
      getStripeClient(),
      data.stripe_customer_id
    );

    return NextResponse.json(
      {
        display_name: data.display_name,
        plan_slug: data.plan_slug,
        credit_balance: data.credit_balance,
        auto_topup_enabled: data.auto_topup_enabled ?? false,
        auto_topup_threshold: data.auto_topup_threshold ?? 1.0,
        auto_topup_amount_cents: data.auto_topup_amount_cents ?? 1000,
        has_payment_method: !!paymentMethod,
        payment_method: paymentMethod,
      },
      { headers: CORS_HEADERS }
    );
  } catch (err) {
    if (err instanceof GatewayError) {
      return NextResponse.json(
        { error: { message: err.message, code: err.code } },
        { status: err.status, headers: CORS_HEADERS }
      );
    }
    console.error("Settings PATCH error:", err);
    return NextResponse.json(
      { error: { message: "Failed to update settings", code: "settings_error" } },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
