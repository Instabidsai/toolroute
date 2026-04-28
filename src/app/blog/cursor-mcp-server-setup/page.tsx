import type { Metadata } from "next";
import Link from "next/link";
import { safeJsonLd } from "@/lib/json-ld";

export const metadata: Metadata = {
  title: "Cursor MCP Server Setup: Connect 87 Tools to Your IDE (2026 Guide)",
  description:
    "Step-by-step guide to setting up MCP servers in Cursor. Configure ToolRoute as your MCP gateway and get 87 tools inside your IDE with one JSON block.",
  alternates: { canonical: "/blog/cursor-mcp-server-setup" },
  openGraph: {
    title: "Cursor MCP Server Setup: Connect 87 Tools to Your IDE",
    description:
      "Cursor supports MCP servers natively. This guide shows how to connect ToolRoute and get 87 tools in your editor.",
    url: "https://toolroute.ai/blog/cursor-mcp-server-setup",
    type: "article",
    publishedTime: "2026-04-15T00:00:00Z",
  },
};

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline:
    "Cursor MCP Server Setup: Connect 87 Tools to Your IDE (2026 Guide)",
  description:
    "Step-by-step guide to setting up MCP servers in Cursor. Configure ToolRoute as your MCP gateway and get 87 tools inside your IDE.",
  datePublished: "2026-04-15T00:00:00Z",
  author: { "@type": "Organization", name: "ToolRoute" },
  publisher: {
    "@type": "Organization",
    name: "ToolRoute",
    url: "https://toolroute.ai",
  },
  mainEntityOfPage: "https://toolroute.ai/blog/cursor-mcp-server-setup",
};

const howToSchema = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to Set Up MCP Servers in Cursor",
  description:
    "Connect MCP tools to Cursor IDE using the built-in MCP settings panel or mcp.json config file, then verify with a live tool call.",
  step: [
    {
      "@type": "HowToStep",
      name: "Open Cursor MCP settings",
      text: "Open Cursor Settings (Ctrl+Shift+J or Cmd+Shift+J), navigate to the MCP tab, and click Add new MCP server.",
    },
    {
      "@type": "HowToStep",
      name: "Add the ToolRoute gateway config",
      text: "Paste the ToolRoute MCP server configuration with your API key into the Cursor MCP settings panel or your project's .cursor/mcp.json file.",
    },
    {
      "@type": "HowToStep",
      name: "Verify the connection",
      text: "Confirm the green connected indicator appears next to the ToolRoute entry in Cursor MCP settings. If it shows red, check your API key and URL.",
    },
    {
      "@type": "HowToStep",
      name: "Test a tool call in Composer",
      text: "Open Cursor Composer (Ctrl+I or Cmd+I), switch to Agent mode, and ask it to use a ToolRoute tool such as searching documentation or scanning code.",
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
            Cursor MCP Server Setup: Connect 87 Tools to Your IDE
          </h1>
          <p className="text-text-dim text-sm leading-relaxed mb-4">
            Cursor added native MCP server support in early 2025, and it has
            become one of the most practical ways to extend an AI-powered IDE
            with external capabilities. Instead of copying API responses between
            windows or manually feeding context into prompts, you configure an{" "}
            <Link
              href="/blog/what-is-model-context-protocol"
              className="text-accent hover:underline"
            >
              MCP server
            </Link>{" "}
            once and Cursor&apos;s agent can call tools directly. This guide
            walks through the complete Cursor MCP server setup for 2026,
            from adding your first server to connecting a gateway that
            gives you 87 tools through a single config block.
          </p>
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <span>April 15, 2026</span>
            <span>7 min read</span>
            <span>ToolRoute Team</span>
          </div>
        </header>

        <div className="prose-custom space-y-8 text-sm leading-relaxed">
          <h2 className="text-xl font-bold pt-4">
            Why MCP Matters Inside Cursor
          </h2>
          <p>
            Cursor ships with strong built-in capabilities: file editing, terminal
            access, codebase search, and web browsing. But real development work
            often reaches beyond your local repository. You need to query a
            database, check DNS records, scan for vulnerabilities, look up
            library documentation, manage deployments, or interact with third-party
            APIs. Without MCP, each of these requires leaving your editor or
            pasting results back and forth.
          </p>
          <p>
            The{" "}
            <Link
              href="/blog/what-is-model-context-protocol"
              className="text-accent hover:underline"
            >
              Model Context Protocol
            </Link>{" "}
            solves this by giving Cursor a standard way to discover and call
            external tools. When you configure an MCP server, Cursor pulls the
            tool list on startup. Those tools then appear in Composer (Agent
            mode), and the AI can decide when to call them based on your
            request. No plugins, no extensions marketplace, no manual
            wiring. Just a JSON config and a running server.
          </p>

          <h2 className="text-xl font-bold pt-4">
            Prerequisites
          </h2>
          <ul className="space-y-1.5 text-text-dim pl-4">
            <li>Cursor version 0.45 or later (MCP support is built in)</li>
            <li>A ToolRoute API key from{" "}
              <Link href="/docs" className="text-accent hover:underline">
                toolroute.ai
              </Link>{" "}
              (free tier available)
            </li>
            <li>Agent mode enabled in Composer (this is the default in 2026 versions)</li>
          </ul>

          <h2 className="text-xl font-bold pt-4">
            Step 1: Open Cursor MCP Settings
          </h2>
          <p>
            There are two ways to configure MCP servers in Cursor: through the
            settings UI or by editing a JSON file directly. Both produce the
            same result.
          </p>

          <h3 className="text-base font-semibold pt-2">
            Option A: Settings UI
          </h3>
          <p>
            Open Cursor Settings with <code>Ctrl+Shift+J</code> (Windows/Linux)
            or <code>Cmd+Shift+J</code> (macOS). Navigate to the{" "}
            <strong>MCP</strong> tab in the left sidebar. You will see a list of
            any existing MCP servers and an &quot;Add new MCP server&quot; button
            at the top.
          </p>
          <p>
            {/* Screenshot description: The Cursor Settings panel open to the MCP tab, showing an empty server list with the "Add new MCP server" button highlighted at the top right. */}
            In the settings panel, the MCP tab shows all configured servers with
            their connection status. A green dot means connected. Red means the
            server is unreachable or the config is invalid.
          </p>

          <h3 className="text-base font-semibold pt-2">
            Option B: Edit mcp.json Directly
          </h3>
          <p>
            Cursor reads MCP configuration from{" "}
            <code>.cursor/mcp.json</code> in your project root for
            project-scoped servers, or from{" "}
            <code>~/.cursor/mcp.json</code> in your home directory for global
            servers. If the file does not exist, create it.
          </p>

          <h2 className="text-xl font-bold pt-4">
            Step 2: Add the ToolRoute Gateway
          </h2>
          <p>
            Rather than configuring individual MCP servers for each tool you
            need, a{" "}
            <Link
              href="/blog/what-is-an-mcp-gateway"
              className="text-accent hover:underline"
            >
              gateway
            </Link>{" "}
            lets you access every tool through one endpoint. ToolRoute
            exposes{" "}
            <Link href="/tools" className="text-accent hover:underline">
              87 tools
            </Link>{" "}
            as a single MCP server. One config block, one API key, zero local
            processes.
          </p>
          <p>
            If you clicked &quot;Add new MCP server&quot; in the UI, select
            &quot;HTTP&quot; as the type and paste the URL and headers. If you
            are editing the JSON file directly, add this block:
          </p>
          <div className="bg-[#0d0d18] border border-border rounded-lg overflow-hidden my-4">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-card/50">
              <span className="text-[10px] text-text-muted">
                .cursor/mcp.json
              </span>
            </div>
            <pre className="p-4 text-xs leading-relaxed overflow-x-auto">
              <code className="text-text-dim">
                {`{
  "mcpServers": {
    "toolroute": {
      "type": "streamable-http",
      "url": "https://toolroute.ai/mcp",
      "headers": {
        "Authorization": "Bearer tr_live_your_key_here"
      }
    }
  }
}`}
              </code>
            </pre>
          </div>
          <p>
            Replace <code>tr_live_your_key_here</code> with your actual API
            key. You can generate one from your{" "}
            <Link href="/docs" className="text-accent hover:underline">
              ToolRoute dashboard
            </Link>
            .
          </p>
          <p>
            {/* Screenshot description: The Cursor MCP settings panel showing the ToolRoute entry with a green "connected" indicator dot. The server name reads "toolroute" and the URL shows "https://toolroute.ai/mcp". */}
            After saving, the MCP settings panel should show the ToolRoute
            entry with a green connected indicator. Cursor connects to the
            gateway on startup and pulls the full tool catalog automatically.
          </p>

          <h2 className="text-xl font-bold pt-4">
            Step 3: Verify the Connection
          </h2>
          <p>
            Back in the MCP settings tab, confirm that &quot;toolroute&quot;
            shows a green dot. If it shows red or disconnected:
          </p>
          <ul className="space-y-1.5 text-text-dim pl-4">
            <li>
              Check that the URL is exactly{" "}
              <code>https://toolroute.ai/mcp</code> with no trailing slash
            </li>
            <li>
              Verify your API key starts with <code>tr_live_</code> or{" "}
              <code>tr_test_</code>
            </li>
            <li>Confirm the JSON syntax is valid (no trailing commas, matching brackets)</li>
            <li>Restart Cursor if you edited the file while the app was running</li>
          </ul>
          <p>
            You can also click the refresh icon next to the server name to force
            a reconnection attempt without restarting.
          </p>

          <h2 className="text-xl font-bold pt-4">
            Step 4: Test a Tool Call in Composer
          </h2>
          <p>
            Open Composer with <code>Ctrl+I</code> (Windows/Linux) or{" "}
            <code>Cmd+I</code> (macOS). Make sure you are in{" "}
            <strong>Agent mode</strong> (the dropdown at the top of the Composer
            panel). Then try a request that requires an external tool:
          </p>
          <div className="bg-[#0d0d18] border border-border rounded-lg overflow-hidden my-4">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-card/50">
              <span className="text-[10px] text-text-muted">
                Cursor Composer
              </span>
            </div>
            <pre className="p-4 text-xs leading-relaxed overflow-x-auto">
              <code className="text-text-dim">
                {`> Look up the Next.js App Router docs for generateStaticParams
  [Cursor calls ToolRoute → Context7 adapter]
  Found 12 documentation sections for generateStaticParams...

> Search for open issues in our GitHub repo about auth
  [Cursor calls ToolRoute → GitHub adapter]
  Found 3 open issues matching "auth"...

> Scan this file for SQL injection vulnerabilities
  [Cursor calls ToolRoute → Semgrep adapter]
  Scanning src/lib/db.ts... 0 findings.`}
              </code>
            </pre>
          </div>
          <p>
            Cursor will show you which MCP tool it is calling and ask for
            approval before executing. Once you approve, the tool runs through
            the ToolRoute gateway and the result appears inline in the
            conversation.
          </p>

          <h2 className="text-xl font-bold pt-4">
            What Tools Are Available?
          </h2>
          <p>
            Through the ToolRoute gateway, Cursor gets access to{" "}
            <Link href="/tools" className="text-accent hover:underline">
              87 tools across 14 categories
            </Link>
            . Here are some of the most useful ones for IDE workflows:
          </p>
          <div className="bg-bg-card border border-border rounded-lg p-6 my-6">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-muted border-b border-border">
                  <th className="text-left pb-2 pr-4">Category</th>
                  <th className="text-left pb-2 pr-4">Tools</th>
                  <th className="text-left pb-2">Use Case</th>
                </tr>
              </thead>
              <tbody className="text-text-dim">
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Documentation</td>
                  <td className="py-2 pr-4">Context7, Ref</td>
                  <td className="py-2">
                    Look up current library docs without leaving your editor
                  </td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Security</td>
                  <td className="py-2 pr-4">Semgrep</td>
                  <td className="py-2">
                    Scan code for vulnerabilities on demand
                  </td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Database</td>
                  <td className="py-2 pr-4">Supabase</td>
                  <td className="py-2">
                    Run SQL queries, list tables, check migrations
                  </td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Source Control</td>
                  <td className="py-2 pr-4">GitHub</td>
                  <td className="py-2">
                    Manage issues, PRs, and actions from Composer
                  </td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Infrastructure</td>
                  <td className="py-2 pr-4">Vercel, GoDaddy</td>
                  <td className="py-2">
                    Check deployments, manage DNS records
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Payments</td>
                  <td className="py-2 pr-4">Stripe</td>
                  <td className="py-2">
                    Look up customers, invoices, and subscriptions
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Browse the complete catalog at{" "}
            <Link href="/tools" className="text-accent hover:underline">
              toolroute.ai/tools
            </Link>
            .
          </p>

          <h2 className="text-xl font-bold pt-4">
            Project-Level vs Global Configuration
          </h2>
          <p>
            Cursor supports two config file locations:
          </p>
          <ul className="space-y-1.5 text-text-dim pl-4">
            <li>
              <strong>Project-level</strong>:{" "}
              <code>.cursor/mcp.json</code> in your project root. Only
              active when that project is open. Good for team-shared configs
              you can commit to version control (keep your API key in an
              environment variable if you do this).
            </li>
            <li>
              <strong>Global</strong>:{" "}
              <code>~/.cursor/mcp.json</code> in your home directory.
              Active across all projects. Best for personal tool setups like
              ToolRoute that you want everywhere.
            </li>
          </ul>
          <p>
            If the same server name appears in both files, the project-level
            config takes precedence.
          </p>

          <h2 className="text-xl font-bold pt-4">
            Adding Individual MCP Servers Alongside ToolRoute
          </h2>
          <p>
            You can mix the gateway with local MCP servers. If you have a
            custom internal tool or a self-hosted server, add it alongside the
            ToolRoute entry:
          </p>
          <div className="bg-[#0d0d18] border border-border rounded-lg overflow-hidden my-4">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-card/50">
              <span className="text-[10px] text-text-muted">
                .cursor/mcp.json
              </span>
            </div>
            <pre className="p-4 text-xs leading-relaxed overflow-x-auto">
              <code className="text-text-dim">
                {`{
  "mcpServers": {
    "toolroute": {
      "type": "streamable-http",
      "url": "https://toolroute.ai/mcp",
      "headers": {
        "Authorization": "Bearer tr_live_your_key_here"
      }
    },
    "my-internal-api": {
      "command": "node",
      "args": ["./tools/internal-mcp-server.js"]
    }
  }
}`}
              </code>
            </pre>
          </div>
          <p>
            Cursor connects to both servers on startup. The gateway handles the
            87 public tools while your local server handles proprietary ones.
          </p>

          <h2 className="text-xl font-bold pt-4">
            Cursor vs Claude Code MCP Setup
          </h2>
          <p>
            If you also use{" "}
            <Link
              href="/blog/claude-code-mcp-server-setup"
              className="text-accent hover:underline"
            >
              Claude Code
            </Link>
            , the concepts are identical but the config file differs. Claude
            Code reads <code>.mcp.json</code> in the project root or home
            directory. Cursor reads <code>.cursor/mcp.json</code> or uses
            the settings UI. The ToolRoute gateway URL and API key are the
            same in both environments. You can run both simultaneously and
            they share the same tool catalog.
          </p>

          <h2 className="text-xl font-bold pt-4">
            Troubleshooting
          </h2>

          <h3 className="text-base font-semibold pt-2">
            Server Shows &quot;Disconnected&quot; in Settings
          </h3>
          <p>
            Cursor validates the MCP connection on startup. If the server
            appears red or disconnected, check the URL for typos, confirm
            the API key is valid, and verify your network can reach{" "}
            <code>toolroute.ai</code>. Click the refresh button next to the
            server entry to retry without restarting Cursor.
          </p>

          <h3 className="text-base font-semibold pt-2">
            Tools Not Appearing in Composer
          </h3>
          <p>
            Make sure you are in <strong>Agent mode</strong>, not Ask or Edit
            mode. MCP tools are only available in Agent mode. Also verify
            that Cursor has finished connecting to the server (the green dot
            should be solid, not pulsing).
          </p>

          <h3 className="text-base font-semibold pt-2">
            Tool Calls Returning Errors
          </h3>
          <p>
            If a tool call fails, ToolRoute returns a descriptive error
            message. Common causes: expired API key, insufficient credits,
            or the target service is temporarily down. Check your key status at{" "}
            <Link href="/docs" className="text-accent hover:underline">
              toolroute.ai/docs
            </Link>
            .
          </p>

          <h3 className="text-base font-semibold pt-2">
            JSON Syntax Errors
          </h3>
          <p>
            Cursor silently ignores an invalid <code>mcp.json</code>. If
            no servers appear after saving, validate your JSON. Common
            mistakes: trailing commas after the last entry, single quotes
            instead of double quotes, or missing the outer{" "}
            <code>mcpServers</code> wrapper object.
          </p>

          <h2 className="text-xl font-bold pt-4">
            Frequently Asked Questions
          </h2>

          <h3 className="text-base font-semibold pt-2">
            Does Cursor charge extra for MCP tool usage?
          </h3>
          <p>
            No. Cursor does not charge for MCP connections. Tool usage is
            billed by the tool provider. With ToolRoute, you pay per tool
            call through{" "}
            <Link
              href="/blog/ai-agent-tool-billing-credits"
              className="text-accent hover:underline"
            >
              prepaid credits
            </Link>
            . Your Cursor subscription is unaffected.
          </p>

          <h3 className="text-base font-semibold pt-2">
            Can I use MCP tools in Cursor&apos;s chat (not Composer)?
          </h3>
          <p>
            MCP tools are available in Composer Agent mode. The inline chat
            (Ctrl+K / Cmd+K) and the side chat panel do not currently
            trigger MCP tool calls. Use Composer for tool-integrated workflows.
          </p>

          <h3 className="text-base font-semibold pt-2">
            Is there a limit to how many MCP servers I can configure?
          </h3>
          <p>
            Cursor has no hard limit on configured servers. However, each
            stdio-based server spawns a local process that consumes memory.
            Using a gateway like ToolRoute avoids this: one HTTP connection
            provides access to all 87 tools with zero local processes.
          </p>

          <h3 className="text-base font-semibold pt-2">
            Do MCP servers work with Cursor&apos;s free plan?
          </h3>
          <p>
            Yes. MCP support is available on all Cursor plans, including free.
            The MCP settings tab and Agent mode in Composer are not
            gated by plan tier.
          </p>

          <div className="border-t border-border pt-8 mt-8">
            <h3 className="font-semibold text-sm mb-4">Related Articles</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/blog/claude-code-mcp-server-setup"
                  className="text-accent hover:underline"
                >
                  Claude Code MCP Server Setup: 3 Ways to Connect Tools (2026
                  Guide)
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
            </ul>
          </div>

          <div className="border-t border-border pt-8 mt-8">
            <p className="text-text-dim">
              ToolRoute gives Cursor access to 87 tools through one{" "}
              <code>mcp.json</code> entry.{" "}
              <Link href="/docs" className="text-accent hover:underline">
                Read the docs
              </Link>
              ,{" "}
              <Link href="/tools" className="text-accent hover:underline">
                browse the tool catalog
              </Link>
              ,{" "}
              <Link
                href="/integrations"
                className="text-accent hover:underline"
              >
                see all integrations
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
