const DEFAULT_RETRY_URL = "https://toolroute.ai/dashboard/billing";
const DEFAULT_FROM_EMAIL = "ToolRoute <onboarding@resend.dev>";

export interface DunningEmailInput {
  retryUrl?: string | null;
  reason?: string | null;
}

export function buildDunningEmailText(input: DunningEmailInput) {
  const retryUrl = input.retryUrl || DEFAULT_RETRY_URL;
  const reason = input.reason || "Stripe could not complete the payment.";

  return [
    "A ToolRoute payment failed.",
    "",
    `Reason: ${reason}`,
    "",
    "Please update your payment method or retry the payment here:",
    retryUrl,
    "",
    "Auto top-up and plan credits may pause until the payment succeeds.",
  ].join("\n");
}

export async function sendDunningEmail(
  to: string | null | undefined,
  input: DunningEmailInput
) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey || !to) {
    return false;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM_EMAIL,
      to,
      subject: "ToolRoute payment failed",
      text: buildDunningEmailText(input),
    }),
  });

  return response.ok;
}
