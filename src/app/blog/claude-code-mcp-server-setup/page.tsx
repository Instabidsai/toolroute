import type { Metadata } from "next";
import Link from "next/link";
import { safeJsonLd } from "@/lib/json-ld";

export const metadata: Metadata = {
  title: "Claude Code MCP Server Setup: 3 Ways to Connect Tools (2026 Guide)",
  description:
    "Step-by-step guide to connecting MCP tools to Claude Code. Compare direct stdio servers, HTTP hub transport, and the ToolRoute gateway for one-config access to 87 tools.",
  alternates: { canonical: "/blog/claude-code-mcp-server-setup" },
  openGraph: {
    title: "Claude Code MCP Server Setup: 3 Ways to Connect Tools",
    description:
      "Direct stdio, HTTP hub, or gateway. Three methods compared with .mcp.json examples.",
    url: "https://toolroute.ai/blog/claude-code-mcp-server-setup",
    type: "article",
    publishedTime: "2026-04-16T00:00:00Z",
  },
};

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline:
    "Claude Code MCP Server Setup: 3 Ways to Connect Tools (2026 Guide)",
  description:
    "Step-by-step guide to connecting MCP tools to Claude Code. Compare direct stdio servers, HTTP hub transport, and the ToolRoute gateway.",
  datePublished: "2026-04-16T00:00:00Z",
  author: { "@type": "Organization", name: "ToolRoute" },
  publisher: {
    "@type": "Organization",
    name: "ToolRoute",
    url: "https://toolroute.ai",
  },
  mainEntityOfPage:
    "https://toolroute.ai/blog/claude-code-mcp-server-setup",
};

const howToSchema = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to Set Up MCP Servers for Claude Code",
  description:
    "Connect MCP tools to Claude Code using direct stdio servers, an HTTP hub, or the ToolRoute gateway.",
  step: [
    {
      "@type": "HowToStep",
      name: "Choose your transport method",
      text: "Decide between stdio (direct process), HTTP (hub or remote server), or a managed gateway based on how many tools you need and how many sessions you run.",
    },
    {
      "@type": "HowToStep",
      name: "Configure .mcp.json",
      text: "Create or edit the .mcp.json file in your project root or home directory. Add entries for each MCP server with the correct type, command or URL, and any required headers or environment variables.",
    },
    {
      "@type": "HowToStep",
      name: "Verify the connection",
      text: "Start Claude Code and confirm the tools appear. Run a test call such as ToolSearch to verify the MCP server responds correctly.",
    },
    {
      "@type": "HowToStep",
      name: "Scale with a gateway (optional)",
      text: "Replace multiple server entries with a single ToolRoute gateway entry to access 87 tools through one endpoint, one API key, and zero local processes.",
    },
  ],
};

export default function Article() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(howToSchema) }}
      />
      <article className="max-w-3xl mx-auto">
        <header className="mb-12">
          <p className="text-accent text-xs font-medium mb-4">Guide</p>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">
            Claude Code MCP Server Setup: 3 Ways to Connect Tools
          </h1>
          <p className="text-text-dim text-sm leading-relaxed mb-4">
            Claude Code can call external tools through the{" "}
            <Link
              href="/blog/what-is-model-context-protocol"
              className="text-accent hover:underline"
            >
              Model Context Protocol
            </Link>
            . But the way you configure those connections determines how many
            tools you can use, how much memory they consume, and whether your
            setup survives scaling to multiple sessions. This guide walks
            through three approaches, from simplest to most scalable.
          </p>
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <span>April 16, 2026</span>
            <span>8 min read</span>
            <span>ToolRoute Team</span>
          </div>
        </header>

        <div className="prose-custom space-y-8 text-sm leading-relaxed">
          <h2 className="text-xl font-bold pt-4">
            How Claude Code Discovers Tools
          </h2>
          <p>
            Claude Code reads a file called <code>.mcp.json</code> to find MCP
            servers. Each entry in this file defines a server name, its
            transport type, and the connection details. When Claude Code starts,
            it connects to every configured server and pulls a list of
            available tools. Those tools then appear in your session alongside
            built-in capabilities like file editing and shell access.
          </p>
          <p>
            The <code>.mcp.json</code> file can live in two places: your
            project root (project-scoped) or your home directory
            (global, shared across all projects). Project-level entries
            override global ones if names collide.
          </p>
          <p>
            There are three transport types you can use in this file.
            Each solves a different problem.
          </p>

          <h2 className="text-xl font-bold pt-4">
            Method 1: Direct MCP Server (stdio Transport)
          </h2>
          <p>
            The simplest approach. You point Claude Code at an MCP server
            binary or script, and it spawns the process directly using standard
            input/output for communication.
          </p>

          <h3 className="text-base font-semibold pt-2">
            Step 1: Install the MCP Server
          </h3>
          <p>
            Most MCP servers are published as npm packages. Install them
            globally or within your project:
          </p>
          <div className="bg-[#0d0d18] border border-border rounded-lg overflow-hidden my-4">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-card/50">
              <span className="text-[10px] text-text-muted">bash</span>
            </div>
            <pre className="p-4 text-xs leading-relaxed overflow-x-auto">
              <code className="text-text-dim">
                {`# Example: install the Playwright MCP server
npm install -g @anthropic/mcp-playwright

# Example: install a Python MCP server
pip install mcp-server-semgrep`}
              </code>
            </pre>
          </div>

          <h3 className="text-base font-semibold pt-2">
            Step 2: Add the Entry to .mcp.json
          </h3>
          <p>
            Create <code>.mcp.json</code> in your project root with a{" "}
            <code>&quot;command&quot;</code> transport entry:
          </p>
          <div className="bg-[#0d0d18] border border-border rounded-lg overflow-hidden my-4">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-card/50">
              <span className="text-[10px] text-text-muted">json</span>
            </div>
            <pre className="p-4 text-xs leading-relaxed overflow-x-auto">
              <code className="text-text-dim">
                {`// .mcp.json — stdio transport
{
  "playwright": {
    "type": "stdio",
    "command": "npx",
    "args": ["@anthropic/mcp-playwright"]
  },
  "semgrep": {
    "type": "stdio",
    "command": "python",
    "args": ["-m", "mcp_server_semgrep"],
    "env": {
      "SEMGREP_APP_TOKEN": "your-token-here"
    }
  }
}`}
              </code>
            </pre>
          </div>

          <h3 className="text-base font-semibold pt-2">
            Step 3: Restart Claude Code
          </h3>
          <p>
            Claude Code reads <code>.mcp.json</code> on startup. After adding
            entries, restart your session. The tools from each server will
            appear automatically.
          </p>

          <h3 className="text-base font-semibold pt-2">
            When to Use stdio
          </h3>
          <ul className="space-y-1.5 text-text-dim pl-4">
            <li>You use 1-3 MCP servers</li>
            <li>You run a single Claude Code session at a time</li>
            <li>You need the simplest possible setup</li>
          </ul>

          <h3 className="text-base font-semibold pt-2">
            The Scaling Problem
          </h3>
          <p>
            Every stdio entry spawns a new operating system process. If you
            configure 10 MCP servers and open 5 Claude Code sessions, that is
            50 processes. Each Node.js-based server consumes 50-200 MB of RAM.
            At scale, stdio transport can exhaust system memory. We hit this
            wall running 8 sessions with 50 tools: over 400 Node.js processes
            consuming 128 GB of RAM.
          </p>

          <h2 className="text-xl font-bold pt-4">
            Method 2: HTTP Hub (Shared Server)
          </h2>
          <p>
            Instead of spawning a process per session, run your MCP servers
            once as HTTP services and point Claude Code at their URLs. This is
            the HTTP transport method.
          </p>

          <h3 className="text-base font-semibold pt-2">
            Step 1: Start Your MCP Servers as HTTP Services
          </h3>
          <p>
            Most MCP servers support an HTTP mode. Run them on designated ports
            and leave them running in the background:
          </p>
          <div className="bg-[#0d0d18] border border-border rounded-lg overflow-hidden my-4">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-card/50">
              <span className="text-[10px] text-text-muted">bash</span>
            </div>
            <pre className="p-4 text-xs leading-relaxed overflow-x-auto">
              <code className="text-text-dim">
                {`# Start Playwright MCP on port 18901
npx @anthropic/mcp-playwright --http --port 18901 &

# Start Semgrep MCP on port 18902
python -m mcp_server_semgrep --http --port 18902 &

# Start Context7 on port 18903 (Class-A — BYOK required on ToolRoute gateway)
npx @context7/mcp --http --port 18903 &`}
              </code>
            </pre>
          </div>

          <h3 className="text-base font-semibold pt-2">
            Step 2: Configure .mcp.json with HTTP Transport
          </h3>
          <div className="bg-[#0d0d18] border border-border rounded-lg overflow-hidden my-4">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-card/50">
              <span className="text-[10px] text-text-muted">json</span>
            </div>
            <pre className="p-4 text-xs leading-relaxed overflow-x-auto">
              <code className="text-text-dim">
                {`// .mcp.json — HTTP transport (shared hub)
{
  "playwright": {
    "type": "http",
    "url": "http://localhost:18901/mcp"
  },
  "semgrep": {
    "type": "http",
    "url": "http://localhost:18902/mcp"
  },
  "context7": {
    "type": "http",
    "url": "http://localhost:18903/mcp"
  }
}`}
              </code>
            </pre>
          </div>

          <h3 className="text-base font-semibold pt-2">
            When to Use an HTTP Hub
          </h3>
          <ul className="space-y-1.5 text-text-dim pl-4">
            <li>You run multiple Claude Code sessions simultaneously</li>
            <li>You use 5-20 MCP servers</li>
            <li>You want each server running once regardless of session count</li>
            <li>You are comfortable managing long-running processes</li>
          </ul>

          <h3 className="text-base font-semibold pt-2">
            The Remaining Problem
          </h3>
          <p>
            The HTTP hub solves the per-session process multiplication. But you
            still manage every server individually: installation, updates, port
            assignment, API keys, process monitoring, and restarts. Each new
            tool adds operational overhead. At 20+ tools, you are effectively
            running a small distributed system that has nothing to do with the
            actual AI work.
          </p>

          <h2 className="text-xl font-bold pt-4">
            Method 3: Through a Gateway (One Config, All Tools)
          </h2>
          <p>
            A{" "}
            <Link
              href="/blog/use-mcp-tools-without-managing-servers"
              className="text-accent hover:underline"
            >
              managed MCP gateway
            </Link>{" "}
            runs the tools on its infrastructure and exposes them through a
            single MCP endpoint. You configure one entry and get access to
            every tool in the registry.
          </p>

          <h3 className="text-base font-semibold pt-2">
            Step 1: Get an API Key
          </h3>
          <p>
            Sign up at{" "}
            <Link href="/docs" className="text-accent hover:underline">
              toolroute.ai
            </Link>{" "}
            and generate an API key. This single key authenticates against all
            87 tools.
          </p>

          <h3 className="text-base font-semibold pt-2">
            Step 2: Add One Entry to .mcp.json
          </h3>
          <div className="bg-[#0d0d18] border border-border rounded-lg overflow-hidden my-4">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-card/50">
              <span className="text-[10px] text-text-muted">json</span>
            </div>
            <pre className="p-4 text-xs leading-relaxed overflow-x-auto">
              <code className="text-text-dim">
                {`// .mcp.json — ToolRoute gateway (87 tools, one line)
{
  "toolroute": {
    "type": "http",
    "url": "https://toolroute.ai/mcp",
    "headers": {
      "Authorization": "Bearer tr_live_xxx"
    }
  }
}`}
              </code>
            </pre>
          </div>
          <p>
            That is the entire configuration. No local installations, no port
            management, no per-tool API keys. Claude Code connects to the
            gateway on startup and receives the full{" "}
            <Link href="/tools" className="text-accent hover:underline">
              tool catalog
            </Link>
            .
          </p>

          <h3 className="text-base font-semibold pt-2">
            Step 3: Use Any Tool Immediately
          </h3>
          <p>
            Once connected, every tool in the registry is available in your
            session. Search the web with Tavily. Scan code with Semgrep. Query
            documentation with Context7. Send emails with Resend. Manage DNS
            with GoDaddy. All through the same gateway endpoint.
          </p>
          <div className="bg-[#0d0d18] border border-border rounded-lg overflow-hidden my-4">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-card/50">
              <span className="text-[10px] text-text-muted">
                Claude Code session
              </span>
            </div>
            <pre className="p-4 text-xs leading-relaxed overflow-x-auto">
              <code className="text-text-dim">
                {`> Use context7 to look up the Next.js App Router docs
  [ToolRoute routes to Context7 adapter]
  Found 47 documentation chunks for next.js/app-router...

> Scan this repo with semgrep for SQL injection
  [ToolRoute routes to Semgrep adapter]
  Scanning 142 files... 0 findings.

> Search Stripe for customer with email user@example.com
  [ToolRoute routes to Stripe adapter]
  Found 1 customer: cus_abc123...`}
              </code>
            </pre>
          </div>

          <h3 className="text-base font-semibold pt-2">
            When to Use a Gateway
          </h3>
          <ul className="space-y-1.5 text-text-dim pl-4">
            <li>You want access to many tools without managing any servers</li>
            <li>You run multiple concurrent Claude Code sessions</li>
            <li>You do not want to manage per-tool API keys</li>
            <li>You value zero setup time over latency optimization</li>
          </ul>

          <h2 className="text-xl font-bold pt-4">
            Comparison: All Three Methods Side by Side
          </h2>
          <div className="bg-bg-card border border-border rounded-lg p-6 my-6">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-muted border-b border-border">
                  <th className="text-left pb-2 pr-4">Factor</th>
                  <th className="text-left pb-2 pr-4">stdio (Direct)</th>
                  <th className="text-left pb-2 pr-4">HTTP Hub</th>
                  <th className="text-left pb-2">Gateway</th>
                </tr>
              </thead>
              <tbody className="text-text-dim">
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Setup per tool</td>
                  <td className="py-2 pr-4">Install + configure</td>
                  <td className="py-2 pr-4">Install + run + assign port</td>
                  <td className="py-2 text-green">None</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Processes (10 tools, 5 sessions)</td>
                  <td className="py-2 pr-4">50</td>
                  <td className="py-2 pr-4">10</td>
                  <td className="py-2 text-green">0 local</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">RAM usage</td>
                  <td className="py-2 pr-4">500 MB - 10 GB+</td>
                  <td className="py-2 pr-4">500 MB - 2 GB</td>
                  <td className="py-2 text-green">0 (remote)</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">API keys to manage</td>
                  <td className="py-2 pr-4">One per tool</td>
                  <td className="py-2 pr-4">One per tool</td>
                  <td className="py-2 text-green">One total</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Latency</td>
                  <td className="py-2 pr-4 text-green">Lowest (in-process)</td>
                  <td className="py-2 pr-4">Low (localhost)</td>
                  <td className="py-2">+50-100ms (network hop)</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Customization</td>
                  <td className="py-2 pr-4 text-green">Full control</td>
                  <td className="py-2 pr-4 text-green">Full control</td>
                  <td className="py-2">Standard operations</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">.mcp.json entries</td>
                  <td className="py-2 pr-4">One per tool</td>
                  <td className="py-2 pr-4">One per tool</td>
                  <td className="py-2 text-green">One total</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 className="text-xl font-bold pt-4">
            Mixing Methods: The Hybrid Approach
          </h2>
          <p>
            You are not locked into a single method. A common pattern is to use
            a gateway for the long tail of tools you need occasionally, while
            running a few high-frequency or custom tools locally via HTTP hub.
          </p>
          <div className="bg-[#0d0d18] border border-border rounded-lg overflow-hidden my-4">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-card/50">
              <span className="text-[10px] text-text-muted">json</span>
            </div>
            <pre className="p-4 text-xs leading-relaxed overflow-x-auto">
              <code className="text-text-dim">
                {`// .mcp.json — hybrid: gateway + local custom tools
{
  "toolroute": {
    "type": "http",
    "url": "https://toolroute.ai/mcp",
    "headers": {
      "Authorization": "Bearer tr_live_xxx"
    }
  },
  "my-custom-db": {
    "type": "http",
    "url": "http://localhost:18910/mcp"
  },
  "internal-api": {
    "type": "stdio",
    "command": "node",
    "args": ["./tools/internal-mcp.js"]
  }
}`}
              </code>
            </pre>
          </div>
          <p>
            This gives you the best of both worlds: 87 tools from the gateway
            with zero infrastructure, plus your proprietary tools running
            locally where you have full control.
          </p>

          <h2 className="text-xl font-bold pt-4">
            Troubleshooting Common Issues
          </h2>

          <h3 className="text-base font-semibold pt-2">
            Tools Not Appearing After Config Change
          </h3>
          <p>
            Claude Code reads <code>.mcp.json</code> on startup. If you edit
            the file mid-session, restart Claude Code for the changes to take
            effect. Also verify the JSON is valid: a trailing comma or missing
            bracket will silently prevent loading.
          </p>

          <h3 className="text-base font-semibold pt-2">
            Connection Refused on HTTP Transport
          </h3>
          <p>
            Ensure the target server is running before starting Claude Code.
            Check that the port matches your configuration and that no firewall
            is blocking localhost connections.
          </p>

          <h3 className="text-base font-semibold pt-2">
            stdio Server Crashes Mid-Session
          </h3>
          <p>
            When a stdio process crashes, tools from that server become
            unavailable. Claude Code does not automatically restart stdio
            processes. You will need to restart the session. This is one reason
            to prefer HTTP transport or a gateway for production workflows.
          </p>

          <h3 className="text-base font-semibold pt-2">
            High Memory Usage
          </h3>
          <p>
            If you see system memory climbing, check your process count. Each
            stdio MCP server spawns per session. Switch high-usage servers to
            HTTP transport, or move the entire tool stack to a gateway.
          </p>

          <h2 className="text-xl font-bold pt-4">
            Which Method Should You Choose?
          </h2>
          <div className="bg-bg-card border border-border rounded-lg p-6 my-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-green font-semibold">
                  Use stdio when...
                </span>
                <p className="text-text-muted mt-1">
                  You need 1-3 tools, run one session at a time, and want the
                  simplest setup with lowest latency.
                </p>
              </div>
              <div>
                <span className="text-amber font-semibold">
                  Use HTTP hub when...
                </span>
                <p className="text-text-muted mt-1">
                  You need 5-20 tools, run multiple sessions, and are
                  comfortable managing server processes and ports.
                </p>
              </div>
              <div>
                <span className="text-cyan font-semibold">
                  Use a gateway when...
                </span>
                <p className="text-text-muted mt-1">
                  You want access to many tools with zero infrastructure. One
                  config line. No local processes. No per-tool API keys.
                </p>
              </div>
            </div>
          </div>
          <p>
            Most teams start with stdio for one or two tools and evolve toward
            HTTP hub or gateway as their tool count grows. The{" "}
            <Link
              href="/blog/what-is-model-context-protocol"
              className="text-accent hover:underline"
            >
              Model Context Protocol
            </Link>{" "}
            is transport-agnostic by design, so switching methods only requires
            changing <code>.mcp.json</code> entries, not rewriting any agent
            logic.
          </p>

          <div className="border-t border-border pt-8 mt-8">
            <h3 className="font-semibold text-sm mb-4">Related Articles</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/blog/what-is-model-context-protocol"
                  className="text-accent hover:underline"
                >
                  What Is Model Context Protocol (MCP)? The Complete Guide for
                  2026
                </Link>
              </li>
              <li>
                <Link
                  href="/blog/use-mcp-tools-without-managing-servers"
                  className="text-accent hover:underline"
                >
                  How to Use MCP Tools Without Managing Servers
                </Link>
              </li>
              <li>
                <Link
                  href="/blog/best-mcp-servers-ai-agents-2026"
                  className="text-accent hover:underline"
                >
                  Best MCP Servers for AI Agents in 2026: 87 Tools Rated and
                  Compared
                </Link>
              </li>
            </ul>
          </div>

          <div className="border-t border-border pt-8 mt-8">
            <p className="text-text-dim">
              ToolRoute gives Claude Code access to 87 tools through one{" "}
              <code>.mcp.json</code> entry.{" "}
              <Link href="/docs" className="text-accent hover:underline">
                Read the docs
              </Link>
              ,{" "}
              <Link href="/tools" className="text-accent hover:underline">
                browse the tool catalog
              </Link>
              , or{" "}
              <Link href="/pricing" className="text-accent hover:underline">
                see pricing
              </Link>
              .
            </p>
          </div>
        </div>
      </article>
    </>
  );
}
