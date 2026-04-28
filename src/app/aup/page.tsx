import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Acceptable Use Policy | ToolRoute",
  description: "ToolRoute acceptable use rules for API keys, tool calls, BYOK credentials, and automation.",
  alternates: { canonical: "/aup" },
};

const prohibitedUses = [
  "Illegal activity, fraud, sanctions evasion, or activity that violates the rights of others.",
  "Spam, phishing, credential theft, deceptive outreach, harassment, or unwanted bulk messaging.",
  "Malware, exploit delivery, vulnerability abuse, botnet control, or unauthorized access attempts.",
  "Bypassing rate limits, abusing free/test keys, farming accounts, probing other tenants, or exploiting billing defects.",
  "Submitting data to providers when you do not have the rights, consent, or lawful basis to do so.",
  "Scraping, enrichment, or automation that violates a website, provider, platform, or data-source policy.",
  "Generating or distributing content that is abusive, sexually exploitative, defamatory, discriminatory, or intended to facilitate real-world harm.",
  "Using ToolRoute for regulated workloads that require HIPAA, PCI, FINRA, CJIS, or similar compliance without a written agreement.",
];

const enforcement = [
  "Throttle, suspend, or revoke API keys.",
  "Disable specific tools, providers, routes, or BYOK credentials.",
  "Block signups, disposable email domains, payment methods, IP ranges, or abusive traffic patterns.",
  "Report activity to providers, payment processors, or authorities when required or appropriate.",
  "Withhold refunds or credits connected to abuse, fraud, chargeback abuse, or policy violations.",
];

export default function AupPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-8 pb-16">
      <header className="space-y-4 border-b border-border pb-8">
        <p className="text-xs font-medium uppercase tracking-wider text-accent">
          Last updated 2026-04-27
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Acceptable Use Policy</h1>
        <p className="text-sm leading-6 text-text-dim">
          This policy applies to all ToolRoute accounts, API keys, tool calls,
          MCP sessions, BYOK credentials, dashboard actions, and support
          interactions.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Prohibited uses</h2>
        <ul className="space-y-2 text-sm leading-6 text-text-dim">
          {prohibitedUses.map((item) => (
            <li key={item} className="pl-4 before:-ml-4 before:pr-2 before:text-accent before:content-['-']">
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Provider rules</h2>
        <p className="text-sm leading-6 text-text-dim">
          ToolRoute does not override upstream provider rules. If a provider
          prohibits a use case, data type, resale model, output category, or
          automation pattern, you may not use ToolRoute to bypass that rule.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Enforcement</h2>
        <p className="text-sm leading-6 text-text-dim">
          We may investigate traffic, usage logs, billing events, support
          reports, and provider notices. Depending on risk, we may:
        </p>
        <ul className="space-y-2 text-sm leading-6 text-text-dim">
          {enforcement.map((item) => (
            <li key={item} className="pl-4 before:-ml-4 before:pr-2 before:text-accent before:content-['-']">
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Reporting abuse</h2>
        <p className="text-sm leading-6 text-text-dim">
          Report suspected abuse to{" "}
          <a className="text-accent hover:text-accent-hover" href="mailto:support@toolroute.ai">
            support@toolroute.ai
          </a>{" "}
          with the API key prefix, request ID, timestamp, tool name, and a short
          description when available.
        </p>
      </section>
    </article>
  );
}
