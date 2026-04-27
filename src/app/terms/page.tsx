import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | ToolRoute",
  description: "ToolRoute customer terms for using the API gateway, dashboard, credits, and tool routing services.",
  alternates: { canonical: "/terms" },
};

const sections = [
  {
    title: "1. Agreement",
    body: [
      "These Terms of Service govern access to ToolRoute, including the website, dashboard, API keys, MCP endpoint, REST API, billing features, and related support services.",
      "By creating an account, using an API key, or making a request through ToolRoute, you agree to these terms and to the Acceptable Use Policy.",
    ],
  },
  {
    title: "2. Accounts and API keys",
    body: [
      "You are responsible for keeping account credentials and API keys secure. API keys may be test or live keys and may be rate limited, revoked, or rotated for security or abuse prevention.",
      "You may not share keys outside your organization, resell access to ToolRoute without written permission, or use another customer's account.",
    ],
  },
  {
    title: "3. Tool routing and upstream providers",
    body: [
      "ToolRoute routes requests to third-party tools and APIs. Upstream providers may apply their own terms, rate limits, content rules, availability limits, and billing rules.",
      "For bring-your-own-key connections, you authorize ToolRoute to use the provider credential you supply only to process your requested tool calls.",
    ],
  },
  {
    title: "4. Credits, billing, and taxes",
    body: [
      "ToolRoute uses prepaid credits and plan billing. Tool calls may deduct credits based on the tool, provider, operation, usage amount, and any applicable platform fees.",
      "You are responsible for taxes, card fees, chargebacks, and any provider-side charges connected to keys or accounts you control.",
    ],
  },
  {
    title: "5. Customer content",
    body: [
      "You retain rights to prompts, inputs, files, outputs, and other content you submit through ToolRoute. You grant ToolRoute the limited rights needed to route, process, secure, debug, and bill those requests.",
      "You represent that you have the rights and permissions needed to submit customer content to ToolRoute and the selected upstream provider.",
    ],
  },
  {
    title: "6. Restrictions",
    body: [
      "You may not use ToolRoute for illegal activity, abusive automation, credential theft, spam, malware, unauthorized scraping, privacy violations, or activity prohibited by the Acceptable Use Policy.",
      "You may not bypass rate limits, exploit billing flaws, probe other accounts, or interfere with the reliability of ToolRoute or upstream providers.",
    ],
  },
  {
    title: "7. Availability and changes",
    body: [
      "ToolRoute is provided on an as-available basis. We may change, suspend, or remove tools, adapters, pricing, rate limits, or features when needed for security, provider compliance, reliability, or business reasons.",
      "We may update these terms. Material changes will be posted on this page with a new updated date.",
    ],
  },
  {
    title: "8. Disclaimers and liability",
    body: [
      "ToolRoute does not guarantee that any upstream tool output is accurate, lawful for your use case, available without interruption, or suitable for regulated workloads.",
      "To the maximum extent allowed by law, ToolRoute is not liable for indirect, incidental, special, consequential, exemplary, or lost-profit damages.",
    ],
  },
  {
    title: "9. Termination",
    body: [
      "You may stop using ToolRoute at any time. We may suspend or terminate access for nonpayment, abuse, legal risk, security risk, or violation of these terms.",
      "After termination, you remain responsible for outstanding charges and for activity that occurred before termination.",
    ],
  },
];

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-8 pb-16">
      <header className="space-y-4 border-b border-border pb-8">
        <p className="text-xs font-medium uppercase tracking-wider text-accent">
          Last updated 2026-04-27
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
        <p className="text-sm leading-6 text-text-dim">
          These terms apply to ToolRoute customers and users. For abuse restrictions,
          read the <Link className="text-accent hover:text-accent-hover" href="/aup">Acceptable Use Policy</Link>.
        </p>
      </header>

      {sections.map((section) => (
        <section key={section.title} className="space-y-3">
          <h2 className="text-lg font-semibold">{section.title}</h2>
          {section.body.map((paragraph) => (
            <p key={paragraph} className="text-sm leading-6 text-text-dim">
              {paragraph}
            </p>
          ))}
        </section>
      ))}

      <footer className="border-t border-border pt-6 text-sm text-text-dim">
        Questions about these terms:{" "}
        <a className="text-accent hover:text-accent-hover" href="mailto:support@toolroute.ai">
          support@toolroute.ai
        </a>
      </footer>
    </article>
  );
}
