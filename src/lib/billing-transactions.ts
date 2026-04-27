export interface BillingTransactionInput {
  amount: number;
  type: string;
  stripe_payment_id?: string | null;
  metadata?: Record<string, unknown> | null;
}

export function getTransactionStatus(tx: BillingTransactionInput) {
  const metadataStatus =
    typeof tx.metadata?.status === "string" ? tx.metadata.status : null;
  if (metadataStatus) return metadataStatus;

  if (tx.type.includes("failed")) return "failed";
  if (tx.type === "usage" || tx.amount < 0) return "usage";
  if (tx.stripe_payment_id || tx.type === "purchase" || tx.type === "plan_credit") {
    return "paid";
  }

  return "posted";
}

export function getStripeReference(tx: BillingTransactionInput) {
  if (tx.stripe_payment_id) return tx.stripe_payment_id;

  const metadataKeys = [
    "stripe_invoice_id",
    "invoice_id",
    "payment_intent",
    "payment_intent_id",
  ];

  for (const key of metadataKeys) {
    const value = tx.metadata?.[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return null;
}
