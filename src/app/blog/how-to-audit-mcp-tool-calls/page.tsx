import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title:
    "How to Audit MCP Tool Calls for Compliance: Schema, Retention, and SIEM Integration",
  description:
    "A practical guide to audit logging for MCP tool calls. The exact schema, what to capture per call, retention requirements, SIEM integration patterns, and real SQL examples for SOC 2, ISO 27001, and HIPAA.",
  alternates: { canonical: "/blog/how-to-audit-mcp-tool-calls" },
  openGraph: {
    title: "How to Audit MCP Tool Calls for Compliance",
    description:
      "Practical audit log schema for MCP tool calls. Fields, retention, SIEM integration, SQL examples, and how to pass SOC 2 on your AI agent infrastructure.",
    url: "https://toolroute.ai/blog/how-to-audit-mcp-tool-calls",
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
      name: "What fields should an MCP audit log capture?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "At minimum: a unique call ID, UTC timestamp with millisecond precision, caller identity (API key hash, agent ID, OAuth subject), source IP, tool name, operation, sanitized input parameters, response status, response size in bytes, latency in milliseconds, trace ID for correlation, and a schema version so you can evolve the format without breaking old queries. Secrets and personal data must be redacted deterministically before the log is written.",
      },
    },
    {
      "@type": "Question",
      name: "How long should I retain MCP audit logs?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The baseline is twelve months to cover a full SOC 2 Type II audit period. Add six to twelve more months if you want to support year-over-year trend analysis. Regulated industries need longer: HIPAA expects six years, PCI DSS expects one year with at least three months immediately accessible, and financial services can require seven. Set a written retention policy, enforce it technically with lifecycle rules, and make sure deletions happen on schedule.",
      },
    },
    {
      "@type": "Question",
      name: "Where should MCP audit logs live?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Append-only media is mandatory. Good options include a SIEM that ingests via syslog or HTTPS, an immutable object store with object lock enabled (S3, R2, GCS), a purpose-built audit log service, or a WORM-configured log database. Writable SQL tables on your production database are not acceptable. The person or process generating the logs must not have permission to modify or delete them.",
      },
    },
    {
      "@type": "Question",
      name: "How do I integrate MCP logs with a SIEM?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Most SIEMs ingest JSON events over HTTPS or syslog. Stream every tool call as a structured event with the fields listed above and a consistent event type name like mcp.tool.call. Map high-value fields (caller, tool, status, latency) into SIEM-native fields so your existing detection content works. Build alerts for the usual patterns: authentication failures, rate-limit breaches, unusual data volumes, tool use outside business hours, and repeated errors from a single caller.",
      },
    },
    {
      "@type": "Question",
      name: "How do I redact secrets and PII from MCP audit logs?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Redact at the gateway before writing the log. Use deterministic pattern matching for well-known secret formats (API keys, bearer tokens, database URLs) plus field-level allowlists for tool inputs so only explicitly-marked fields are logged in full. For personal data, hash identifiers like email and phone with a rotating salt so you can still correlate events across calls without storing the raw values. Treat redaction misses as security incidents, not minor bugs.",
      },
    },
  ],
};

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline:
    "How to Audit MCP Tool Calls for Compliance: Schema, Retention, and SIEM Integration",
  description:
    "Practical audit log schema for MCP tool calls. Fields, retention, SIEM integration, SQL examples, and how to pass SOC 2 on your AI agent infrastructure.",
  datePublished: "2026-04-16T00:00:00Z",
  author: { "@type": "Organization", name: "ToolRoute" },
  publisher: {
    "@type": "Organization",
    name: "ToolRoute",
    url: "https://toolroute.ai",
  },
  mainEntityOfPage:
    "https://toolroute.ai/blog/how-to-audit-mcp-tool-calls",
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
            How to Audit MCP Tool Calls for Compliance: Schema, Retention, and
            SIEM Integration
          </h1>
          <p className="text-text-dim text-sm leading-relaxed mb-4">
            Every auditor, incident responder, and debugging session eventually
            asks the same question: what did the agent actually do, and when?
            Here is the exact schema, retention policy, and SIEM pipeline that
            answers it without gaps.
          </p>
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <span>April 16, 2026</span>
            <span>12 min read</span>
            <span>ToolRoute Team</span>
          </div>
        </header>

        <div className="prose-custom space-y-8 text-sm leading-relaxed">
          <p>
            When an AI agent does something surprising, your first move is
            always the same: pull the logs. Within thirty seconds you need to
            see every tool it called, every input it sent, every response it
            got back, and the precise sequence. If your audit log is missing
            any of those fields, you are going to spend the next two days
            reconstructing a timeline from circumstantial evidence. Worse, if
            the incident turns into a compliance question, you are going to
            explain to an auditor why your primary control failed.
          </p>
          <p>
            This is the practical companion to our{" "}
            <Link
              href="/blog/mcp-server-security-best-practices"
              className="text-accent hover:underline"
            >
              MCP Server Security Best Practices
            </Link>{" "}
            and{" "}
            <Link
              href="/blog/mcp-governance-soc2-compliance"
              className="text-accent hover:underline"
            >
              MCP Governance and SOC 2 Compliance
            </Link>{" "}
            pieces. If those articles explain why audit logging matters, this
            one is the schema you paste into your design doc.
          </p>

          <h2 className="text-xl font-bold pt-4">
            1. The Minimum Viable Audit Schema
          </h2>
          <p>
            Every MCP tool call produces exactly one audit record. The record
            has a small required core and an optional extension area. Start
            with this minimum schema; you can evolve it without breaking
            anything if you include a schema version field from day one.
          </p>

          <div className="bg-[#0d0d18] border border-border rounded-lg p-4 my-4 font-mono text-xs overflow-x-auto">
            <p className="text-text-muted mb-2">
              -- mcp_audit_log table, append-only
            </p>
            <p className="text-text-dim">{`CREATE TABLE mcp_audit_log (`}</p>
            <p className="text-text-dim pl-4">{`  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),`}</p>
            <p className="text-text-dim pl-4">{`  event_ts       TIMESTAMPTZ NOT NULL DEFAULT now(),   -- UTC, ms precision`}</p>
            <p className="text-text-dim pl-4">{`  schema_version INT NOT NULL DEFAULT 1,`}</p>
            <p className="text-text-dim pl-4">{`  call_id        TEXT NOT NULL,                        -- unique per invocation`}</p>
            <p className="text-text-dim pl-4">{`  trace_id       TEXT,                                  -- links calls in one agent run`}</p>
            <p className="text-text-dim pl-4">{`  caller_id      TEXT NOT NULL,                        -- API key hash or OAuth sub`}</p>
            <p className="text-text-dim pl-4">{`  caller_type    TEXT NOT NULL,                        -- 'agent' | 'user' | 'system'`}</p>
            <p className="text-text-dim pl-4">{`  source_ip      INET,`}</p>
            <p className="text-text-dim pl-4">{`  user_agent     TEXT,`}</p>
            <p className="text-text-dim pl-4">{`  tool_name      TEXT NOT NULL,                        -- e.g. 'postgres'`}</p>
            <p className="text-text-dim pl-4">{`  operation      TEXT NOT NULL,                        -- e.g. 'query'`}</p>
            <p className="text-text-dim pl-4">{`  input_redacted JSONB NOT NULL,                       -- secrets stripped`}</p>
            <p className="text-text-dim pl-4">{`  status         TEXT NOT NULL,                        -- 'ok' | 'error' | 'denied'`}</p>
            <p className="text-text-dim pl-4">{`  error_code     TEXT,`}</p>
            <p className="text-text-dim pl-4">{`  response_bytes INT,`}</p>
            <p className="text-text-dim pl-4">{`  latency_ms     INT NOT NULL,`}</p>
            <p className="text-text-dim pl-4">{`  region         TEXT,                                  -- for residency controls`}</p>
            <p className="text-text-dim pl-4">{`  cost_cents     NUMERIC(12, 4),                        -- spend per call, optional`}</p>
            <p className="text-text-dim pl-4">{`  extra          JSONB                                  -- future-proofing`}</p>
            <p className="text-text-dim">{`);`}</p>
            <p className="text-text-dim mt-3">{`CREATE INDEX idx_audit_caller_ts ON mcp_audit_log (caller_id, event_ts DESC);`}</p>
            <p className="text-text-dim">{`CREATE INDEX idx_audit_tool_ts   ON mcp_audit_log (tool_name,  event_ts DESC);`}</p>
            <p className="text-text-dim">{`CREATE INDEX idx_audit_trace     ON mcp_audit_log (trace_id);`}</p>
          </div>

          <p>
            Three fields people forget on the first pass, every single time:
          </p>
          <ul className="space-y-1.5 text-text-dim pl-4">
            <li>
              <strong className="text-text">trace_id.</strong> One agent
              decision can trigger a dozen tool calls. Without a trace ID you
              cannot reconstruct the chain, and every incident post-mortem
              turns into a scavenger hunt.
            </li>
            <li>
              <strong className="text-text">schema_version.</strong> You will
              change this table within six months. Without a version field,
              new fields break old queries and old records break new tooling.
            </li>
            <li>
              <strong className="text-text">region.</strong> Auditors ask where
              a call was processed. Answer from the log, not from memory.
            </li>
          </ul>

          <h2 className="text-xl font-bold pt-4">
            2. Field-By-Field: What Goes In and Why
          </h2>

          <h3 className="font-semibold pt-2">2a. Identity fields</h3>
          <p>
            Store a hash of the API key, never the raw key. Prefer a prefix-
            preserving hash (keep the first 8 characters, hash the rest) so
            incident responders can correlate without exposing the credential.
            For OAuth-based callers, store the subject (sub) claim plus the
            client ID. If you want to tie calls back to a human developer, add
            a human_id column that references your SSO directory.
          </p>

          <h3 className="font-semibold pt-2">
            2b. Tool and operation fields
          </h3>
          <p>
            Split tool name and operation into two columns, not one. This lets
            you filter for &quot;every write to postgres&quot; or &quot;every
            send on gmail&quot; with a clean index. If your MCP servers return
            structured metadata (tool version, server commit SHA), log those
            too in <code>extra</code>.
          </p>

          <h3 className="font-semibold pt-2">2c. Input and output</h3>
          <p>
            Log redacted input parameters as JSONB. Never log raw output: the
            output often contains the exact data you are trying to protect.
            Instead, store response size in bytes and a hash of the output for
            integrity checks. If a regulator or court requires the actual
            output, you retrieve it from the upstream system using the tool
            name, operation, and input parameters from the log.
          </p>

          <div className="bg-bg-card border border-border rounded-lg p-6 my-6">
            <h3 className="font-semibold mb-2 text-accent">
              Why Not Log The Output?
            </h3>
            <p className="text-text-dim text-xs">
              Every byte of logged output is a byte your security boundary now
              has to protect. If the output was sensitive enough to care about
              the tool call, it is sensitive enough to care about the log
              storage. Logging size and hash gives you integrity verification
              without doubling your data-at-risk. If you need the full output
              for debugging, route it to a separately-authenticated debug
              store with shorter retention.
            </p>
          </div>

          <h3 className="font-semibold pt-2">2d. Status and errors</h3>
          <p>
            Status should be a small enum: <code>ok</code>, <code>error</code>,{" "}
            <code>denied</code>, <code>timeout</code>. Keep the error code
            separate so you can GROUP BY it. Your alerting depends on being
            able to say &quot;five percent of calls from this key are returning
            denied&quot; in a single query.
          </p>

          <h3 className="font-semibold pt-2">2e. Performance fields</h3>
          <p>
            Latency in milliseconds and response size in bytes pay for
            themselves the first time an agent starts behaving weirdly and you
            want to know whether it is slowness or malice. Add them from day
            one; adding them later requires backfilling or breaking trend
            continuity.
          </p>

          <h2 className="text-xl font-bold pt-4">
            3. Storage and Retention Rules
          </h2>
          <p>
            An auditor reading a log they cannot trust is worse than a missing
            log. Make the log tamper-evident by design.
          </p>
          <ul className="space-y-1.5 text-text-dim pl-4">
            <li>
              <strong className="text-text">Append-only by permission.</strong>{" "}
              The writer role on the audit table must have INSERT only. Nobody
              gets UPDATE or DELETE. Run a migration to revoke those grants
              explicitly; do not rely on default role behavior.
            </li>
            <li>
              <strong className="text-text">Hash chain or merkle tree</strong>{" "}
              for high-assurance environments. Each record includes the hash
              of the previous record; tampering with any record breaks the
              chain. Not every team needs this, but financial services and
              healthcare often do.
            </li>
            <li>
              <strong className="text-text">Separate storage tier.</strong>{" "}
              Stream logs to an immutable object store or SIEM with distinct
              credentials and distinct incident-response runbook. A compromise
              of your app database should not compromise your audit trail.
            </li>
            <li>
              <strong className="text-text">Retention matrix</strong> that
              matches the regulatory floor: 12 months for SOC 2, 6 years for
              HIPAA, 7 years for some financial services frameworks. Set
              lifecycle rules so deletion happens automatically and
              consistently.
            </li>
          </ul>

          <div className="bg-bg-card border border-border rounded-lg p-6 my-6">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-muted border-b border-border">
                  <th className="text-left pb-2 pr-4">Framework</th>
                  <th className="text-left pb-2 pr-4">Retention Floor</th>
                  <th className="text-left pb-2">Immediately Accessible</th>
                </tr>
              </thead>
              <tbody className="text-text-dim">
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-medium text-text">SOC 2 Type II</td>
                  <td className="py-2 pr-4">12 months audit period</td>
                  <td className="py-2">Practical minimum is hot retrieval in minutes</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-medium text-text">ISO 27001</td>
                  <td className="py-2 pr-4">Policy-driven, typically 12-24 months</td>
                  <td className="py-2">Must be retrievable during audits</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-medium text-text">HIPAA</td>
                  <td className="py-2 pr-4">6 years</td>
                  <td className="py-2">First 12 months hot; archive acceptable after</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-medium text-text">PCI DSS</td>
                  <td className="py-2 pr-4">1 year</td>
                  <td className="py-2">First 3 months hot</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-text">SEC / FINRA</td>
                  <td className="py-2 pr-4">Up to 7 years WORM</td>
                  <td className="py-2">Immediate retrieval on demand</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 className="text-xl font-bold pt-4">
            4. Redaction That Actually Works
          </h2>
          <p>
            Redaction is the boring, high-stakes layer that turns into a
            postmortem if you get it wrong. Three rules prevent almost every
            failure mode:
          </p>
          <ul className="space-y-1.5 text-text-dim pl-4">
            <li>
              <strong className="text-text">Redact before writing.</strong>{" "}
              The gateway strips secrets before the event hits the log. Never
              rely on a downstream scrubber that runs &quot;eventually.&quot;
              A crash between write and scrub is a breach.
            </li>
            <li>
              <strong className="text-text">Schema-aware redaction.</strong>{" "}
              Each tool has an input schema. Mark fields as log-safe,
              log-hashed, or log-omitted. An API key field is always
              log-omitted. An email is log-hashed with a rotating salt. A
              SKU is log-safe.
            </li>
            <li>
              <strong className="text-text">
                Pattern redaction as a backstop.
              </strong>{" "}
              Even with schema-aware rules, run a regex pass for well-known
              formats (API key prefixes, JWTs, credit card numbers,
              connection strings) and nuke anything that matches. Log the
              redaction event so you know which tool emitted an unexpected
              secret.
            </li>
          </ul>

          <div className="bg-[#0d0d18] border border-border rounded-lg p-4 my-4 font-mono text-xs overflow-x-auto">
            <p className="text-text-muted mb-2"># Input before redaction</p>
            <p className="text-red-400">{`{ "query": "SELECT * FROM users WHERE email='alice@example.com'",`}</p>
            <p className="text-red-400">{`  "connection": "postgres://admin:P@ssw0rd@db/main" }`}</p>
            <p className="text-text-muted mt-4 mb-2"># Input after redaction (what goes in the log)</p>
            <p className="text-green-400">{`{ "query": "SELECT * FROM users WHERE email='sha256:abc123...'",`}</p>
            <p className="text-green-400">{`  "connection": "[REDACTED:connection-string]" }`}</p>
          </div>

          <h2 className="text-xl font-bold pt-4">
            5. SIEM Integration Patterns
          </h2>
          <p>
            Your audit table is useful for forensics. Your SIEM is useful for
            detection. You want both, and you want them streaming from the
            same event source so they never drift.
          </p>
          <ul className="space-y-1.5 text-text-dim pl-4">
            <li>
              <strong className="text-text">Write once, fan out.</strong>{" "}
              Emit each event to a durable queue. One consumer writes to the
              audit store. Another ships to the SIEM. Backpressure on either
              consumer never blocks the gateway.
            </li>
            <li>
              <strong className="text-text">Use a consistent event name</strong>{" "}
              like <code>mcp.tool.call</code>. Splunk, Datadog, Elastic,
              Sentinel all let you build content library entries keyed on the
              event name.
            </li>
            <li>
              <strong className="text-text">Map high-value fields</strong> into
              SIEM-native fields: caller into user, source_ip into src, tool
              into app, status into outcome. This makes existing detection
              content work without rewrites.
            </li>
            <li>
              <strong className="text-text">
                Build these five detections on day one:
              </strong>{" "}
              (a) authentication failures per caller per five minutes; (b)
              calls denied by the gateway policy engine; (c) response-size
              anomalies versus the per-tool baseline; (d) tool use outside
              declared business hours for the caller; (e) a sudden spike in
              calls per minute from any single key.
            </li>
          </ul>

          <h2 className="text-xl font-bold pt-4">
            6. Real Queries Auditors Actually Run
          </h2>
          <p>
            Practice these queries before your Type II, not during it. If any
            of them take more than thirty seconds, your indexes are wrong.
          </p>

          <div className="bg-[#0d0d18] border border-border rounded-lg p-4 my-4 font-mono text-xs overflow-x-auto">
            <p className="text-text-muted mb-2">
              -- Every call by a specific caller in a window
            </p>
            <p className="text-text-dim">{`SELECT event_ts, tool_name, operation, status, latency_ms`}</p>
            <p className="text-text-dim">{`FROM mcp_audit_log`}</p>
            <p className="text-text-dim">{`WHERE caller_id = 'sha256:abc...'`}</p>
            <p className="text-text-dim">{`  AND event_ts BETWEEN '2026-04-01' AND '2026-04-30'`}</p>
            <p className="text-text-dim">{`ORDER BY event_ts;`}</p>

            <p className="text-text-muted mt-4 mb-2">
              -- Error rate per tool per day
            </p>
            <p className="text-text-dim">{`SELECT date_trunc('day', event_ts) AS day, tool_name,`}</p>
            <p className="text-text-dim">{`       count(*) AS total,`}</p>
            <p className="text-text-dim">{`       count(*) FILTER (WHERE status = 'error') AS errors`}</p>
            <p className="text-text-dim">{`FROM mcp_audit_log`}</p>
            <p className="text-text-dim">{`WHERE event_ts > now() - interval '30 days'`}</p>
            <p className="text-text-dim">{`GROUP BY 1, 2 ORDER BY 1, 2;`}</p>

            <p className="text-text-muted mt-4 mb-2">
              -- Reconstruct an agent run
            </p>
            <p className="text-text-dim">{`SELECT event_ts, tool_name, operation, status, input_redacted`}</p>
            <p className="text-text-dim">{`FROM mcp_audit_log`}</p>
            <p className="text-text-dim">{`WHERE trace_id = 'trc_01HX...'`}</p>
            <p className="text-text-dim">{`ORDER BY event_ts;`}</p>

            <p className="text-text-muted mt-4 mb-2">
              -- Callers touching a restricted tool
            </p>
            <p className="text-text-dim">{`SELECT caller_id, count(*) AS calls`}</p>
            <p className="text-text-dim">{`FROM mcp_audit_log`}</p>
            <p className="text-text-dim">{`WHERE tool_name = 'stripe' AND operation = 'refund'`}</p>
            <p className="text-text-dim">{`  AND event_ts > now() - interval '90 days'`}</p>
            <p className="text-text-dim">{`GROUP BY caller_id ORDER BY calls DESC;`}</p>
          </div>

          <h2 className="text-xl font-bold pt-4">
            7. How a Gateway Closes the Loop
          </h2>
          <p>
            Every piece of this schema assumes you control the write path.
            Self-hosted MCP servers fight you at every step: some log in JSON,
            some in text, some to stdout, some to files, most with different
            fields and none with a consistent timestamp format. By the time
            you normalize everything into a single audit store, you have
            built a gateway whether you meant to or not.
          </p>
          <p>
            An{" "}
            <Link
              href="/blog/what-is-an-mcp-gateway"
              className="text-accent hover:underline"
            >
              MCP gateway
            </Link>{" "}
            lets you skip the detour. Every tool call passes through one
            process that already knows the schema, already redacts secrets,
            already emits a normalized event, and already streams to both your
            audit store and your SIEM. At ToolRoute, this is exactly how the{" "}
            <Link href="/tools" className="text-accent hover:underline">
              51 tools in the registry
            </Link>{" "}
            are instrumented by default: one schema, one log, one retention
            policy, one SIEM pipeline across every call.
          </p>

          <h2 className="text-xl font-bold pt-4">
            8. A Pre-Audit Readiness Checklist
          </h2>
          <div className="bg-bg-card border border-border rounded-lg p-6 my-6">
            <ul className="space-y-2 text-text-dim text-xs">
              <li>
                <strong className="text-text">[ ] Schema</strong> with every
                required field and a schema_version column.
              </li>
              <li>
                <strong className="text-text">[ ] Append-only writes</strong>{" "}
                enforced by database grants or storage immutability.
              </li>
              <li>
                <strong className="text-text">[ ] Gateway-side redaction</strong>{" "}
                runs before the event hits the log.
              </li>
              <li>
                <strong className="text-text">[ ] Retention policy</strong>{" "}
                implemented as lifecycle rules, not a runbook step.
              </li>
              <li>
                <strong className="text-text">[ ] SIEM ingestion</strong>{" "}
                flowing with consistent event naming and field mapping.
              </li>
              <li>
                <strong className="text-text">[ ] Five baseline alerts</strong>{" "}
                in place for auth failures, denies, size anomalies, off-hours
                use, and rate spikes.
              </li>
              <li>
                <strong className="text-text">[ ] Benchmarked queries</strong>{" "}
                that complete in under thirty seconds on a realistic dataset.
              </li>
              <li>
                <strong className="text-text">[ ] Tested restore</strong> from
                archive to verify retention media is actually readable.
              </li>
              <li>
                <strong className="text-text">[ ] Documented runbook</strong>{" "}
                for producing an auditor sample in under one business hour.
              </li>
            </ul>
          </div>

          <h2 className="text-xl font-bold pt-4">Frequently Asked Questions</h2>

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-sm">
                What fields should an MCP audit log capture?
              </h3>
              <p className="text-text-dim mt-1">
                At minimum: a unique call ID, UTC timestamp with millisecond
                precision, caller identity, source IP, tool name, operation,
                sanitized input, response status, response size, latency,
                trace ID, and a schema version. Secrets and personal data
                must be redacted before the log is written.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                How long should I retain MCP audit logs?
              </h3>
              <p className="text-text-dim mt-1">
                The baseline is twelve months to cover a full SOC 2 Type II
                period. Regulated industries need longer: HIPAA six years, PCI
                DSS one year with at least three months immediately
                accessible, some financial services up to seven. Set a written
                policy, enforce it technically, and verify deletions happen on
                schedule.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                Where should MCP audit logs live?
              </h3>
              <p className="text-text-dim mt-1">
                Append-only media. A SIEM that ingests via syslog or HTTPS, an
                immutable object store with object lock enabled, a purpose-
                built audit log service, or a WORM-configured log database.
                Writable SQL tables on your production database are not
                acceptable.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                How do I integrate MCP logs with a SIEM?
              </h3>
              <p className="text-text-dim mt-1">
                Stream every tool call as a structured JSON event over HTTPS
                or syslog with a consistent event type like mcp.tool.call. Map
                high-value fields into SIEM-native fields so existing
                detection content works. Build alerts for auth failures, rate
                breaches, unusual data volumes, off-hours use, and repeated
                errors from a single caller.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                How do I redact secrets and PII from audit logs?
              </h3>
              <p className="text-text-dim mt-1">
                Redact at the gateway before writing the log. Use deterministic
                pattern matching for well-known secret formats plus schema-
                aware rules for tool inputs. Hash identifiers like email with
                a rotating salt so you can correlate events without storing
                raw values. Treat redaction misses as incidents, not minor
                bugs.
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
                  href="/blog/mcp-governance-soc2-compliance"
                  className="text-accent hover:underline"
                >
                  MCP Governance and SOC 2 Compliance for AI Agents
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
                  What Is an MCP Gateway?
                </Link>
              </li>
            </ul>
          </div>

          <div className="border-t border-border pt-8 mt-8">
            <p className="text-text-dim">
              ToolRoute ships this exact audit schema out of the box across{" "}
              <Link href="/tools" className="text-accent hover:underline">
                51 curated tools
              </Link>
              . One schema, one log, one retention policy.{" "}
              <Link href="/docs" className="text-accent hover:underline">
                Read the docs
              </Link>
              , browse the{" "}
              <Link href="/glossary" className="text-accent hover:underline">
                glossary
              </Link>
              , or check the{" "}
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
