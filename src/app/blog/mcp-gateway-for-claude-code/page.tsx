import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "MCP Gateway for Claude Code: Why Every Serious Session Needs One",
  description:
    "Stdio MCP servers break at scale, eat RAM, and slow Claude Code cold-starts to 40+ seconds. An MCP gateway fixes all three. Here is how to wire one up in under five minutes, and why it is the default for anyone running more than a single session.",
  alternates: { canonical: "/blog/mcp-gateway-for-claude-code" },
  openGraph: {
    title: "MCP Gateway for Claude Code",
    description:
      "Stdio MCP servers break at scale. An MCP gateway fixes it. Full setup guide for Claude Code.",
    url: "https://toolroute.ai/blog/mcp-gateway-for-claude-code",
    type: "article",
    publishedTime: "2026-04-15T00:00:00Z",
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is an MCP gateway for Claude Code?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "An MCP gateway is a single HTTP endpoint that hosts many MCP tools behind one API key. In Claude Code, you configure it once in .mcp.json as a type: http entry, and the session gets access to every tool the gateway routes to without spawning per-tool processes, managing per-tool credentials, or hitting the stdio process-fork ceiling.",
      },
    },
    {
      "@type": "Question",
      name: "Why not just use stdio MCP servers directly in Claude Code?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Stdio works until it does not. Each server becomes a child process per session. At ~15 servers across 3+ sessions you hit 500+ node processes and multi-GB RAM overhead. Cold starts stretch past 40 seconds. A gateway replaces that with one HTTP connection per session regardless of tool count.",
      },
    },
    {
      "@type": "Question",
      name: "Do MCP gateways work with the Claude Code harness?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Claude Code supports MCP Streamable HTTP transport natively since the 0.8 harness. Any gateway that speaks MCP Streamable HTTP (ToolRoute, Composio, Zapier MCP, custom hubs) plugs in as a single config entry. The harness does not care whether the endpoint is local or remote.",
      },
    },
    {
      "@type": "Question",
      name: "How is an MCP gateway different from Claude Code plugins?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Plugins (slash commands, hooks, skills) live inside the Claude Code harness itself and run locally. An MCP gateway is an external tool execution layer - the harness calls out to it over HTTP. Gateways scale horizontally across machines and sessions; plugins scale per-install. Use both: plugins for local automation, gateways for tool execution.",
      },
    },
    {
      "@type": "Question",
      name: "What does an MCP gateway cost compared to self-hosting servers?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Self-hosting costs are hidden: RAM (2-4 GB per session stack), cold-start time (40+ sec), and ops time maintaining 30+ MCP server dependencies. Managed gateways like ToolRoute use prepaid credits ($1 buys roughly 100 search queries or 2,000 database reads). Break-even is around 10 hours of ops time per month - which one dev spends fighting stdio fork issues.",
      },
    },
  ],
};

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "MCP Gateway for Claude Code: Why Every Serious Session Needs One",
  description:
    "Stdio MCP servers break at scale, eat RAM, and slow Claude Code cold-starts to 40+ seconds. An MCP gateway fixes all three.",
  datePublished: "2026-04-15T00:00:00Z",
  author: { "@type": "Organization", name: "ToolRoute" },
  publisher: {
    "@type": "Organization",
    name: "ToolRoute",
    url: "https://toolroute.ai",
  },
  mainEntityOfPage: "https://toolroute.ai/blog/mcp-gateway-for-claude-code",
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
          <p className="text-accent text-xs font-medium mb-4">
            Claude Code / Infrastructure
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">
            MCP Gateway for Claude Code: Why Every Serious Session Needs One
          </h1>
          <p className="text-text-dim text-sm leading-relaxed mb-4">
            Stdio MCP servers break at scale, eat RAM, and stretch Claude Code
            cold-starts past 40 seconds. An MCP gateway fixes all three. Here
            is how to wire one up in under five minutes, and why it becomes
            the default the moment you run more than a single session.
          </p>
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <span>April 15, 2026</span>
            <span>9 min read</span>
            <span>ToolRoute Team</span>
          </div>
        </header>

        <div className="prose-custom space-y-8 text-sm leading-relaxed">
          <p>
            Claude Code ships with the best MCP client we have used: it
            respects stdio, Streamable HTTP, and SSE transports, it handles
            auth headers, it surfaces schema errors in-session, and it hot-
            reloads config changes without a full restart. But the MCP
            client is only half the equation. The <em>other</em> half is
            what sits on the other side of that <code className="bg-bg-card px-1.5 py-0.5 rounded text-accent text-xs">.mcp.json</code>
            entry. Most Claude Code guides tell you to fill it with stdio
            <code className="bg-bg-card px-1.5 py-0.5 rounded text-accent text-xs mx-1">command</code>
            entries and call it done. For a single session and a few servers,
            that works. For a real workflow - multiple sessions, dozens of
            tools, production use - it does not.
          </p>
          <p>
            An MCP gateway is what goes on the other side. This article is
            what a gateway does, why it matters specifically for Claude
            Code, and the exact config changes to adopt one.
          </p>

          <h2 className="text-xl font-bold pt-4">The Claude Code-Specific Problem</h2>
          <p>
            Claude Code has three design properties that interact badly with
            pure stdio MCP:
          </p>
          <ol className="space-y-1.5 text-text-dim pl-4 list-decimal">
            <li>
              <strong className="text-text">Long-lived sessions.</strong> A Claude Code window stays open for hours. Stdio processes stay resident that entire time.
            </li>
            <li>
              <strong className="text-text">Parallel sessions are encouraged.</strong> Each project can have its own session. Power users run 5-10 at once.
            </li>
            <li>
              <strong className="text-text">Global MCP config.</strong> <code>~/.mcp.json</code> entries apply to every session - so adding one server adds it to all of them.
            </li>
          </ol>
          <p>
            These three in combination are what make stdio MCP collapse.
            If you run one Claude Code with 10 stdio servers, you spawn
            about 40 node processes (including dependency sub-processes)
            consuming roughly 1.5 GB RAM. Fine. Open a second session and
            both doubles. At eight sessions and 50 servers, you hit the
            ceiling we hit: 3,624 processes, 128 GB RAM exhausted. Full
            math is in our{" "}
            <Link href="/blog/mcp-stdio-vs-http-hub" className="text-accent hover:underline">
              stdio vs HTTP hub breakdown
            </Link>.
          </p>

          <h2 className="text-xl font-bold pt-4">What an MCP Gateway Adds</h2>
          <p>
            A gateway is an HTTP service that:
          </p>
          <ul className="space-y-1.5 text-text-dim pl-4 list-disc">
            <li>Hosts many MCP tools behind one endpoint</li>
            <li>Exposes them via MCP Streamable HTTP (and usually REST / A2A / OpenAI-function flavors)</li>
            <li>Manages per-tool authentication centrally</li>
            <li>Meters usage and (in managed gateways) handles billing</li>
            <li>Runs once - no per-session spawn</li>
          </ul>
          <p>
            For Claude Code specifically, the gateway model means:
          </p>
          <div className="bg-bg-card border border-border rounded-lg p-6 my-6">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-muted border-b border-border">
                  <th className="text-left pb-2 pr-4">Metric</th>
                  <th className="text-left pb-2 pr-4">Stdio .mcp.json</th>
                  <th className="text-left pb-2">Gateway .mcp.json</th>
                </tr>
              </thead>
              <tbody className="text-text-dim">
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Config lines for 50 tools</td>
                  <td className="py-2 pr-4">~250</td>
                  <td className="py-2 text-green">~4</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Session cold start</td>
                  <td className="py-2 pr-4">40+ seconds</td>
                  <td className="py-2 text-green">&lt; 2 seconds</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">RAM at 8 sessions</td>
                  <td className="py-2 pr-4 text-red-400">~127 GB</td>
                  <td className="py-2 text-green">~200 MB</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">API keys in config</td>
                  <td className="py-2 pr-4">30+</td>
                  <td className="py-2 text-green">1</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Adding a new tool</td>
                  <td className="py-2 pr-4">Edit config + restart</td>
                  <td className="py-2 text-green">No config change</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 className="text-xl font-bold pt-4">Five-Minute Setup: Claude Code + ToolRoute Gateway</h2>
          <p>
            Here is the exact change. ToolRoute is the MCP gateway we built
            after breaking our own box with stdio. Other gateways (Composio,
            Zapier MCP, self-hosted supergateway hubs) use the same pattern.
          </p>

          <h3 className="text-base font-semibold pt-2">Step 1: Get an API key</h3>
          <p>
            Sign up at <Link href="/" className="text-accent hover:underline">toolroute.ai</Link>.
            Free tier includes enough credits to evaluate. Create a key from
            the <Link href="/dashboard/keys" className="text-accent hover:underline">keys dashboard</Link>.
          </p>

          <h3 className="text-base font-semibold pt-2">Step 2: Add to .mcp.json</h3>
          <p>
            Open <code className="bg-bg-card px-1.5 py-0.5 rounded text-accent text-xs">~/.mcp.json</code> (the global Claude Code MCP config):
          </p>
          <pre className="bg-bg-card border border-border rounded-lg p-4 overflow-x-auto text-xs">
{`{
  "mcpServers": {
    "toolroute": {
      "type": "http",
      "url": "https://toolroute.ai/mcp",
      "headers": {
        "Authorization": "Bearer tr_YOUR_KEY_HERE"
      }
    }
  }
}`}
          </pre>
          <p>
            That is the full config. Restart Claude Code. The session now
            has access to every tool ToolRoute routes to - 87 at time of
            writing, covering search, email, voice, payments, databases,
            browsers, and more.
          </p>

          <h3 className="text-base font-semibold pt-2">Step 3: Remove stdio entries you no longer need</h3>
          <p>
            The tools your gateway covers can be deleted from <code className="bg-bg-card px-1.5 py-0.5 rounded text-accent text-xs">.mcp.json</code>
            entirely. Keep stdio for the handful of truly local tools (file
            watchers, custom internal tooling, in-development servers). For
            everything networked, go through the gateway.
          </p>

          <h3 className="text-base font-semibold pt-2">Step 4: Verify</h3>
          <p>
            In a new Claude Code session, type:{" "}
            <code className="bg-bg-card px-1.5 py-0.5 rounded text-accent text-xs">/mcp</code>.
            The output lists every tool available. You should see the
            gateway-backed tools (tavily, resend, stripe, playwright, etc.)
            plus any stdio entries you kept. One list, one auth layer.
          </p>

          <h2 className="text-xl font-bold pt-4">The Comparison Table: Direct Stdio vs Gateway vs Hybrid</h2>
          <p>
            Most Claude Code guides leave readers guessing which mode they
            should be in. Here is the rubric we use across our own fleet:
          </p>
          <div className="bg-bg-card border border-border rounded-lg p-6 my-6">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-muted border-b border-border">
                  <th className="text-left pb-2 pr-4">Situation</th>
                  <th className="text-left pb-2">Recommended setup</th>
                </tr>
              </thead>
              <tbody className="text-text-dim">
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">One session, 1-5 MCP tools, solo dev</td>
                  <td className="py-2">Pure stdio is fine</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">One session, 10+ tools</td>
                  <td className="py-2 text-green">Gateway for most, stdio for local-only</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">2+ parallel sessions</td>
                  <td className="py-2 text-green">Gateway (stdio process count explodes)</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Team of devs sharing an MCP stack</td>
                  <td className="py-2 text-green">Managed gateway (shared auth, shared billing)</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Security-sensitive workloads</td>
                  <td className="py-2">Self-hosted hub + BYOK gateway for 3rd party</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Developing a new MCP server</td>
                  <td className="py-2">Stdio for the one under development</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 className="text-xl font-bold pt-4">Claude Code-Specific Gateway Features Worth Using</h2>

          <h3 className="text-base font-semibold pt-2">1. Pre-session capability check</h3>
          <p>
            Claude Code encourages agents to verify tool availability before
            starting work. Gateways expose a <code className="bg-bg-card px-1.5 py-0.5 rounded text-accent text-xs">GET /api/v1/tools</code>
            catalog that an agent can query once and cache in-session. This
            is the basis of our{" "}
            <Link href="/blog/check-before-build-mcp-tool-pattern" className="text-accent hover:underline">
              check-before-build pattern
            </Link>: before writing any new capability, the agent runs a
            semantic search against the catalog to see if one already exists.
            Saves hours per session.
          </p>

          <h3 className="text-base font-semibold pt-2">2. Unified error format</h3>
          <p>
            Claude Code surfaces tool errors in the conversation. Every MCP
            server returns errors differently (HTTP 500, 200 with error
            body, silent timeout). A gateway normalizes these to one schema
            so the agent reasoning stays consistent. See{" "}
            <Link href="/blog/how-ai-agents-handle-tool-failures" className="text-accent hover:underline">
              how AI agents handle tool failures
            </Link>.
          </p>

          <h3 className="text-base font-semibold pt-2">3. BYOK for accounts you already pay for</h3>
          <p>
            If you already have an Anthropic / OpenAI / Stripe account, a
            gateway should let you bring that key. ToolRoute supports BYOK
            for all 87 tools - you pay the underlying provider directly and
            the gateway bills only for routing. Details:{" "}
            <Link href="/blog/bring-your-own-key-mcp-byok" className="text-accent hover:underline">
              Bring Your Own Key (BYOK) guide
            </Link>.
          </p>

          <h3 className="text-base font-semibold pt-2">4. Auto-routing</h3>
          <p>
            Claude Code agents often know what they want (&quot;search the
            web for X&quot;) but not the exact tool name. A good gateway lets the
            agent send a description and picks the right tool based on
            semantic match, historical success, and cost. See{" "}
            <Link href="/blog/mcp-auto-routing-ai-agent-tools" className="text-accent hover:underline">
              MCP auto-routing
            </Link>.
          </p>

          <h2 className="text-xl font-bold pt-4">What About Privacy and Control?</h2>
          <p>
            A legitimate concern: routing tool calls through a third party
            means that party sees the request payloads. Mitigations:
          </p>
          <ul className="space-y-1.5 text-text-dim pl-4 list-disc">
            <li><strong className="text-text">Self-host the gateway.</strong> supergateway, mcp-proxy, and open-source ToolRoute deployments all run on your own box.</li>
            <li><strong className="text-text">Use BYOK.</strong> Sensitive providers (your Supabase, your Stripe) stay on your keys; gateway just proxies.</li>
            <li><strong className="text-text">Network-scope the gateway.</strong> Bind to 127.0.0.1 if fully local, or VPC-internal for team deploys.</li>
            <li><strong className="text-text">Audit logs.</strong> Every serious gateway logs every call. You can diff expectations against reality.</li>
          </ul>
          <p>
            For a deeper comparison of the tradeoffs, see our{" "}
            <Link href="/blog/self-hosted-vs-cloud-mcp-servers" className="text-accent hover:underline">
              self-hosted vs cloud MCP servers breakdown
            </Link>.
          </p>

          <h2 className="text-xl font-bold pt-4">The Minimum Viable Migration</h2>
          <p>
            If you are on pure stdio today and do not want to adopt the
            full gateway pattern, the cheapest incremental win is:
          </p>
          <ol className="space-y-1.5 text-text-dim pl-4 list-decimal">
            <li>Count your <code>.mcp.json</code> stdio entries.</li>
            <li>If over 10, wrap them with supergateway on local ports 18901-18925.</li>
            <li>Keep every tool, gain back ~90% of the RAM and 95% of the cold-start time.</li>
            <li>When you are tired of maintaining that, swap the local hub for a managed gateway.</li>
          </ol>
          <p>
            The gateway path is a migration, not a rewrite. You can move one
            tool at a time.
          </p>

          <h2 className="text-xl font-bold pt-4">Frequently Asked Questions</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-sm">
                What is an MCP gateway for Claude Code?
              </h3>
              <p className="text-text-dim mt-1">
                A single HTTP endpoint that hosts many MCP tools behind one
                API key. Configured once in <code>.mcp.json</code> as
                <code>type: http</code>. The session gets every tool
                without spawning per-tool processes or managing per-tool
                credentials.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                Why not just use stdio MCP servers directly?
              </h3>
              <p className="text-text-dim mt-1">
                Stdio works until it does not. Each server becomes a child
                process per session. At ~15 servers across 3+ sessions you
                hit 500+ node processes and multi-GB RAM. Cold starts
                stretch past 40 seconds. A gateway replaces that with one
                HTTP connection per session regardless of tool count.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                Do MCP gateways work with Claude Code?
              </h3>
              <p className="text-text-dim mt-1">
                Yes. Claude Code supports MCP Streamable HTTP natively.
                Any gateway that speaks that transport (ToolRoute,
                Composio, Zapier MCP, custom hubs) plugs in as a single
                config entry.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                How is a gateway different from Claude Code plugins?
              </h3>
              <p className="text-text-dim mt-1">
                Plugins (slash commands, hooks, skills) run inside the
                harness. A gateway is external tool execution over HTTP.
                Gateways scale across sessions and machines; plugins scale
                per-install. Use both.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                What does an MCP gateway cost vs self-hosting?
              </h3>
              <p className="text-text-dim mt-1">
                Self-hosting costs are RAM, cold-start time, and ops time.
                Managed gateways use prepaid credits (roughly $1 per 100
                search queries). Break-even is about 10 hours of ops time
                per month.
              </p>
            </div>
          </div>

          <div className="border-t border-border pt-8 mt-8">
            <h3 className="font-semibold text-sm mb-4">Related Articles</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/blog/mcp-stdio-vs-http-hub" className="text-accent hover:underline">MCP stdio vs HTTP Hub: The 128 GB RAM Crash</Link></li>
              <li><Link href="/blog/claude-code-mcp-server-setup" className="text-accent hover:underline">Claude Code MCP Server Setup: 3 Ways to Connect Tools</Link></li>
              <li><Link href="/blog/what-is-an-mcp-gateway" className="text-accent hover:underline">What Is an MCP Gateway?</Link></li>
              <li><Link href="/blog/check-before-build-mcp-tool-pattern" className="text-accent hover:underline">The Check-Before-Build MCP Tool Pattern</Link></li>
              <li><Link href="/glossary" className="text-accent hover:underline">MCP Glossary</Link></li>
            </ul>
          </div>

          <div className="border-t border-border pt-8 mt-8">
            <p className="text-text-dim">
              ToolRoute is an MCP gateway built for exactly this use case.
              One line in <code>.mcp.json</code>, 87 tools, no RAM overhead.{" "}
              <Link href="/tools" className="text-accent hover:underline">
                Browse the catalog
              </Link>{" "}
              or{" "}
              <Link href="/docs" className="text-accent hover:underline">
                read the Claude Code setup doc
              </Link>
              .
            </p>
          </div>
        </div>
      </article>
    </>
  );
}
