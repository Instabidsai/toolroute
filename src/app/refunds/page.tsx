import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund Policy | ToolRoute",
  description: "ToolRoute refund policy for prepaid credits, subscriptions, failed payments, billing errors, and abuse cases.",
  alternates: { canonical: "/refunds" },
};

const sections = [
  {
    title: "Prepaid credits",
    body: "Prepaid credits are generally non-refundable once purchased because ToolRoute may commit or incur provider costs when tool calls are made. Unused credits may be reviewed for refund at ToolRoute's discretion when requested within 14 days of purchase.",
  },
  {
    title: "Subscriptions",
    body: "Monthly subscription fees are generally non-refundable after the billing period begins. If you cancel, the plan remains active through the current paid period unless ToolRoute states otherwise.",
  },
  {
    title: "Billing errors",
    body: "If we confirm a duplicate charge, incorrect plan charge, failed checkout capture, or ToolRoute billing defect, we will issue a refund or account credit for the affected amount.",
  },
  {
    title: "Provider failures",
    body: "Transient upstream errors, rate limits, unavailable third-party APIs, or failed provider calls do not automatically create a refund right. ToolRoute may credit requests that were billed but clearly failed due to a ToolRoute-side defect.",
  },
  {
    title: "Abuse and policy violations",
    body: "Accounts suspended for fraud, spam, abuse, chargeback abuse, sanctions risk, or Acceptable Use Policy violations are not eligible for refunds unless required by law.",
  },
  {
    title: "How to request review",
    body: "Email support@toolroute.ai with the account email, invoice or payment ID, approximate timestamp, and reason for the request. We may ask for additional verification before issuing any refund.",
  },
];

export default function RefundsPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-8 pb-16">
      <header className="space-y-4 border-b border-border pb-8">
        <p className="text-xs font-medium uppercase tracking-wider text-accent">
          Last updated 2026-04-27
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Refund Policy</h1>
        <p className="text-sm leading-6 text-text-dim">
          This policy covers ToolRoute credits, subscriptions, billing errors,
          provider failures, and abuse-related refund limits.
        </p>
      </header>

      {sections.map((section) => (
        <section key={section.title} className="space-y-3">
          <h2 className="text-lg font-semibold">{section.title}</h2>
          <p className="text-sm leading-6 text-text-dim">{section.body}</p>
        </section>
      ))}

      <footer className="border-t border-border pt-6 text-sm text-text-dim">
        Billing review requests:{" "}
        <a className="text-accent hover:text-accent-hover" href="mailto:support@toolroute.ai">
          support@toolroute.ai
        </a>
      </footer>
    </article>
  );
}
