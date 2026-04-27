import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | ToolRoute",
  description: "How ToolRoute collects, uses, retains, and protects customer account, billing, API usage, and support data.",
  alternates: { canonical: "/privacy" },
};

const sections = [
  {
    title: "1. Information we collect",
    items: [
      "Account data such as email address, login identifiers, plan, billing status, and account settings.",
      "API usage data such as tool slug, operation, request status, latency, credit cost, key prefix, and error metadata needed for billing and debugging.",
      "Billing data processed through Stripe. ToolRoute does not store full card numbers.",
      "Provider credentials you choose to save for BYOK use. These are used to process your requested tool calls.",
      "Support and abuse report content you send to us.",
    ],
  },
  {
    title: "2. How we use information",
    items: [
      "Operate the gateway, dashboard, MCP endpoint, REST API, and billing systems.",
      "Authenticate users, create API keys, enforce rate limits, and prevent abuse.",
      "Route requests to upstream providers and return responses.",
      "Track credits, invoices, refunds, failed payments, and account notices.",
      "Debug reliability issues, investigate abuse, improve adapter quality, and respond to support requests.",
    ],
  },
  {
    title: "3. Upstream providers and subprocessors",
    items: [
      "ToolRoute sends request content to the upstream tool or provider selected for a tool call.",
      "Providers may process data under their own terms and privacy policies. You are responsible for choosing tools appropriate for your data.",
      "Core subprocessors may include Supabase for database/auth, Vercel for hosting, Stripe for payments, Resend for email, and selected tool providers for execution.",
    ],
  },
  {
    title: "4. Security and retention",
    items: [
      "We use access controls, hashed API keys, service-role separation, and operational logging to protect the platform.",
      "We retain account, billing, usage, and security logs as needed for operations, dispute resolution, legal compliance, abuse prevention, and product improvement.",
      "Do not submit regulated health, payment-card, child, biometric, or similarly sensitive data unless ToolRoute has agreed in writing to the required compliance terms.",
    ],
  },
  {
    title: "5. Your choices",
    items: [
      "You can revoke API keys, remove BYOK credentials, update billing settings, or stop using ToolRoute.",
      "You may request access, correction, export, or deletion of account data where required by applicable law.",
      "Some records may be retained when necessary for security, legal, tax, billing, or abuse-prevention reasons.",
    ],
  },
  {
    title: "6. Contact",
    items: [
      "Privacy requests can be sent to support@toolroute.ai. We may need to verify your account before acting on a request.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-8 pb-16">
      <header className="space-y-4 border-b border-border pb-8">
        <p className="text-xs font-medium uppercase tracking-wider text-accent">
          Last updated 2026-04-27
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="text-sm leading-6 text-text-dim">
          This policy explains how ToolRoute handles data for the website,
          dashboard, API gateway, MCP endpoint, billing, support, and abuse
          workflows.
        </p>
      </header>

      {sections.map((section) => (
        <section key={section.title} className="space-y-3">
          <h2 className="text-lg font-semibold">{section.title}</h2>
          <ul className="space-y-2 text-sm leading-6 text-text-dim">
            {section.items.map((item) => (
              <li key={item} className="pl-4 before:-ml-4 before:pr-2 before:text-accent before:content-['-']">
                {item}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </article>
  );
}
