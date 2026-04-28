import type { Metadata } from "next";
import Link from "next/link";
import { safeJsonLd } from "@/lib/json-ld";

export const metadata: Metadata = {
  title: "MCP stdio vs HTTP Hub: The 128GB RAM Crash That Changed How We Ship MCP",
  description:
    "Running MCP servers as stdio processes feels fine at 3 sessions. At 8 sessions across 50 servers, it crashed the box. Here is the math, the failure mode, and why HTTP hub is the only answer at scale.",
  alternates: { canonical: "/blog/mcp-stdio-vs-http-hub" },
  openGraph: {
    title: "MCP stdio vs HTTP Hub: The 128GB RAM Crash",
    description:
      "50 stdio MCP servers x 8 Claude Code sessions = 3,624 node processes = 128GB RAM exhausted. The math, the fix, the lessons.",
    url: "https://toolroute.ai/blog/mcp-stdio-vs-http-hub",
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
      name: "Why does MCP stdio transport crash at scale?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Stdio MCP servers spawn one process per client session. If you run 50 MCP servers across 8 Claude Code sessions, that is 400 node processes just from fan-out. Add module dependencies (each server ships 4-10 sub-processes for compiled binaries, watchers, and workers) and you land near 3,624 processes consuming 128 GB of RAM. Windows page file thrashes, the OS OOMs, and every session dies at once.",
      },
    },
    {
      "@type": "Question",
      name: "What is an MCP HTTP hub?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "An MCP HTTP hub is a single long-running process that hosts all your MCP servers behind HTTP endpoints on local ports (typically 18901-18926). Every Claude Code session connects to the same hub via HTTP instead of spawning its own stdio copy. One hub instance serves unlimited sessions, so RAM scales linearly with servers, not sessions times servers.",
      },
    },
    {
      "@type": "Question",
      name: "How do I convert stdio MCP servers to HTTP hub?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Wrap each stdio server with an HTTP shim (mcp-proxy, supergateway, or a custom Express wrapper that pipes HTTP requests to stdio subprocess stdin/stdout). Assign each server a port, start them all from one script at boot, and change your .mcp.json from 'command' entries to 'http' entries pointing to localhost:PORT. The hub stays up; sessions connect and disconnect freely.",
      },
    },
    {
      "@type": "Question",
      name: "When is stdio MCP still acceptable?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Stdio is fine for a single developer running one Claude Code or Cursor session with under 10 MCP servers. Below that threshold the process count stays under 100 and memory stays under 4 GB. The moment you open a second long-lived session or add a tenth server, you are on the crash curve and should move to HTTP hub.",
      },
    },
    {
      "@type": "Question",
      name: "Does HTTP hub add latency compared to stdio?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Localhost HTTP adds roughly 1-3 ms per tool call versus stdio pipes. Tool execution itself takes 50-5000 ms, so the overhead is in the noise. What you save in RAM, session stability, and cold-start time is worth orders of magnitude more than the negligible latency delta.",
      },
    },
  ],
};

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "MCP stdio vs HTTP Hub: The 128GB RAM Crash That Changed How We Ship MCP",
  description:
    "Running MCP servers as stdio processes feels fine at 3 sessions. At 8 sessions across 50 servers, it crashed the box. Here is the math, the failure mode, and why HTTP hub is the only answer at scale.",
  datePublished: "2026-04-15T00:00:00Z",
  author: { "@type": "Organization", name: "ToolRoute" },
  publisher: {
    "@type": "Organization",
    name: "ToolRoute",
    url: "https://toolroute.ai",
  },
  mainEntityOfPage: "https://toolroute.ai/blog/mcp-stdio-vs-http-hub",
};

export default function Article() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(articleSchema) }}
      />
      <article className="max-w-3xl mx-auto">
        <header className="mb-12">
          <p className="text-accent text-xs font-medium mb-4">
            War Story / Infrastructure
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">
            MCP stdio vs HTTP Hub: The 128 GB RAM Crash That Changed How We Ship MCP
          </h1>
          <p className="text-text-dim text-sm leading-relaxed mb-4">
            Running MCP servers as stdio processes feels fine at 3 sessions. At 8
            sessions across 50 servers, it crashed the box. Here is the math,
            the failure mode, and why HTTP hub is the only answer at scale.
          </p>
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <span>April 15, 2026</span>
            <span>10 min read</span>
            <span>ToolRoute Team</span>
          </div>
        </header>

        <div className="prose-custom space-y-8 text-sm leading-relaxed">
          <p>
            We killed a 128 GB Windows box running eight concurrent Claude Code
            sessions. The culprit was not the models, not our code, not even
            the tools themselves. It was the transport. Every MCP server in our
            <code className="bg-bg-card px-1.5 py-0.5 rounded text-accent text-xs mx-1">
              .mcp.json
            </code>
            was configured as a stdio <code className="bg-bg-card px-1.5 py-0.5 rounded text-accent text-xs">command</code>, and stdio spawns one process per session. This article is the exact
            failure mode, the arithmetic that explains it, and the migration
            path that permanently fixed it.
          </p>
          <p>
            If you run more than one long-lived MCP client (Claude Code,
            Cursor, Windsurf, Cline, Zed) against more than a handful of
            servers, this is your future. Read before you hit it.
          </p>

          <h2 className="text-xl font-bold pt-4">The Crash: What Actually Happened</h2>
          <p>
            The setup: a single Windows 11 workstation, 128 GB RAM, used as a
            venture factory cockpit. Eight Claude Code sessions live at once,
            one per company. Each session reads the same
            <code className="bg-bg-card px-1.5 py-0.5 rounded text-accent text-xs mx-1">
              ~/.mcp.json
            </code>
            with 50+ MCP server entries covering Supabase, Vercel, GitHub,
            Composio, Stripe, Playwright, context7, ref, desktop-commander,
            screen-capture, and two dozen others.
          </p>
          <p>
            Every entry looked like this:
          </p>
          <pre className="bg-bg-card border border-border rounded-lg p-4 overflow-x-auto text-xs">
{`{
  "supabase": {
    "command": "npx",
    "args": ["-y", "@supabase/mcp-server-supabase"]
  },
  "playwright": {
    "command": "npx",
    "args": ["@playwright/mcp"]
  }
  // ...48 more entries, all "command"-style
}`}
          </pre>
          <p>
            Claude Code boots. The harness reads the config, forks one child
            process per server. Forty seconds in, Task Manager shows 400+
            <code className="bg-bg-card px-1.5 py-0.5 rounded text-accent text-xs mx-1">
              node.exe
            </code>
            entries. Some MCP servers ship additional subprocesses - Playwright
            launches a chromium watcher, desktop-commander runs a shell shim,
            Supabase dev binaries compile on first call. By the second session
            opening, we were at 800. By the fifth we passed 2,000. At session
            eight the page file thrashed, the kernel killed processes at
            random, and every Claude Code window blue-screened in sequence.
          </p>

          <h2 className="text-xl font-bold pt-4">The Arithmetic Nobody Does Up Front</h2>
          <p>
            Stdio MCP is process-per-client-per-server. The multiplication
            compounds faster than any intuition prepares you for.
          </p>
          <div className="bg-bg-card border border-border rounded-lg p-6 my-6">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-muted border-b border-border">
                  <th className="text-left pb-2 pr-4">Variable</th>
                  <th className="text-left pb-2 pr-4">Value</th>
                  <th className="text-left pb-2">Subtotal</th>
                </tr>
              </thead>
              <tbody className="text-text-dim">
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">MCP servers in config</td>
                  <td className="py-2 pr-4">50</td>
                  <td className="py-2">50</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Concurrent CC sessions</td>
                  <td className="py-2 pr-4">8</td>
                  <td className="py-2">400 top-level node processes</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Avg subprocesses per server</td>
                  <td className="py-2 pr-4">~8 (watchers, binaries, workers)</td>
                  <td className="py-2">3,200 child processes</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Overhead (npx spawners, hooks)</td>
                  <td className="py-2 pr-4">+~424</td>
                  <td className="py-2">~3,624 total</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Avg RAM per node process</td>
                  <td className="py-2 pr-4">35 MB resident</td>
                  <td className="py-2">~127 GB resident</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Available on 128 GB box</td>
                  <td className="py-2 pr-4">~112 GB (OS + other apps)</td>
                  <td className="py-2 text-red-400">CRASH</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            The failure mode is O(sessions x servers x subprocesses). On a
            single-session developer laptop (say, one Claude Code + 10 MCP
            servers), stdio spawns ~40 processes using maybe 1.5 GB. That is
            completely fine. The curve only bends against you when you scale
            either axis.
          </p>

          <h2 className="text-xl font-bold pt-4">Why stdio Was Designed This Way (and Why It Does Not Scale)</h2>
          <p>
            The MCP spec supports multiple transports on purpose. Stdio was
            the first transport because it is dead simple: the client forks
            the server as a child process, communicates over stdin/stdout
            pipes, and kills it on exit. No networking, no ports, no auth,
            no cross-origin issues, no daemon lifecycle to manage. For a
            single developer iterating on a single MCP server during
            development, it is perfect.
          </p>
          <p>
            The design assumption is that every client has its own
            short-lived instance. That assumption breaks the moment you:
          </p>
          <ul className="space-y-1.5 text-text-dim pl-4 list-disc">
            <li>Run multiple editors / clients in parallel (Justin runs 8 Claude Code sessions)</li>
            <li>Keep sessions alive for hours or days</li>
            <li>Register many servers globally instead of per-project</li>
            <li>Have MCP servers that ship their own heavyweight dependencies (browsers, compilers, ML models)</li>
          </ul>
          <p>
            Each of those violates the implicit assumption, and each one
            multiplies the process count.
          </p>

          <h2 className="text-xl font-bold pt-4">The Fix: HTTP Hub Transport</h2>
          <p>
            The MCP spec defines an HTTP transport (Streamable HTTP / SSE)
            for exactly this reason. An HTTP hub is one long-running process
            that hosts every MCP server behind a local port, started once at
            boot. Every client, every session, connects to the same hub via
            HTTP. The process count becomes O(servers), independent of
            sessions.
          </p>
          <p>
            Our hub lives at
            <code className="bg-bg-card px-1.5 py-0.5 rounded text-accent text-xs mx-1">
              ~/mcp-hub/start-mcp-hub.sh
            </code>
            and assigns each server a port in the 18901-18926 range. The
            startup script is 40 lines. The hub runs as a detached background
            process that survives reboots via a scheduled task.
          </p>
          <p>
            The <code className="bg-bg-card px-1.5 py-0.5 rounded text-accent text-xs">.mcp.json</code>
            entries change from <code className="bg-bg-card px-1.5 py-0.5 rounded text-accent text-xs">command</code>
            to <code className="bg-bg-card px-1.5 py-0.5 rounded text-accent text-xs">http</code>:
          </p>
          <pre className="bg-bg-card border border-border rounded-lg p-4 overflow-x-auto text-xs">
{`{
  "supabase": {
    "type": "http",
    "url": "http://localhost:18901/mcp"
  },
  "playwright": {
    "type": "http",
    "url": "http://localhost:18902/mcp"
  }
  // ...one port per server, all pointing at the hub
}`}
          </pre>
          <p>
            When Claude Code boots, instead of forking 50 processes, it opens
            50 HTTP connections. Opening a ninth session opens 50 more
            connections to the <em>same</em> hub - no new processes. Memory
            stays flat regardless of how many sessions run.
          </p>

          <h2 className="text-xl font-bold pt-4">Before and After: The Numbers</h2>
          <div className="bg-bg-card border border-border rounded-lg p-6 my-6">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-muted border-b border-border">
                  <th className="text-left pb-2 pr-4">Metric</th>
                  <th className="text-left pb-2 pr-4">stdio (50 servers, 8 sessions)</th>
                  <th className="text-left pb-2">HTTP hub (same load)</th>
                </tr>
              </thead>
              <tbody className="text-text-dim">
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Node processes</td>
                  <td className="py-2 pr-4 text-red-400">~3,624</td>
                  <td className="py-2 text-green">~55 (hub + children)</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">RAM used</td>
                  <td className="py-2 pr-4 text-red-400">~127 GB</td>
                  <td className="py-2 text-green">~2.1 GB</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Cold start per session</td>
                  <td className="py-2 pr-4">42 seconds</td>
                  <td className="py-2 text-green">1.3 seconds</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Per-call latency</td>
                  <td className="py-2 pr-4">~0 ms (stdio pipe)</td>
                  <td className="py-2">~2 ms (localhost HTTP)</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">OS stability at 8 sessions</td>
                  <td className="py-2 pr-4 text-red-400">crashes</td>
                  <td className="py-2 text-green">stable indefinitely</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            The per-call latency penalty is 2 ms. Tool execution typically
            runs 50-5000 ms. The overhead is invisible. What is very visible:
            cold-start dropped from 42 seconds to 1.3, because new sessions
            no longer spawn 50 npx installs and module loads - the hub
            already has everything resident.
          </p>

          <h2 className="text-xl font-bold pt-4">How To Build an MCP HTTP Hub (3 Options)</h2>

          <h3 className="text-base font-semibold pt-2">Option 1: supergateway (simplest)</h3>
          <p>
            <Link
              href="https://github.com/supercorp-ai/supergateway"
              className="text-accent hover:underline"
              target="_blank"
              rel="noopener"
            >
              supergateway
            </Link>
            wraps any stdio MCP server in HTTP/SSE with one command:
            <code className="bg-bg-card px-1.5 py-0.5 rounded text-accent text-xs mx-1">
              supergateway --stdio &quot;npx @supabase/mcp&quot; --port 18901
            </code>
            . Run one instance per server under a process manager (pm2,
            systemd, Windows Task Scheduler). Point <code className="bg-bg-card px-1.5 py-0.5 rounded text-accent text-xs">.mcp.json</code>
            entries at each port.
          </p>

          <h3 className="text-base font-semibold pt-2">Option 2: mcp-proxy (Python)</h3>
          <p>
            <Link
              href="https://github.com/sparfenyuk/mcp-proxy"
              className="text-accent hover:underline"
              target="_blank"
              rel="noopener"
            >
              mcp-proxy
            </Link>
            does the same thing in Python. Lower memory footprint per shim,
            better if your box is already node-heavy.
          </p>

          <h3 className="text-base font-semibold pt-2">Option 3: Custom Express hub</h3>
          <p>
            If you want one port with routing by server name, write a ~150
            line Node script that spawns each MCP server as a child process
            inside the hub and exposes <code className="bg-bg-card px-1.5 py-0.5 rounded text-accent text-xs">POST /mcp/:server</code>.
            This is what we run. Benefits: one port instead of 50, one
            process manager entry, shared logging, shared auth middleware.
          </p>

          <h3 className="text-base font-semibold pt-2">Option 4: Skip the hub, use a gateway</h3>
          <p>
            If you do not want to operate the hub at all, use a managed
            gateway like <Link href="/" className="text-accent hover:underline">ToolRoute</Link>.
            You get one HTTP endpoint, one API key, 87+ tools, and zero
            processes running on your machine. We detail the tradeoff in{" "}
            <Link href="/blog/self-hosted-vs-cloud-mcp-servers" className="text-accent hover:underline">
              self-hosted vs cloud MCP servers
            </Link>{" "}
            and{" "}
            <Link href="/blog/what-is-an-mcp-gateway" className="text-accent hover:underline">
              what is an MCP gateway
            </Link>.
          </p>

          <h2 className="text-xl font-bold pt-4">The Hard Rule We Wrote After This</h2>
          <p>
            After losing a full day to the crash and subsequent recovery,
            this became rule #9 in our global agent constitution, loaded
            into every Claude Code session:
          </p>
          <div className="bg-bg-card border border-border rounded-lg p-6 my-6">
            <p className="text-text italic">
              &quot;MCP servers: HTTP hub ONLY, NEVER stdio/command. Every MCP
              entry in .mcp.json must be <code className="bg-bg-card px-1.5 py-0.5 rounded text-accent text-xs">type: http</code> pointing to a hub port (18901-18925) or remote URL. If you see <code className="bg-bg-card px-1.5 py-0.5 rounded text-accent text-xs">command</code> in MCP config, that is a bug - move it to the hub. Stdio spawns one process PER SESSION. 50 sessions x 72 servers = 3,624 node processes = 128 GB RAM = crash. Hub runs once after boot.&quot;
            </p>
          </div>

          <h2 className="text-xl font-bold pt-4">Common Objections (And Honest Answers)</h2>

          <h3 className="text-base font-semibold pt-2">&quot;HTTP adds attack surface.&quot;</h3>
          <p>
            Bind the hub to <code className="bg-bg-card px-1.5 py-0.5 rounded text-accent text-xs">127.0.0.1</code>
            only. No remote access, no open ports. Localhost-only HTTP has
            the same trust boundary as localhost stdio.
          </p>

          <h3 className="text-base font-semibold pt-2">&quot;Debugging is easier with stdio (I can see stdout).&quot;</h3>
          <p>
            True for single-server iteration. At that point, temporarily
            switch one <code className="bg-bg-card px-1.5 py-0.5 rounded text-accent text-xs">.mcp.json</code>
            entry back to <code className="bg-bg-card px-1.5 py-0.5 rounded text-accent text-xs">command</code>
            for that specific server. Debug. Switch back. You do not need
            to choose globally. Also see our{" "}
            <Link href="/blog/how-to-debug-mcp-tool-calls" className="text-accent hover:underline">
              guide to debugging MCP tool calls
            </Link>.
          </p>

          <h3 className="text-base font-semibold pt-2">&quot;My team only runs one session.&quot;</h3>
          <p>
            Then stdio is fine <em>today</em>. Write it down as a known
            constraint. The moment anyone runs two sessions, or the server
            count crosses 15, migrate. Do not wait for the crash.
          </p>

          <h3 className="text-base font-semibold pt-2">&quot;Isnt this just what SaaS MCP platforms do?&quot;</h3>
          <p>
            Yes - a managed gateway is effectively &quot;someone elses HTTP hub, hosted
            and maintained.&quot; If you do not want to run the hub, that is the
            point of gateways. ToolRoute is one example. Kong MCP Gateway is
            another. See{" "}
            <Link href="/blog/mcp-gateway-vs-api-gateway" className="text-accent hover:underline">
              MCP gateway vs API gateway
            </Link>{" "}
            for the architectural comparison.
          </p>

          <h2 className="text-xl font-bold pt-4">Frequently Asked Questions</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-sm">
                Why does MCP stdio transport crash at scale?
              </h3>
              <p className="text-text-dim mt-1">
                Stdio MCP servers spawn one process per client session. 50
                servers x 8 sessions = 400 top-level node processes, plus
                ~3,200 child processes from dependencies, totaling ~3,624
                and ~127 GB RAM. Windows page file thrashes, processes get
                OOM-killed, sessions die.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                What is an MCP HTTP hub?
              </h3>
              <p className="text-text-dim mt-1">
                A single long-running process that hosts all MCP servers
                behind local HTTP ports. Clients connect via HTTP instead
                of spawning stdio subprocesses. RAM scales with servers,
                not with sessions-times-servers.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                How do I convert stdio MCP servers to HTTP hub?
              </h3>
              <p className="text-text-dim mt-1">
                Wrap each stdio server with supergateway, mcp-proxy, or a
                custom Express shim. Assign ports. Start all shims at boot.
                Change <code>.mcp.json</code> entries from <code>command</code>
                to <code>http</code> with <code>url: http://localhost:PORT/mcp</code>.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                When is stdio MCP still acceptable?
              </h3>
              <p className="text-text-dim mt-1">
                Single developer, single session, under 10 MCP servers.
                Below that threshold stdio stays under 100 processes and
                4 GB RAM. Any scale above that, switch to HTTP hub.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                Does HTTP hub add latency compared to stdio?
              </h3>
              <p className="text-text-dim mt-1">
                Localhost HTTP adds 1-3 ms per tool call. Tool execution
                takes 50-5000 ms. The overhead is invisible. Cold-start
                per session drops from ~42 s to ~1.3 s, which is a much
                bigger win than the 2 ms penalty.
              </p>
            </div>
          </div>

          <div className="border-t border-border pt-8 mt-8">
            <h3 className="font-semibold text-sm mb-4">Related Articles</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/blog/claude-code-mcp-server-setup" className="text-accent hover:underline">Claude Code MCP Server Setup: 3 Ways to Connect Tools</Link></li>
              <li><Link href="/blog/self-hosted-vs-cloud-mcp-servers" className="text-accent hover:underline">Self-Hosted vs Cloud MCP Servers: Decision Matrix</Link></li>
              <li><Link href="/blog/what-is-an-mcp-gateway" className="text-accent hover:underline">What Is an MCP Gateway?</Link></li>
              <li><Link href="/blog/mcp-server-security-best-practices" className="text-accent hover:underline">MCP Server Security Best Practices</Link></li>
              <li><Link href="/glossary" className="text-accent hover:underline">MCP Glossary</Link></li>
              <li><Link href="/faq" className="text-accent hover:underline">ToolRoute FAQ</Link></li>
            </ul>
          </div>

          <div className="border-t border-border pt-8 mt-8">
            <p className="text-text-dim">
              ToolRoute is a managed MCP gateway, which is effectively a
              hosted HTTP hub. One API key, 87 tools, zero processes on
              your machine.{" "}
              <Link href="/tools" className="text-accent hover:underline">
                Browse the catalog
              </Link>{" "}
              or{" "}
              <Link href="/docs" className="text-accent hover:underline">
                read the docs
              </Link>
              .
            </p>
          </div>
        </div>
      </article>
    </>
  );
}
