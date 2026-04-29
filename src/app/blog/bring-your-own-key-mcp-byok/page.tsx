import type { Metadata } from "next";
import Link from "next/link";
import { safeJsonLd } from "@/lib/json-ld";

export const metadata: Metadata = {
  title: "Bring Your Own API Key (BYOK) for MCP Tools — How It Works",
  description:
    "Already paying for OpenAI, Stripe, or Twilio? BYOK lets you use your existing API keys through an MCP gateway without double-paying. Learn how to register keys, route calls, and keep credentials secure.",
  alternates: { canonical: "/blog/bring-your-own-key-mcp-byok" },
  openGraph: {
    title: "Bring Your Own API Key (BYOK) for MCP Tools — How It Works",
    description:
      "Use your existing provider keys through an MCP gateway. No double-billing. Encryption at rest is on the security roadmap (Codex ticket #52).",
    url: "https://toolroute.ai/blog/bring-your-own-key-mcp-byok",
    type: "article",
    publishedTime: "2026-04-16T00:00:00Z",
  },
};

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Bring Your Own API Key (BYOK) for MCP Tools — How It Works",
  description:
    "Already paying for OpenAI, Stripe, or Twilio? BYOK lets you use your existing API keys through an MCP gateway without double-paying.",
  datePublished: "2026-04-16T00:00:00Z",
  author: { "@type": "Organization", name: "ToolRoute" },
  publisher: {
    "@type": "Organization",
    name: "ToolRoute",
    url: "https://toolroute.ai",
  },
  mainEntityOfPage:
    "https://toolroute.ai/blog/bring-your-own-key-mcp-byok",
};

export default function Article() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(articleSchema) }}
      />
      <article className="max-w-3xl mx-auto">
        <header className="mb-12">
          <p className="text-accent text-xs font-medium mb-4">Guide</p>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">
            Bring Your Own API Key (BYOK) for MCP Tools — How It Works
          </h1>
          <p className="text-text-dim text-sm leading-relaxed mb-4">
            You already pay OpenAI, Stripe, Twilio, and a dozen other providers
            for API access. When an MCP gateway routes calls to those same
            providers, you should not have to pay twice. BYOK solves this: register
            your existing key, and the gateway uses it directly.
          </p>
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <span>April 16, 2026</span>
            <span>7 min read</span>
            <span>ToolRoute Team</span>
          </div>
        </header>

        <div className="prose-custom space-y-8 text-sm leading-relaxed">
          <h2 className="text-xl font-bold pt-4">
            What Is BYOK?
          </h2>
          <p>
            Bring Your Own Key means exactly what it says. You hand the gateway
            an API key you already own for a specific provider &mdash; OpenAI,
            Stripe, Twilio, Resend, Tavily, or any supported service &mdash; and
            every call to that provider flows through your key instead of the
            gateway&apos;s shared pool.
          </p>
          <p>
            Without BYOK, an{" "}
            <Link
              href="/blog/use-mcp-tools-without-managing-servers"
              className="text-accent hover:underline"
            >
              MCP gateway
            </Link>{" "}
            executes tool calls using its own upstream credentials and charges
            you credits for each call. That model works well when you do not
            have a provider account or when you want unified billing across
            dozens of tools. But if you already have a negotiated rate with
            OpenAI or a high-volume Twilio plan, paying credits on top of your
            existing subscription means double-paying for the same API access.
          </p>
          <p>
            BYOK eliminates that. You keep your existing provider relationship,
            your existing rate, and your existing usage dashboard. The gateway
            still handles routing, protocol translation, and response
            normalization &mdash; it just authenticates with your key instead of
            its own.
          </p>

          <h2 className="text-xl font-bold pt-4">
            How BYOK Works in an MCP Gateway
          </h2>
          <p>
            The flow is straightforward:
          </p>
          <ol className="space-y-1.5 text-text-dim pl-4 list-decimal">
            <li>
              You register a provider key via the BYOK endpoint, specifying which
              provider it belongs to.
            </li>
            <li>
              The gateway encrypts the key at rest and associates it with your
              account.
            </li>
            <li>
              When you execute a tool call that hits that provider, the gateway
              checks whether you have a BYOK key registered for it.
            </li>
            <li>
              If a BYOK key exists, the gateway uses it. No credits are deducted.
              The provider bills you directly at your rate.
            </li>
            <li>
              If no BYOK key exists, the gateway falls back to its shared key and
              deducts credits from your balance.
            </li>
          </ol>
          <p>
            This means you can mix and match. Use BYOK for providers where you
            have a volume discount, and credits for everything else. The gateway
            resolves the correct authentication path on every call.
          </p>

          <h2 className="text-xl font-bold pt-4">
            Registering a BYOK Key
          </h2>
          <p>
            Register a key by sending a POST request to{" "}
            <code className="bg-bg-card px-1.5 py-0.5 rounded text-xs">/api/v1/byok</code>{" "}
            with your ToolRoute session and the provider details.
          </p>
          <div className="bg-[#0d0d18] border border-border rounded-lg overflow-hidden my-4">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-card/50">
              <span className="text-[10px] text-text-muted">bash</span>
            </div>
            <pre className="p-4 text-xs leading-relaxed overflow-x-auto">
              <code className="text-text-dim">
                {`# Register your OpenAI key
curl -X POST https://toolroute.ai/api/v1/byok \\
  -H "Authorization: Bearer tr_live_abc123..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "provider": "openai",
    "api_key": "sk-proj-your-openai-key..."
  }'

# Response
{
  "id": "byok_7f3a...",
  "provider": "openai",
  "status": "active",
  "created_at": "2026-04-16T12:00:00Z"
}`}
              </code>
            </pre>
          </div>
          <p>
            You can register keys for multiple providers. Each registration is
            scoped to one provider. If you need to rotate a key, register a new
            one for the same provider and the old one is replaced.
          </p>
          <div className="bg-[#0d0d18] border border-border rounded-lg overflow-hidden my-4">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-card/50">
              <span className="text-[10px] text-text-muted">bash</span>
            </div>
            <pre className="p-4 text-xs leading-relaxed overflow-x-auto">
              <code className="text-text-dim">
                {`# Register keys for multiple providers
curl -X POST https://toolroute.ai/api/v1/byok \\
  -H "Authorization: Bearer tr_live_abc123..." \\
  -H "Content-Type: application/json" \\
  -d '{ "provider": "stripe", "api_key": "sk_live_your-stripe-key..." }'

curl -X POST https://toolroute.ai/api/v1/byok \\
  -H "Authorization: Bearer tr_live_abc123..." \\
  -H "Content-Type: application/json" \\
  -d '{ "provider": "twilio", "api_key": "your-twilio-sid:your-auth-token" }'`}
              </code>
            </pre>
          </div>

          <h2 className="text-xl font-bold pt-4">
            Making Calls With BYOK
          </h2>
          <p>
            Once a key is registered, you do not change anything about how you
            call tools. The execute endpoint is identical whether the gateway
            uses your key or its own.
          </p>
          <div className="bg-[#0d0d18] border border-border rounded-lg overflow-hidden my-4">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-card/50">
              <span className="text-[10px] text-text-muted">bash</span>
            </div>
            <pre className="p-4 text-xs leading-relaxed overflow-x-auto">
              <code className="text-text-dim">
                {`# This call uses your OpenAI key automatically (BYOK registered)
curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_abc123..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "tool": "openai",
    "operation": "chat_completion",
    "input": {
      "model": "gpt-4o",
      "messages": [
        { "role": "user", "content": "Summarize this document." }
      ]
    }
  }'

# Response includes billing_mode so you know what happened
{
  "result": { "choices": [...] },
  "billing": {
    "mode": "byok",
    "credits_charged": 0,
    "provider": "openai"
  }
}`}
              </code>
            </pre>
          </div>
          <p>
            The response includes a{" "}
            <code className="bg-bg-card px-1.5 py-0.5 rounded text-xs">billing</code>{" "}
            object so your agent or application can confirm whether the call used
            BYOK or credits. This is useful for cost tracking and for verifying
            that your key registration is active.
          </p>

          <h2 className="text-xl font-bold pt-4">
            Checking Which Tools Use BYOK vs Credits
          </h2>
          <p>
            The key info endpoint shows your registered BYOK providers alongside
            your credit balance, so you always know which tools bill to your
            provider account and which deduct from credits.
          </p>
          <div className="bg-[#0d0d18] border border-border rounded-lg overflow-hidden my-4">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-card/50">
              <span className="text-[10px] text-text-muted">bash</span>
            </div>
            <pre className="p-4 text-xs leading-relaxed overflow-x-auto">
              <code className="text-text-dim">
                {`# Check your key info, balance, and BYOK registrations
curl https://toolroute.ai/api/v1/key \\
  -H "Authorization: Bearer tr_live_abc123..."

{
  "key_id": "key_9x2b...",
  "credits_remaining": 42.50,
  "byok_providers": [
    { "provider": "openai", "status": "active", "registered": "2026-04-16" },
    { "provider": "stripe", "status": "active", "registered": "2026-04-16" },
    { "provider": "twilio", "status": "active", "registered": "2026-04-16" }
  ],
  "credit_providers": [
    "tavily", "resend", "firecrawl", "exa", "browserbase"
  ]
}`}
              </code>
            </pre>
          </div>
          <p>
            The <code className="bg-bg-card px-1.5 py-0.5 rounded text-xs">byok_providers</code>{" "}
            array lists every provider where your key is registered. The{" "}
            <code className="bg-bg-card px-1.5 py-0.5 rounded text-xs">credit_providers</code>{" "}
            array lists providers that will deduct from your credit balance. Free
            tools (Context7, Playwright, Semgrep) appear in neither list because
            they cost nothing either way.
          </p>

          <h2 className="text-xl font-bold pt-4">
            When to Use BYOK vs Credits
          </h2>
          <div className="bg-bg-card border border-border rounded-lg p-6 my-6">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-muted border-b border-border">
                  <th className="text-left pb-2 pr-4">Scenario</th>
                  <th className="text-left pb-2 pr-4">Use BYOK</th>
                  <th className="text-left pb-2">Use Credits</th>
                </tr>
              </thead>
              <tbody className="text-text-dim">
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">High-volume provider with negotiated rate</td>
                  <td className="py-2 pr-4 text-green">Yes</td>
                  <td className="py-2">No &mdash; you would overpay</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Existing enterprise contract (OpenAI, Twilio)</td>
                  <td className="py-2 pr-4 text-green">Yes</td>
                  <td className="py-2">No &mdash; contract already covers it</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Trying a tool for the first time</td>
                  <td className="py-2 pr-4">No &mdash; no existing account</td>
                  <td className="py-2 text-green">Yes &mdash; instant access</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Using 30+ tools across many providers</td>
                  <td className="py-2 pr-4">For top 3-5 by volume</td>
                  <td className="py-2 text-green">For the rest</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Need usage to appear on provider dashboard</td>
                  <td className="py-2 pr-4 text-green">Yes &mdash; calls hit your account</td>
                  <td className="py-2">No &mdash; calls hit gateway account</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Want one bill for everything</td>
                  <td className="py-2 pr-4">No &mdash; separate invoices</td>
                  <td className="py-2 text-green">Yes &mdash; unified billing</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            The optimal setup for most teams: BYOK for the two or three providers
            you use heavily (often OpenAI and one communication tool), and{" "}
            <Link
              href="/blog/ai-agent-tool-billing-credits"
              className="text-accent hover:underline"
            >
              prepaid credits
            </Link>{" "}
            for everything else. This gives you the best rate where it matters
            and zero-friction access to the long tail of tools you use
            occasionally.
          </p>

          <h2 className="text-xl font-bold pt-4">
            Security: How BYOK Keys Are Handled
          </h2>
          <p>
            Handing your API keys to a third party requires trust. Here is how
            ToolRoute handles BYOK credentials:
          </p>
          <ul className="space-y-1.5 text-text-dim pl-4">
            <li>
              <strong>Encryption at rest is on the security roadmap.</strong>{" "}
              KMS-managed AES-256-GCM encryption of BYOK credentials is in
              active development (Codex ticket #52). Today, BYOK keys are
              stored in Supabase with row-level access controls — only the
              owning user can read their own keys via RLS — and existing rows
              will be migrated when the encryption layer ships.
            </li>
            <li>
              <strong>Never logged.</strong> API keys do not appear in request
              logs, error logs, or analytics. The gateway decrypts the key
              in-memory for the duration of the upstream call, then discards it.
            </li>
            <li>
              <strong>Never exposed in responses.</strong> The BYOK registration
              endpoint returns a reference ID, not the key itself. No API
              response ever includes your provider key.
            </li>
            <li>
              <strong>Scoped to one provider.</strong> Each BYOK registration is
              locked to a single provider. The key is only decrypted when the
              gateway routes a call to that specific provider.
            </li>
            <li>
              <strong>Deletable at any time.</strong> Send a DELETE request to
              revoke a BYOK registration. The encrypted key is purged, and
              future calls fall back to credits.
            </li>
          </ul>
          <div className="bg-[#0d0d18] border border-border rounded-lg overflow-hidden my-4">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-card/50">
              <span className="text-[10px] text-text-muted">bash</span>
            </div>
            <pre className="p-4 text-xs leading-relaxed overflow-x-auto">
              <code className="text-text-dim">
                {`# Revoke a BYOK key — calls fall back to credits immediately
curl -X DELETE https://toolroute.ai/api/v1/byok/byok_7f3a... \\
  -H "Authorization: Bearer tr_live_abc123..."`}
              </code>
            </pre>
          </div>
          <p>
            For additional details on how the gateway handles upstream
            credentials and request isolation, see the{" "}
            <Link
              href="/blog/mcp-server-security-best-practices"
              className="text-accent hover:underline"
            >
              MCP server security best practices
            </Link>{" "}
            guide.
          </p>

          <h2 className="text-xl font-bold pt-4">
            BYOK Through the MCP Protocol
          </h2>
          <p>
            If you connect to ToolRoute as an MCP server (for example, from
            Claude Code or another MCP client), BYOK works identically. The
            gateway checks for registered keys on every tool call regardless of
            which protocol delivered the request &mdash; REST, MCP Streamable
            HTTP, A2A, or OpenAI function calling.
          </p>
          <div className="bg-[#0d0d18] border border-border rounded-lg overflow-hidden my-4">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-card/50">
              <span className="text-[10px] text-text-muted">json</span>
            </div>
            <pre className="p-4 text-xs leading-relaxed overflow-x-auto">
              <code className="text-text-dim">
                {`// .mcp.json — connect to ToolRoute as an MCP server
// BYOK keys you registered apply automatically to all calls
{
  "toolroute": {
    "type": "http",
    "url": "https://toolroute.ai/mcp",
    "headers": {
      "Authorization": "Bearer tr_live_abc123..."
    }
  }
}`}
              </code>
            </pre>
          </div>
          <p>
            Your agent calls OpenAI through the MCP interface. The gateway sees
            you have a BYOK key for OpenAI, uses it, returns the result, and
            charges zero credits. The agent does not need to know whether BYOK
            or credits funded the call.
          </p>

          <h2 className="text-xl font-bold pt-4">
            Common Questions
          </h2>

          <h3 className="text-base font-semibold pt-2">
            What happens if my BYOK key is invalid or expired?
          </h3>
          <p>
            The gateway attempts the call with your key. If the upstream provider
            returns an authentication error, the gateway returns that error to
            you &mdash; it does not silently fall back to credits. This prevents
            unexpected charges. You will see a clear error message indicating the
            BYOK key was rejected by the provider.
          </p>

          <h3 className="text-base font-semibold pt-2">
            Can I use BYOK for some operations and credits for others on the
            same provider?
          </h3>
          <p>
            BYOK is registered at the provider level, not the operation level.
            If you register an OpenAI key, all OpenAI operations use it. If you
            want credit-based billing for a provider, do not register a BYOK key
            for it.
          </p>

          <h3 className="text-base font-semibold pt-2">
            Is there a cost to use BYOK?
          </h3>
          <p>
            No. BYOK calls do not deduct credits. You pay only whatever the
            upstream provider charges for the API call. The gateway does not add
            a surcharge on BYOK requests. See{" "}
            <Link
              href="/pricing"
              className="text-accent hover:underline"
            >
              pricing
            </Link>{" "}
            for the full breakdown of free tools, credit costs, and BYOK
            eligibility per provider.
          </p>

          <h3 className="text-base font-semibold pt-2">
            Which providers support BYOK?
          </h3>
          <p>
            Any provider where the gateway uses an API key for upstream
            authentication supports BYOK. This includes OpenAI, Stripe, Twilio,
            Resend, Tavily, Firecrawl, ElevenLabs, Exa, and others. The full
            list is available in the{" "}
            <Link
              href="/docs"
              className="text-accent hover:underline"
            >
              documentation
            </Link>
            . Free tools that do not require upstream keys (Context7, Playwright,
            Semgrep) do not need BYOK because they are already free.
          </p>

          <div className="border-t border-border pt-8 mt-8">
            <h3 className="font-semibold text-sm mb-4">Related Articles</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/blog/use-mcp-tools-without-managing-servers" className="text-accent hover:underline">
                  How to Use MCP Tools Without Managing Servers
                </Link>
              </li>
              <li>
                <Link href="/blog/ai-agent-tool-billing-credits" className="text-accent hover:underline">
                  AI Agent Tool Billing: How Credits Work
                </Link>
              </li>
              <li>
                <Link href="/blog/mcp-server-security-best-practices" className="text-accent hover:underline">
                  MCP Server Security Best Practices
                </Link>
              </li>
              <li>
                <Link href="/blog/claude-code-mcp-server-setup" className="text-accent hover:underline">
                  Claude Code MCP Server Setup: 3 Ways to Connect Tools
                </Link>
              </li>
              <li>
                <Link href="/blog/self-hosted-vs-cloud-mcp-servers" className="text-accent hover:underline">
                  Self-Hosted vs Cloud MCP Servers: Pros, Cons, and Decision Matrix
                </Link>
              </li>
            </ul>
          </div>

          <div className="border-t border-border pt-8 mt-8">
            <p className="text-text-dim">
              ToolRoute supports BYOK for all major providers.{" "}
              <Link href="/docs" className="text-accent hover:underline">
                Read the docs
              </Link>
              ,{" "}
              <Link href="/pricing" className="text-accent hover:underline">
                see pricing
              </Link>
              , or{" "}
              <Link href="/blog/use-mcp-tools-without-managing-servers" className="text-accent hover:underline">
                learn how the gateway works
              </Link>
              .
            </p>
          </div>
        </div>
      </article>
    </>
  );
}
