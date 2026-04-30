import Stripe from "stripe";

export interface PaymentMethodSummary {
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
}

export function cleanStripeEnvValue(value: string | undefined) {
  const cleaned = value?.trim().replace(/^["']|["']$/g, "").replace(/\s+/g, "");
  if (!cleaned || cleaned.startsWith("placeholder")) {
    return null;
  }
  return cleaned;
}

export function getStripeEnvValue(name: string) {
  return cleanStripeEnvValue(process.env[name]);
}

export function getStripeSecretKey() {
  return cleanStripeEnvValue(process.env.STRIPE_SECRET_KEY);
}

export function getStripeClient() {
  const key = getStripeSecretKey();
  if (!key) {
    return null;
  }
  return new Stripe(key);
}

function summarizePaymentMethod(
  paymentMethod: Stripe.PaymentMethod | string | null
): PaymentMethodSummary | null {
  if (
    !paymentMethod ||
    typeof paymentMethod === "string" ||
    paymentMethod.type !== "card" ||
    !paymentMethod.card
  ) {
    return null;
  }

  return {
    brand: paymentMethod.card.brand,
    last4: paymentMethod.card.last4,
    exp_month: paymentMethod.card.exp_month,
    exp_year: paymentMethod.card.exp_year,
  };
}

export async function getPaymentMethodSummary(
  stripe: Stripe | null,
  customerId: string | null
): Promise<PaymentMethodSummary | null> {
  if (!stripe || !customerId) {
    return null;
  }

  try {
    const customer = await stripe.customers.retrieve(customerId, {
      expand: ["invoice_settings.default_payment_method"],
    });

    if ("deleted" in customer && customer.deleted) {
      return null;
    }

    const defaultPaymentMethod = summarizePaymentMethod(
      customer.invoice_settings.default_payment_method
    );
    if (defaultPaymentMethod) {
      return defaultPaymentMethod;
    }

    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: "card",
      limit: 1,
    });

    return summarizePaymentMethod(paymentMethods.data[0] ?? null);
  } catch {
    return null;
  }
}
