import type { Metadata } from "next";
import Link from "next/link";
import { Zap, ArrowRight, ExternalLink } from "lucide-react";

export const metadata: Metadata = {
  title: "Documentation — ToolRoute",
  description:
    "Developer documentation for the ToolRoute API. Authentication, endpoints, integration guides.",
};

/* ---------- TOC data ---------- */
const sections = [
  { id: "quickstart", label: "Quickstart" },
  { id: "authentication", label: "Authentication" },
  { id: "api-reference", label: "API Reference" },
  { id: "available-tools", label: "Available Tools" },
  { id: "byok", label: "BYOK" },
  { id: "rate-limits", label: "Rate Limits" },
  { id: "integration-guides", label: "Integration Guides" },
] as const;

/* ---------- Helpers ---------- */
function CodeBlock({
  title,
  lang,
  children,
}: {
  title?: string;
  lang?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#0d0d18] border border-border rounded-lg overflow-hidden my-4">
      {(title || lang) && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-card/50">
          <span className="text-[10px] text-text-muted">{title || lang}</span>
        </div>
      )}
      <pre className="p-4 text-xs sm:text-sm leading-relaxed overflow-x-auto">
        <code>{children}</code>
      </pre>
    </div>
  );
}

function SectionHeading({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  return (
    <h2
      id={id}
      className="text-2xl font-bold mt-16 mb-4 pt-4 border-t border-border scroll-mt-24"
    >
      {children}
    </h2>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-lg font-semibold mt-8 mb-3">{children}</h3>;
}

function Param({
  name,
  type,
  required,
  children,
}: {
  name: string;
  type: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="py-3 border-b border-border last:border-0">
      <div className="flex items-center gap-2 mb-1">
        <code className="text-sm text-accent bg-accent/10 px-1.5 py-0.5 rounded">
          {name}
        </code>
        <span className="text-xs text-text-muted">{type}</span>
        {required && (
          <span className="text-[10px] text-red font-semibold uppercase">
            required
          </span>
        )}
      </div>
      <p className="text-sm text-text-dim pl-0">{children}</p>
    </div>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="text-xs bg-accent/10 text-accent px-1.5 py-0.5 rounded">
      {children}
    </code>
  );
}

/* ---------- Page ---------- */
export default function DocsPage() {
  return (
    <div className="flex gap-8 pb-16">
      {/* Sidebar TOC */}
      <aside className="hidden lg:block w-56 shrink-0">
        <nav className="sticky top-20 space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-text-muted mb-3 font-semibold">
            On this page
          </p>
          {sections.map(({ id, label }) => (
            <a
              key={id}
              href={`#${id}`}
              className="block text-sm text-text-dim hover:text-accent transition-colors py-1 border-l-2 border-transparent hover:border-accent pl-3"
            >
              {label}
            </a>
          ))}
          <div className="border-t border-border mt-4 pt-4">
            <Link
              href="/tools"
              className="block text-sm text-text-dim hover:text-accent transition-colors py-1 pl-3"
            >
              Browse Tools
            </Link>
            <Link
              href="/pricing"
              className="block text-sm text-text-dim hover:text-accent transition-colors py-1 pl-3"
            >
              Pricing
            </Link>
          </div>
        </nav>
      </aside>

      {/* Main content */}
      <article className="flex-1 min-w-0 max-w-3xl">
        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-full px-4 py-1.5 mb-6">
            <Zap className="w-3.5 h-3.5 text-accent" />
            <span className="text-xs text-accent font-medium">Docs</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            ToolRoute API Documentation
          </h1>
          <p className="text-text-dim leading-relaxed">
            Everything you need to integrate ToolRoute into your AI agents,
            scripts, and applications. One API key, 50+ tools.
          </p>
        </div>

        {/* Quickstart */}
        <SectionHeading id="quickstart">Quickstart</SectionHeading>
        <p className="text-text-dim text-sm leading-relaxed mb-4">
          Get up and running in under a minute.
        </p>

        <div className="space-y-6">
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0 text-xs font-bold text-accent">
              1
            </div>
            <div>
              <p className="font-semibold text-sm mb-1">Sign up at toolroute.ai</p>
              <p className="text-sm text-text-dim">
                Create an account with email or GitHub. Takes 10 seconds.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0 text-xs font-bold text-accent">
              2
            </div>
            <div>
              <p className="font-semibold text-sm mb-1">
                Get your API key from the dashboard
              </p>
              <p className="text-sm text-text-dim">
                Navigate to{" "}
                <Link href="/login" className="text-accent hover:underline">
                  Dashboard &rarr; API Keys
                </Link>{" "}
                and create a key. It starts with{" "}
                <InlineCode>tr_live_</InlineCode>.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0 text-xs font-bold text-accent">
              3
            </div>
            <div>
              <p className="font-semibold text-sm mb-1">
                Make your first request
              </p>
              <CodeBlock title="terminal">
                {`curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "firecrawl/scrape", "input": {"url": "https://example.com"}}'`}
              </CodeBlock>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0 text-xs font-bold text-accent">
              4
            </div>
            <div>
              <p className="font-semibold text-sm mb-1">Check your balance</p>
              <CodeBlock title="terminal">
                {`curl https://toolroute.ai/api/v1/key \\
  -H "Authorization: Bearer tr_live_xxx"`}
              </CodeBlock>
            </div>
          </div>
        </div>

        {/* Authentication */}
        <SectionHeading id="authentication">Authentication</SectionHeading>
        <p className="text-text-dim text-sm leading-relaxed mb-4">
          All API requests require a valid API key sent via the{" "}
          <InlineCode>Authorization</InlineCode> header.
        </p>
        <CodeBlock title="Header format">
          {`Authorization: Bearer tr_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx`}
        </CodeBlock>
        <div className="border border-border rounded-lg p-4 bg-bg-card my-4">
          <p className="text-sm text-text-dim leading-relaxed">
            <strong className="text-text">Security:</strong> API keys are
            SHA-256 hashed before storage. We never store the raw key. You can
            only see the full key once at creation time. Treat it like a
            password.
          </p>
        </div>
        <p className="text-text-dim text-sm leading-relaxed">
          Create and manage keys from{" "}
          <Link href="/login" className="text-accent hover:underline">
            your dashboard
          </Link>
          . Each key can be named and revoked independently.
        </p>

        {/* API Reference */}
        <SectionHeading id="api-reference">API Reference</SectionHeading>
        <p className="text-text-dim text-sm leading-relaxed mb-6">
          Base URL: <InlineCode>https://toolroute.ai/api/v1</InlineCode>
        </p>

        {/* POST /execute */}
        <SubHeading>
          <span className="inline-block bg-green/10 text-green text-xs font-bold px-2 py-0.5 rounded mr-2">
            POST
          </span>
          /api/v1/execute
        </SubHeading>
        <p className="text-text-dim text-sm leading-relaxed mb-4">
          Execute a tool. This is the primary endpoint for all tool calls.
        </p>
        <div className="border border-border rounded-lg bg-bg-card mb-4">
          <div className="px-4 py-2 border-b border-border">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Request Body
            </p>
          </div>
          <div className="px-4">
            <Param name="tool" type="string" required>
              Tool identifier in{" "}
              <InlineCode>provider/operation</InlineCode> format. Example:{" "}
              <InlineCode>elevenlabs/text-to-speech</InlineCode>
            </Param>
            <Param name="input" type="object" required>
              Tool-specific input parameters. See each tool&apos;s documentation.
            </Param>
            <Param name="provider" type="string">
              Force a specific provider. If omitted, ToolRoute picks the best
              one.
            </Param>
          </div>
        </div>
        <CodeBlock title="Example request">
          {`curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "tool": "elevenlabs/text-to-speech",
    "input": {
      "text": "Hello world",
      "voice_id": "21m00Tcm4TlvDq8ikWAM"
    }
  }'`}
        </CodeBlock>
        <div className="border border-border rounded-lg bg-bg-card mb-4">
          <div className="px-4 py-2 border-b border-border">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Response
            </p>
          </div>
          <div className="px-4">
            <Param name="id" type="string">
              Unique execution ID for tracking and debugging.
            </Param>
            <Param name="tool" type="string">
              The tool that was executed.
            </Param>
            <Param name="provider" type="string">
              The provider that handled the request.
            </Param>
            <Param name="data" type="object">
              Tool-specific response data.
            </Param>
            <Param name="usage" type="object">
              Credits consumed and execution time.
            </Param>
          </div>
        </div>
        <SubHeading>Error Codes</SubHeading>
        <div className="border border-border rounded-lg overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-card">
                <th className="text-left p-3 text-text-muted text-xs font-medium uppercase tracking-wider">
                  Code
                </th>
                <th className="text-left p-3 text-text-muted text-xs font-medium uppercase tracking-wider">
                  Meaning
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                ["400", "Bad Request — Invalid parameters"],
                ["401", "Unauthorized — Missing or invalid API key"],
                ["402", "Payment Required — Insufficient credits"],
                ["403", "Forbidden — Key does not have access to this tool"],
                ["404", "Not Found — Tool does not exist"],
                ["429", "Too Many Requests — Rate limit exceeded"],
                ["500", "Internal Server Error — Something went wrong on our end"],
              ].map(([code, meaning]) => (
                <tr key={code} className="hover:bg-bg-card-hover transition-colors">
                  <td className="p-3">
                    <code className="text-xs text-red bg-red/10 px-1.5 py-0.5 rounded">
                      {code}
                    </code>
                  </td>
                  <td className="p-3 text-text-dim">{meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* GET /tools */}
        <SubHeading>
          <span className="inline-block bg-accent/10 text-accent text-xs font-bold px-2 py-0.5 rounded mr-2">
            GET
          </span>
          /api/v1/tools
        </SubHeading>
        <p className="text-text-dim text-sm leading-relaxed mb-4">
          List all available tools. No authentication required.
        </p>
        <CodeBlock title="terminal">
          {`curl https://toolroute.ai/api/v1/tools`}
        </CodeBlock>

        {/* GET /key */}
        <SubHeading>
          <span className="inline-block bg-accent/10 text-accent text-xs font-bold px-2 py-0.5 rounded mr-2">
            GET
          </span>
          /api/v1/key
        </SubHeading>
        <p className="text-text-dim text-sm leading-relaxed mb-4">
          Get information about your API key, including remaining credits and
          plan details.
        </p>
        <CodeBlock title="terminal">
          {`curl https://toolroute.ai/api/v1/key \\
  -H "Authorization: Bearer tr_live_xxx"`}
        </CodeBlock>

        {/* POST /keys */}
        <SubHeading>
          <span className="inline-block bg-green/10 text-green text-xs font-bold px-2 py-0.5 rounded mr-2">
            POST
          </span>
          /api/v1/keys
        </SubHeading>
        <p className="text-text-dim text-sm leading-relaxed mb-4">
          Create a new API key. Requires session authentication (logged in via
          dashboard).
        </p>
        <CodeBlock title="terminal">
          {`curl -X POST https://toolroute.ai/api/v1/keys \\
  -H "Content-Type: application/json" \\
  -H "Cookie: sb-access-token=..." \\
  -d '{"name": "production-key"}'`}
        </CodeBlock>

        {/* GET /usage */}
        <SubHeading>
          <span className="inline-block bg-accent/10 text-accent text-xs font-bold px-2 py-0.5 rounded mr-2">
            GET
          </span>
          /api/v1/usage
        </SubHeading>
        <p className="text-text-dim text-sm leading-relaxed mb-4">
          Get your usage history, including tool calls, credits consumed, and
          timestamps.
        </p>
        <CodeBlock title="terminal">
          {`curl https://toolroute.ai/api/v1/usage \\
  -H "Authorization: Bearer tr_live_xxx"`}
        </CodeBlock>

        {/* Available Tools */}
        <SectionHeading id="available-tools">Available Tools</SectionHeading>
        <p className="text-text-dim text-sm leading-relaxed mb-4">
          ToolRoute curates 50+ best-in-class tools across 12 categories. Each
          tool is rated 9/10 or higher based on real-world usage across hundreds
          of AI agents.
        </p>
        <div className="border border-border rounded-lg overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-card">
                <th className="text-left p-3 text-text-muted text-xs font-medium uppercase tracking-wider">
                  Category
                </th>
                <th className="text-left p-3 text-text-muted text-xs font-medium uppercase tracking-wider">
                  Example Tools
                </th>
                <th className="text-left p-3 text-text-muted text-xs font-medium uppercase tracking-wider">
                  Operations
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                [
                  "Content & Copywriting",
                  "ElevenLabs, OpenAI",
                  "TTS, generation, summarization",
                ],
                [
                  "Infrastructure",
                  "Firecrawl, Supabase",
                  "Scraping, database, storage",
                ],
                [
                  "Communication",
                  "Resend, Twilio",
                  "Email, SMS, voice",
                ],
                [
                  "Analytics",
                  "PostHog, Plausible",
                  "Tracking, funnels, events",
                ],
                [
                  "Security",
                  "Semgrep, VibeArmor",
                  "Scanning, auditing, testing",
                ],
                [
                  "DevOps",
                  "GitHub, Vercel",
                  "Repos, deploys, CI/CD",
                ],
                [
                  "CRM & Sales",
                  "Apollo, HubSpot",
                  "Contacts, outreach, pipelines",
                ],
                [
                  "E-commerce",
                  "Stripe, WooCommerce",
                  "Payments, products, orders",
                ],
              ].map(([category, tools, operations]) => (
                <tr
                  key={category}
                  className="hover:bg-bg-card-hover transition-colors"
                >
                  <td className="p-3 text-text font-medium">{category}</td>
                  <td className="p-3 text-text-dim">{tools}</td>
                  <td className="p-3 text-text-dim">{operations}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm">
          <Link
            href="/tools"
            className="text-accent hover:underline inline-flex items-center gap-1"
          >
            Browse the full tool registry <ArrowRight className="w-4 h-4" />
          </Link>
        </p>

        {/* BYOK */}
        <SectionHeading id="byok">BYOK (Bring Your Own Key)</SectionHeading>
        <p className="text-text-dim text-sm leading-relaxed mb-4">
          On Pro and Enterprise plans, you can register your own API keys for
          any supported tool. When you use BYOK:
        </p>
        <ul className="list-disc list-inside space-y-2 text-sm text-text-dim mb-4 pl-2">
          <li>
            Requests are routed through your own key with{" "}
            <strong className="text-text">zero markup</strong>
          </li>
          <li>You only pay the provider directly</li>
          <li>ToolRoute still handles routing, logging, and fallbacks</li>
          <li>Keys are encrypted at rest with AES-256</li>
        </ul>
        <CodeBlock title="Register a BYOK key">
          {`curl -X POST https://toolroute.ai/api/v1/provider-keys \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "provider": "elevenlabs",
    "api_key": "your-elevenlabs-key-here"
  }'`}
        </CodeBlock>
        <div className="border border-border rounded-lg p-4 bg-bg-card my-4">
          <p className="text-sm text-text-dim leading-relaxed">
            <strong className="text-text">Which tools support BYOK?</strong>{" "}
            Any tool that uses a standard API key for authentication. Check the
            tool detail page for BYOK compatibility.
          </p>
        </div>

        {/* Rate Limits */}
        <SectionHeading id="rate-limits">Rate Limits</SectionHeading>
        <p className="text-text-dim text-sm leading-relaxed mb-4">
          Rate limits are applied per API key.
        </p>
        <div className="border border-border rounded-lg overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-card">
                <th className="text-left p-3 text-text-muted text-xs font-medium uppercase tracking-wider">
                  Plan
                </th>
                <th className="text-left p-3 text-text-muted text-xs font-medium uppercase tracking-wider">
                  RPM
                </th>
                <th className="text-left p-3 text-text-muted text-xs font-medium uppercase tracking-wider">
                  Daily / Monthly
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr className="hover:bg-bg-card-hover transition-colors">
                <td className="p-3 text-text">Free</td>
                <td className="p-3 text-text-dim">10</td>
                <td className="p-3 text-text-dim">100/day</td>
              </tr>
              <tr className="hover:bg-bg-card-hover transition-colors">
                <td className="p-3 text-accent font-medium">Pro</td>
                <td className="p-3 text-text-dim">60</td>
                <td className="p-3 text-text-dim">10,000/month</td>
              </tr>
              <tr className="hover:bg-bg-card-hover transition-colors">
                <td className="p-3 text-text">Enterprise</td>
                <td className="p-3 text-text-dim">300</td>
                <td className="p-3 text-text-dim">100,000/month</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-text-dim text-sm leading-relaxed">
          When rate limited, the API returns{" "}
          <InlineCode>429 Too Many Requests</InlineCode> with a{" "}
          <InlineCode>Retry-After</InlineCode> header indicating how many
          seconds to wait before retrying.
        </p>

        {/* Integration Guides */}
        <SectionHeading id="integration-guides">
          Integration Guides
        </SectionHeading>

        <SubHeading>Claude Code / MCP</SubHeading>
        <p className="text-text-dim text-sm leading-relaxed mb-4">
          Add ToolRoute as an MCP server in your{" "}
          <InlineCode>.mcp.json</InlineCode>:
        </p>
        <CodeBlock title=".mcp.json">
          {`{
  "toolroute": {
    "type": "http",
    "url": "https://toolroute.ai/mcp",
    "headers": {
      "Authorization": "Bearer tr_live_xxx"
    }
  }
}`}
        </CodeBlock>

        <SubHeading>Python</SubHeading>
        <CodeBlock lang="python">
          {`import requests

def toolroute(tool: str, input: dict) -> dict:
    r = requests.post(
        "https://toolroute.ai/api/v1/execute",
        headers={"Authorization": "Bearer tr_live_xxx"},
        json={"tool": tool, "input": input},
    )
    r.raise_for_status()
    return r.json()["data"]

# Example: scrape a webpage
result = toolroute("firecrawl/scrape", {"url": "https://example.com"})
print(result)`}
        </CodeBlock>

        <SubHeading>JavaScript / TypeScript</SubHeading>
        <CodeBlock lang="javascript">
          {`async function toolroute(tool, input) {
  const res = await fetch("https://toolroute.ai/api/v1/execute", {
    method: "POST",
    headers: {
      "Authorization": "Bearer tr_live_xxx",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tool, input }),
  });
  if (!res.ok) throw new Error(\`ToolRoute error: \${res.status}\`);
  const { data } = await res.json();
  return data;
}

// Example: text to speech
const audio = await toolroute("elevenlabs/text-to-speech", {
  text: "Hello from ToolRoute!",
});`}
        </CodeBlock>

        <SubHeading>curl</SubHeading>
        <CodeBlock title="terminal">
          {`# Execute a tool
curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "resend/send-email", "input": {
    "to": "user@example.com",
    "subject": "Hello from ToolRoute",
    "html": "<p>This was sent through ToolRoute!</p>"
  }}'

# List available tools
curl https://toolroute.ai/api/v1/tools

# Check your key and balance
curl -H "Authorization: Bearer tr_live_xxx" \\
  https://toolroute.ai/api/v1/key`}
        </CodeBlock>

        {/* Bottom nav */}
        <div className="border-t border-border mt-16 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link
            href="/tools"
            className="text-sm text-accent hover:underline inline-flex items-center gap-1"
          >
            Browse the tool registry <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/pricing"
            className="text-sm text-accent hover:underline inline-flex items-center gap-1"
          >
            View pricing plans <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </article>
    </div>
  );
}
