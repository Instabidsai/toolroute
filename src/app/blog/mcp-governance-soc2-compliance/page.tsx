import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title:
    "MCP Governance and SOC 2 Compliance for AI Agents: The 2026 Enterprise Playbook",
  description:
    "MCP lets AI agents call databases, APIs, and file systems. SOC 2 auditors want to know who called what, when, from where, and under what authority. Here is how to map MCP usage to the five trust services criteria without slowing down your engineering teams.",
  alternates: { canonical: "/blog/mcp-governance-soc2-compliance" },
  openGraph: {
    title: "MCP Governance and SOC 2 Compliance for AI Agents",
    description:
      "Map MCP tool usage to the five SOC 2 trust services criteria. Audit logs, access controls, data residency, vendor management, and how a gateway centralizes governance.",
    url: "https://toolroute.ai/blog/mcp-governance-soc2-compliance",
    type: "article",
    publishedTime: "2026-04-16T00:00:00Z",
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Does MCP usage fall inside the scope of a SOC 2 audit?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, if the MCP servers process, store, or transmit data covered by the audit scope. An MCP server that queries your production database, reads customer files, or calls a payment API is part of your information system. Auditors will want evidence that access is authorized, logged, monitored, and restricted per the trust services criteria. Treat every MCP server the same way you treat any other application that touches in-scope data.",
      },
    },
    {
      "@type": "Question",
      name: "Which trust services criteria apply to MCP deployments?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Security always applies. Availability applies if agents run customer-facing workflows. Confidentiality applies if agents handle non-public data. Processing integrity applies if tool calls modify records or perform calculations. Privacy applies if personal data passes through any tool call. Most production MCP deployments trigger at least Security, Confidentiality, and Processing Integrity simultaneously.",
      },
    },
    {
      "@type": "Question",
      name: "How does an MCP gateway reduce the SOC 2 audit burden?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Self-hosted MCP servers force you to implement authentication, authorization, logging, change management, and incident response for every server individually. Each one is an audit artifact. A gateway centralizes all of these controls into one system boundary. Auditors evaluate one control plane instead of 30. One access review instead of 30. One incident runbook instead of 30. The gateway becomes the control, and each upstream tool becomes a downstream vendor managed through a single interface.",
      },
    },
    {
      "@type": "Question",
      name: "What evidence do auditors ask for on MCP tool calls?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Auditors typically request sample tool call logs for a selected date range, showing caller identity, timestamp, tool name, operation, input parameters (secrets redacted), output status, and latency. They also request the access control matrix mapping API keys to permitted tools, the change log showing when permissions were granted or revoked, evidence of key rotation, retention proof, and incident records for any anomalies. If you cannot produce these within a few hours, you have a gap.",
      },
    },
    {
      "@type": "Question",
      name: "How long do MCP audit logs need to be retained?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "SOC 2 does not mandate a specific retention period, but auditors expect consistency with your documented policy. The common range is 12 months for the audit period plus one additional year for trend analysis and repeat findings. Regulated industries (healthcare, financial services, government) often require longer retention. Set a policy, enforce it technically, and make sure deletions happen on schedule. Keeping logs forever is a privacy liability, not a safety net.",
      },
    },
  ],
};

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline:
    "MCP Governance and SOC 2 Compliance for AI Agents: The 2026 Enterprise Playbook",
  description:
    "MCP lets AI agents call databases, APIs, and file systems. SOC 2 auditors want to know who called what, when, from where, and under what authority. Here is how to map MCP usage to the five trust services criteria.",
  datePublished: "2026-04-16T00:00:00Z",
  author: { "@type": "Organization", name: "ToolRoute" },
  publisher: {
    "@type": "Organization",
    name: "ToolRoute",
    url: "https://toolroute.ai",
  },
  mainEntityOfPage:
    "https://toolroute.ai/blog/mcp-governance-soc2-compliance",
};

export default function Article() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <article className="max-w-3xl mx-auto">
        <header className="mb-12">
          <p className="text-accent text-xs font-medium mb-4">Compliance</p>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">
            MCP Governance and SOC 2 Compliance for AI Agents: The 2026
            Enterprise Playbook
          </h1>
          <p className="text-text-dim text-sm leading-relaxed mb-4">
            AI agents now reach into the systems your SOC 2 auditor cares
            about. MCP is the plumbing that made that possible. Here is how to
            keep your Type II opinion clean without slowing down your agent
            teams.
          </p>
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <span>April 16, 2026</span>
            <span>11 min read</span>
            <span>ToolRoute Team</span>
          </div>
        </header>

        <div className="prose-custom space-y-8 text-sm leading-relaxed">
          <p>
            Most engineering teams adopted MCP before anyone in compliance
            noticed. An IDE picked up a Postgres server, a terminal spawned a
            GitHub MCP, a Slack agent started reading threads. Six months later
            the same teams are renewing a SOC 2 Type II and their auditor asks
            a simple question: show me who accessed production data last
            Tuesday at 2:14 PM. If the only answer is &quot;an AI agent did,
            probably,&quot; that control is failing.
          </p>
          <p>
            This guide is the enterprise playbook for MCP governance in 2026.
            It maps MCP usage to the five trust services criteria, walks
            through the specific controls auditors look for, and shows why
            centralizing MCP traffic through a gateway collapses the audit
            surface from dozens of servers to one.
          </p>

          <h2 className="text-xl font-bold pt-4">
            1. Why MCP Is In Scope Whether You Like It or Not
          </h2>
          <p>
            SOC 2 scope follows the data. If an MCP server touches in-scope
            systems, the MCP server is in scope. Most production deployments
            cross this line immediately:
          </p>
          <ul className="space-y-1.5 text-text-dim pl-4">
            <li>
              <strong className="text-text">Database MCP servers</strong> read
              or write customer records. That is the definition of a data
              processor in your information system.
            </li>
            <li>
              <strong className="text-text">File system MCP servers</strong>{" "}
              access source code, build artifacts, or customer uploads. All
              three are typically in scope.
            </li>
            <li>
              <strong className="text-text">Email and CRM MCP servers</strong>{" "}
              process personal data, which pulls in the Privacy criterion and
              often GDPR or state law requirements on top of SOC 2.
            </li>
            <li>
              <strong className="text-text">
                Payment, billing, and invoicing MCPs
              </strong>{" "}
              touch financial records. Processing Integrity applies. Some
              deployments also need PCI DSS segmentation analysis.
            </li>
          </ul>
          <p>
            The only MCP servers that stay cleanly out of scope are ones that
            operate on public data with no authentication, like a generic
            weather API or a read-only documentation fetcher. Everything else
            needs a control narrative.
          </p>

          <h2 className="text-xl font-bold pt-4">
            2. Mapping MCP Usage to the Five Trust Services Criteria
          </h2>
          <p>
            The five criteria all intersect with MCP in concrete, testable
            ways. This matrix is the one auditors walk through line by line.
          </p>

          <div className="bg-bg-card border border-border rounded-lg p-6 my-6">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-muted border-b border-border">
                  <th className="text-left pb-2 pr-4">Criterion</th>
                  <th className="text-left pb-2 pr-4">MCP-Specific Question</th>
                  <th className="text-left pb-2">Evidence Auditors Want</th>
                </tr>
              </thead>
              <tbody className="text-text-dim">
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-medium text-text">Security</td>
                  <td className="py-2 pr-4">
                    Who can invoke which tools, and how is that enforced?
                  </td>
                  <td className="py-2">
                    Access control matrix, key rotation policy, quarterly
                    access review.
                  </td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-medium text-text">
                    Availability
                  </td>
                  <td className="py-2 pr-4">
                    Do critical agent workflows depend on MCP uptime?
                  </td>
                  <td className="py-2">
                    SLAs, status page, incident log, failover documentation.
                  </td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-medium text-text">
                    Confidentiality
                  </td>
                  <td className="py-2 pr-4">
                    Can an MCP call expose non-public data outside its intended
                    audience?
                  </td>
                  <td className="py-2">
                    Scope-of-access review, output redaction rules, data
                    classification mapping.
                  </td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-medium text-text">
                    Processing Integrity
                  </td>
                  <td className="py-2 pr-4">
                    When an agent writes through an MCP tool, is the result
                    complete, valid, and authorized?
                  </td>
                  <td className="py-2">
                    Input validation rules, idempotency design, reconciliation
                    reports.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-text">Privacy</td>
                  <td className="py-2 pr-4">
                    Does MCP traffic carry personal data, and under what legal
                    basis?
                  </td>
                  <td className="py-2">
                    Data flow diagram, purpose limitation controls, DPIA and
                    DPA list.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p>
            The gap most teams trip over is Processing Integrity. An agent that
            inserts a customer record through an MCP database tool must produce
            records that are complete, valid, authorized, and timely. If the
            agent fabricated the email address because the user did not supply
            one, the integrity control is failing. Your validation layer needs
            to reject malformed writes before the MCP call completes.
          </p>

          <h2 className="text-xl font-bold pt-4">
            3. Audit Logging: The One Control Everything Else Depends On
          </h2>
          <p>
            Auditors can tolerate surprisingly weak controls elsewhere if your
            logs are airtight. They cannot tolerate gaps in the log. Every MCP
            tool call must be recorded with at least the following fields:
          </p>
          <ul className="space-y-1.5 text-text-dim pl-4">
            <li>
              <strong className="text-text">Timestamp in UTC</strong> with
              millisecond precision.
            </li>
            <li>
              <strong className="text-text">Caller identity</strong> (API key
              ID, agent ID, or OAuth subject, never the raw key).
            </li>
            <li>
              <strong className="text-text">
                Source IP and user agent string
              </strong>{" "}
              to prove network origin.
            </li>
            <li>
              <strong className="text-text">Tool name and operation</strong>{" "}
              (for example <code>postgres.query</code> or{" "}
              <code>gmail.send</code>).
            </li>
            <li>
              <strong className="text-text">Input parameters</strong> with
              secrets and PII redacted through a deterministic filter.
            </li>
            <li>
              <strong className="text-text">Response status and latency</strong>{" "}
              so incident analysis can reconstruct failure cascades.
            </li>
            <li>
              <strong className="text-text">Trace and correlation IDs</strong>{" "}
              so you can follow a single agent decision across multiple tool
              calls.
            </li>
          </ul>
          <p>
            Store these logs in append-only media. A managed logging service,
            an immutable object store with object lock, or a write-once
            database are all acceptable. Writable SQL tables are not. A
            detailed schema walkthrough lives in the companion{" "}
            <Link
              href="/blog/how-to-audit-mcp-tool-calls"
              className="text-accent hover:underline"
            >
              How to Audit MCP Tool Calls
            </Link>{" "}
            piece.
          </p>

          <h2 className="text-xl font-bold pt-4">
            4. Access Controls: Least Privilege For Every Agent
          </h2>
          <p>
            A standard finding on early-stage MCP audits is credential over-
            privilege. An API key labeled &quot;dev-agent&quot; turns out to
            have write access to seven production MCP servers. That is the same
            root-password problem we solved in 2005 for human users, now
            repeated for agents.
          </p>
          <p>Governance-grade access controls for MCP look like this:</p>
          <ul className="space-y-1.5 text-text-dim pl-4">
            <li>
              <strong className="text-text">One key per agent per purpose.</strong>{" "}
              If the same agent performs reads and writes in different
              workflows, issue separate keys so you can revoke or rotate one
              without breaking the other.
            </li>
            <li>
              <strong className="text-text">
                Permissions enumerated at the operation level
              </strong>
              , not just the tool level. &quot;postgres.select&quot; is not the
              same capability as &quot;postgres.delete.&quot;
            </li>
            <li>
              <strong className="text-text">
                Environment isolation enforced at the gateway
              </strong>
              , not just by convention. A dev-scoped key must be technically
              unable to reach a production MCP server.
            </li>
            <li>
              <strong className="text-text">
                Break-glass procedures with automatic alerting
              </strong>{" "}
              when elevated access is used. Humans can have emergency keys.
              Agents should not.
            </li>
            <li>
              <strong className="text-text">Quarterly access reviews</strong>{" "}
              signed by a named owner. If you cannot produce a signed review
              from last quarter, that is a finding on its own.
            </li>
          </ul>

          <h2 className="text-xl font-bold pt-4">
            5. Data Residency and Cross-Border Transfers
          </h2>
          <p>
            MCP makes data flow invisible. A German operator thinks their
            customer data stays in Frankfurt, then an agent spins up an MCP
            server that calls a US-hosted API and 500 rows of personal data
            have just crossed the Atlantic. Auditors care about this. So does
            the data protection authority.
          </p>
          <ul className="space-y-1.5 text-text-dim pl-4">
            <li>
              <strong className="text-text">
                Maintain a current data flow diagram
              </strong>{" "}
              that shows every MCP tool and where its backend processes data.
              Update it whenever a tool is added, moved, or retired.
            </li>
            <li>
              <strong className="text-text">
                Enforce residency at the routing layer
              </strong>
              . If your SOC 2 Confidentiality narrative says EU customer data
              stays in the EU, the gateway must block tool calls that would
              cross a region boundary.
            </li>
            <li>
              <strong className="text-text">
                Document the legal basis for every cross-border flow
              </strong>{" "}
              with standard contractual clauses, adequacy decisions, or
              binding corporate rules. Missing SCCs is one of the easiest ways
              to blow a privacy review.
            </li>
          </ul>

          <h2 className="text-xl font-bold pt-4">
            6. Vendor Management: Every MCP Server Is a Subprocessor
          </h2>
          <p>
            The MCP server is a vendor. The upstream API behind it is usually a
            second vendor. SOC 2 vendor management expects you to track both.
            If your email MCP wraps SendGrid, your subprocessor list needs both
            the MCP provider and SendGrid. Miss either one and you have a
            finding, not a detail.
          </p>
          <ul className="space-y-1.5 text-text-dim pl-4">
            <li>
              <strong className="text-text">Review each vendor annually</strong>{" "}
              against their most recent SOC 2 Type II, ISO 27001 certification,
              or equivalent independent assurance.
            </li>
            <li>
              <strong className="text-text">
                Track deprecation and end-of-life
              </strong>
              . MCP servers are young software. Some will be unmaintained by
              the time your next audit starts.
            </li>
            <li>
              <strong className="text-text">
                Escalate uncertified, unsupported servers
              </strong>{" "}
              to a named risk owner. The acceptable answer is not &quot;we have
              not looked.&quot;
            </li>
          </ul>

          <h2 className="text-xl font-bold pt-4">
            7. How a Gateway Collapses the Governance Surface
          </h2>
          <p>
            Every control above is achievable per-server. The problem is that
            you are running 10, 30, or 50 servers. A self-hosted fleet forces
            you to implement access control, logging, residency, and vendor
            management in each server. That is 10, 30, or 50 audit artifacts,
            each slightly different.
          </p>
          <p>
            An{" "}
            <Link
              href="/blog/what-is-an-mcp-gateway"
              className="text-accent hover:underline"
            >
              MCP gateway
            </Link>{" "}
            inverts the geometry. Agents authenticate once to the gateway. The
            gateway enforces permissions, redacts outputs, writes the audit
            log, routes by region, and brokers credentials to upstream tools.
            The entire control plane is one system boundary, evaluated once per
            audit.
          </p>

          <div className="bg-bg-card border border-border rounded-lg p-6 my-6">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-muted border-b border-border">
                  <th className="text-left pb-2 pr-4">Control</th>
                  <th className="text-left pb-2 pr-4">Self-Hosted Fleet</th>
                  <th className="text-left pb-2">Gateway-Managed Fleet</th>
                </tr>
              </thead>
              <tbody className="text-text-dim">
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-medium text-text">
                    Access Reviews
                  </td>
                  <td className="py-2 pr-4">
                    One per MCP server, often out of sync.
                  </td>
                  <td className="py-2 text-green-400">
                    One unified review across all tools.
                  </td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-medium text-text">
                    Audit Log
                  </td>
                  <td className="py-2 pr-4">
                    Per-server logs, different schemas, ad-hoc consolidation.
                  </td>
                  <td className="py-2 text-green-400">
                    One schema, one retention, one queryable store.
                  </td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-medium text-text">
                    Credential Vault
                  </td>
                  <td className="py-2 pr-4">
                    Keys scattered across config files and env vars.
                  </td>
                  <td className="py-2 text-green-400">
                    Central vault. Agents never see upstream keys.
                  </td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-medium text-text">
                    Residency
                  </td>
                  <td className="py-2 pr-4">
                    Enforced per server, easy to miss.
                  </td>
                  <td className="py-2 text-green-400">
                    Region-aware routing in one policy file.
                  </td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-medium text-text">
                    Vendor List
                  </td>
                  <td className="py-2 pr-4">
                    Maintained manually, often stale.
                  </td>
                  <td className="py-2 text-green-400">
                    Auto-updated from the tool registry.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-text">
                    Incident Response
                  </td>
                  <td className="py-2 pr-4">
                    Correlate across N servers under time pressure.
                  </td>
                  <td className="py-2 text-green-400">
                    One timeline, one kill switch, one post-mortem.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p>
            At ToolRoute, the gateway is how our own AI teams pass audits
            without slowing down. Every call to one of the{" "}
            <Link href="/tools" className="text-accent hover:underline">
              51 tools in the registry
            </Link>{" "}
            is logged with caller identity, redacted input, output status, and
            latency. Access reviews happen inside the dashboard. Residency
            routing is a config toggle. The companion{" "}
            <Link
              href="/blog/mcp-server-security-best-practices"
              className="text-accent hover:underline"
            >
              MCP Server Security Best Practices
            </Link>{" "}
            piece covers how the same centralization reduces the raw security
            surface, not just the audit paperwork.
          </p>

          <h2 className="text-xl font-bold pt-4">
            8. A SOC 2 Readiness Checklist for MCP
          </h2>
          <p>
            Run through this before the auditor arrives. Any line item without
            a concrete artifact is a future exception in the report.
          </p>
          <div className="bg-bg-card border border-border rounded-lg p-6 my-6">
            <ul className="space-y-2 text-text-dim text-xs">
              <li>
                <strong className="text-text">[ ] Scope document</strong>{" "}
                listing every MCP server, its purpose, the data it touches, and
                its owner.
              </li>
              <li>
                <strong className="text-text">[ ] Access matrix</strong>{" "}
                showing which API keys can call which tools and operations.
              </li>
              <li>
                <strong className="text-text">[ ] Audit log sample</strong>{" "}
                covering a full business day, with every required field.
              </li>
              <li>
                <strong className="text-text">[ ] Retention policy</strong>{" "}
                with technical enforcement, not just a wiki page.
              </li>
              <li>
                <strong className="text-text">[ ] Key rotation log</strong>{" "}
                showing every rotation event in the audit period.
              </li>
              <li>
                <strong className="text-text">[ ] Incident register</strong>{" "}
                with MCP-related events, root causes, and closure notes.
              </li>
              <li>
                <strong className="text-text">[ ] Vendor review file</strong>{" "}
                with SOC 2 Type II or equivalent for each upstream tool.
              </li>
              <li>
                <strong className="text-text">[ ] Data flow diagram</strong>{" "}
                with residency boundaries drawn explicitly.
              </li>
              <li>
                <strong className="text-text">[ ] Change log</strong>{" "}
                documenting every new tool, permission grant, and revocation.
              </li>
              <li>
                <strong className="text-text">[ ] Tabletop exercise</strong>{" "}
                from the past 12 months simulating an agent compromise.
              </li>
            </ul>
          </div>

          <h2 className="text-xl font-bold pt-4">Frequently Asked Questions</h2>

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-sm">
                Does MCP usage fall inside the scope of a SOC 2 audit?
              </h3>
              <p className="text-text-dim mt-1">
                Yes, if the MCP servers process, store, or transmit data
                covered by the audit scope. An MCP server that queries your
                production database, reads customer files, or calls a payment
                API is part of your information system. Auditors will want
                evidence that access is authorized, logged, monitored, and
                restricted per the trust services criteria.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                Which trust services criteria apply to MCP deployments?
              </h3>
              <p className="text-text-dim mt-1">
                Security always applies. Availability applies if agents run
                customer-facing workflows. Confidentiality applies if agents
                handle non-public data. Processing Integrity applies if tool
                calls modify records. Privacy applies if personal data passes
                through any tool call. Most production deployments trigger at
                least Security, Confidentiality, and Processing Integrity
                together.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                How does an MCP gateway reduce the audit burden?
              </h3>
              <p className="text-text-dim mt-1">
                A gateway centralizes authentication, logging, access control,
                and vendor management into one system boundary. Auditors
                evaluate one control plane instead of 30 individual MCP
                servers. One access review, one incident runbook, one retention
                policy. The gateway becomes the control, and each upstream
                tool becomes a downstream vendor managed through a single
                interface.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                What evidence do auditors ask for on MCP tool calls?
              </h3>
              <p className="text-text-dim mt-1">
                Auditors request sample tool call logs for a selected date
                range with caller identity, timestamp, tool name, operation,
                redacted input, output status, and latency. They also request
                the access control matrix, change log, evidence of key
                rotation, retention proof, and incident records for any
                anomalies.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                How long do MCP audit logs need to be retained?
              </h3>
              <p className="text-text-dim mt-1">
                SOC 2 does not mandate a specific retention period, but
                auditors expect consistency with your documented policy. The
                common range is 12 months for the audit period plus one
                additional year for trend analysis. Regulated industries often
                require longer. Set a policy, enforce it technically, and make
                sure deletions happen on schedule.
              </p>
            </div>
          </div>

          <div className="border-t border-border pt-8 mt-8">
            <h3 className="font-semibold text-sm mb-4">Related Articles</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/blog/mcp-server-security-best-practices"
                  className="text-accent hover:underline"
                >
                  MCP Server Security Best Practices 2026
                </Link>
              </li>
              <li>
                <Link
                  href="/blog/how-to-audit-mcp-tool-calls"
                  className="text-accent hover:underline"
                >
                  How to Audit MCP Tool Calls for Compliance
                </Link>
              </li>
              <li>
                <Link
                  href="/blog/shadow-mcp-risks"
                  className="text-accent hover:underline"
                >
                  Shadow MCP: The Security Risk Nobody Is Talking About
                </Link>
              </li>
              <li>
                <Link
                  href="/blog/what-is-an-mcp-gateway"
                  className="text-accent hover:underline"
                >
                  What Is an MCP Gateway? The Infrastructure Layer AI Agents
                  Need
                </Link>
              </li>
            </ul>
          </div>

          <div className="border-t border-border pt-8 mt-8">
            <p className="text-text-dim">
              ToolRoute is an MCP gateway built for teams that have to answer
              to auditors. Unified access control, unified audit log, unified
              vendor management across{" "}
              <Link href="/tools" className="text-accent hover:underline">
                51 tools in the registry
              </Link>
              . Start with the{" "}
              <Link href="/docs" className="text-accent hover:underline">
                docs
              </Link>
              , check the{" "}
              <Link href="/glossary" className="text-accent hover:underline">
                glossary
              </Link>{" "}
              for MCP terminology, or browse the{" "}
              <Link href="/faq" className="text-accent hover:underline">
                FAQ
              </Link>
              .
            </p>
          </div>
        </div>
      </article>
    </>
  );
}
