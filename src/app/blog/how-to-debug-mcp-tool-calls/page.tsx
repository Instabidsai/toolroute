import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How to Debug MCP Tool Calls: A Practical Troubleshooting Guide (2026)",
  description:
    "MCP tool calls fail in specific, repeatable ways. Learn the 9 failure modes, how to reproduce them, and the exact trace data you need to fix each one fast.",
  alternates: { canonical: "/blog/how-to-debug-mcp-tool-calls" },
  openGraph: {
    title: "How to Debug MCP Tool Calls",
    description:
      "The 9 failure modes of MCP tool calls and how to fix each one. A practical debugging playbook.",
    url: "https://toolroute.ai/blog/how-to-debug-mcp-tool-calls",
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
      name: "Why is my MCP tool call returning an empty response?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Empty responses usually mean one of three things: the tool returned 200 OK with a success-shaped envelope but zero results (most common), the adapter silently swallowed an error and returned null, or the agent timed out before the response arrived. Check the upstream HTTP status, the adapter log, and the total elapsed time before assuming the tool is broken.",
      },
    },
    {
      "@type": "Question",
      name: "How do I enable verbose logging for MCP?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Most MCP servers respect MCP_LOG_LEVEL=debug as an environment variable. For Claude Desktop, check ~/Library/Logs/Claude/mcp*.log on macOS or %APPDATA%/Claude/logs on Windows. Claude Code emits structured logs via CLAUDE_MCP_DEBUG=1. For Cursor, toggle Developer Tools and filter the console for the MCP prefix.",
      },
    },
    {
      "@type": "Question",
      name: "Why does my MCP tool work locally but fail in production?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Four common causes: (1) missing environment variables on the production host, (2) the production runtime has stricter egress rules (Vercel Edge vs Node), (3) the tool requires a long-lived stdio process that serverless cannot keep alive, or (4) auth tokens scoped to a local account. Gateways like ToolRoute eliminate reasons 2 and 3 by moving execution to a stable backend.",
      },
    },
    {
      "@type": "Question",
      name: "What is the fastest way to reproduce an MCP failure?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Isolate the tool from the agent. Capture the exact JSON payload the agent sent (tool name, operation, input), then replay it directly against the MCP endpoint with curl. If it fails without the agent in the loop, the bug is in the tool or adapter. If it only fails with the agent, the bug is in prompt interpretation or tool selection.",
      },
    },
  ],
};

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "How to Debug MCP Tool Calls: A Practical Troubleshooting Guide",
  description:
    "The 9 failure modes of MCP tool calls and exactly how to fix each one.",
  datePublished: "2026-04-15T00:00:00Z",
  author: { "@type": "Organization", name: "ToolRoute" },
  publisher: {
    "@type": "Organization",
    name: "ToolRoute",
    url: "https://toolroute.ai",
  },
  mainEntityOfPage:
    "https://toolroute.ai/blog/how-to-debug-mcp-tool-calls",
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
          <p className="text-accent text-xs font-medium mb-4">Engineering</p>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">
            How to Debug MCP Tool Calls: A Practical Troubleshooting Guide
          </h1>
          <p className="text-text-dim text-sm leading-relaxed mb-4">
            MCP tool calls fail in nine repeatable ways. Here is how to
            recognize each one from the logs, reproduce it in isolation, and fix
            it fast.
          </p>
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <span>April 15, 2026</span>
            <span>11 min read</span>
            <span>ToolRoute Team</span>
          </div>
        </header>

        <div className="prose-custom space-y-8 text-sm leading-relaxed">
          <p>
            Your agent stops mid-workflow. The UI says &quot;tool call
            failed.&quot; The tool looks fine when you test it by hand. You
            restart, the error goes away for an hour, and then it comes
            back. If this sounds familiar, you have an MCP tool call bug.
          </p>
          <p>
            The Model Context Protocol standardized how agents discover and
            invoke tools, but it did not standardize how tools fail.
            Underneath the JSON-RPC envelope, an MCP tool call is still a
            network request against a third-party service that can time out,
            rate-limit you, return malformed data, or silently change its
            contract. This guide covers the nine failure modes we see most
            often across 51 adapters at ToolRoute, how to reproduce each one
            deterministically, and the exact fix for each.
          </p>

          <h2 className="text-xl font-bold pt-4">
            Step 1: Get a Trace Before You Guess
          </h2>
          <p>
            Ninety percent of MCP debugging wastes time because engineers
            guess at the cause before capturing a trace. A good trace has
            four fields:
          </p>
          <ul className="space-y-1.5 text-text-dim pl-4">
            <li>
              <strong className="text-text">Request:</strong> the exact JSON
              payload the agent sent, including tool name, operation, and
              input.
            </li>
            <li>
              <strong className="text-text">Upstream status:</strong> the HTTP
              status code, headers, and raw body returned by the underlying
              service.
            </li>
            <li>
              <strong className="text-text">Elapsed time:</strong> total
              wall-clock time from agent call to response, broken into adapter
              overhead and upstream latency.
            </li>
            <li>
              <strong className="text-text">Run ID:</strong> a correlation
              identifier so you can tie the agent&apos;s log line to the
              adapter log line.
            </li>
          </ul>
          <p>
            If your stack cannot emit all four, add them before you do
            anything else. Most of the time the bug reveals itself the moment
            you can see the raw upstream response.
          </p>

          <h2 className="text-xl font-bold pt-4">
            The 9 Failure Modes of MCP Tool Calls
          </h2>

          <h3 className="text-base font-semibold pt-2">
            1. Tool Not Found (Schema Drift)
          </h3>
          <p>
            The agent tries to call{" "}
            <code className="bg-bg-card px-1.5 py-0.5 rounded text-accent text-xs">
              tavily.search
            </code>
            , but the server only exposes{" "}
            <code className="bg-bg-card px-1.5 py-0.5 rounded text-accent text-xs">
              tavily_search
            </code>
            . This happens when the tool schema changed after the agent&apos;s
            system prompt was written. The fix: pull the live tool catalog at
            the start of every session instead of hard-coding names.
          </p>

          <h3 className="text-base font-semibold pt-2">
            2. Invalid Input (Parameter Validation)
          </h3>
          <p>
            The agent sends{" "}
            <code className="bg-bg-card px-1.5 py-0.5 rounded text-accent text-xs">
              {`{"query": 123}`}
            </code>{" "}
            to a tool that expects a string. MCP servers usually return a
            validation error with the offending field. If your tool does not,
            add Zod or Pydantic validation at the adapter boundary and return
            a structured error. Agents recover from structured errors 3-4x
            better than from free-form strings.
          </p>

          <h3 className="text-base font-semibold pt-2">
            3. Auth Expired or Scoped Incorrectly
          </h3>
          <p>
            OAuth tokens expire. API keys get rotated. Long-running agents
            hit this the hardest because their auth state drifts from the
            production reality. Two symptoms: HTTP 401 from the upstream, or
            HTTP 200 with an auth-error envelope. Fix with explicit token
            refresh before calls, or delegate to a platform like{" "}
            <Link
              href="/blog/oauth-for-ai-agents-composio-vs-manual"
              className="text-accent hover:underline"
            >
              Composio for OAuth
            </Link>
            . Also verify the token scope matches the operation: a read-only
            GitHub token will fail on{" "}
            <code className="bg-bg-card px-1.5 py-0.5 rounded text-xs">
              create_issue
            </code>{" "}
            without looking expired.
          </p>

          <h3 className="text-base font-semibold pt-2">
            4. Rate Limit or Quota Exhausted
          </h3>
          <p>
            HTTP 429 is the honest version. The silent version is HTTP 200
            with an empty result array because you hit a soft cap. Log the{" "}
            <code className="bg-bg-card px-1.5 py-0.5 rounded text-xs">
              X-RateLimit-Remaining
            </code>{" "}
            header from every response, and set alerts when remaining drops
            below 10 percent of limit. Back off exponentially with jitter;
            fixed retry intervals make the problem worse. This pattern is
            covered in depth in our{" "}
            <Link
              href="/blog/how-ai-agents-handle-tool-failures"
              className="text-accent hover:underline"
            >
              reliability patterns guide
            </Link>
            .
          </p>

          <h3 className="text-base font-semibold pt-2">
            5. Timeout (Request or Stream)
          </h3>
          <p>
            Two kinds of timeouts. The request timeout fires when the full
            response takes too long. The stream timeout fires when the tool
            stops sending bytes for some window. If the agent logs a timeout
            but the upstream logs a 200, the bottleneck is almost always your
            adapter&apos;s inactivity window. Default 10s request timeouts
            are wrong for search APIs like Tavily (median 1.1s, p99 18s) and
            video APIs like Creatify (30-90s is normal).
          </p>

          <h3 className="text-base font-semibold pt-2">
            6. Empty Response That Looks Wrong
          </h3>
          <p>
            The tool returns 200 OK and a well-formed envelope with zero
            results. The agent, reading the empty array, hallucinates or
            refuses to proceed. This is not a tool bug; it is a prompt bug.
            Either the query was wrong (misspelled brand, unsupported
            region), or the agent needs explicit &quot;what to do when empty&quot;
            guidance in its system prompt. Compare to the{" "}
            <Link
              href="/blog/tavily-vs-firecrawl-vs-brave-search"
              className="text-accent hover:underline"
            >
              search tool benchmarks
            </Link>{" "}
            to see expected result counts for common queries.
          </p>

          <h3 className="text-base font-semibold pt-2">
            7. Malformed Response (Contract Drift)
          </h3>
          <p>
            The tool added a field, removed a field, or changed a type.
            Your parser chokes. This is why every MCP adapter should parse
            with a tolerant schema (extra fields ignored, missing fields
            defaulted) and log a warning on unknown fields so you find
            contract drift before it becomes an outage.
          </p>

          <h3 className="text-base font-semibold pt-2">
            8. Transport Layer Failure (stdio or HTTP)
          </h3>
          <p>
            MCP supports stdio and Streamable HTTP transports. Stdio breaks
            in two fun ways: the subprocess dies silently (check exit code),
            or a stray stdout print corrupts the JSON-RPC frame (redirect
            all tool logs to stderr). HTTP breaks in the usual DNS, TLS, and
            proxy ways. If you cannot tell which transport layer is failing,
            dump raw bytes at the adapter boundary.
          </p>

          <h3 className="text-base font-semibold pt-2">
            9. Agent-Side Tool Selection Error
          </h3>
          <p>
            Sometimes the tool is fine and the agent chose the wrong one.
            The agent calls{" "}
            <code className="bg-bg-card px-1.5 py-0.5 rounded text-xs">
              firecrawl.scrape
            </code>{" "}
            on a JavaScript-rendered page that needs{" "}
            <code className="bg-bg-card px-1.5 py-0.5 rounded text-xs">
              playwright.navigate
            </code>
            , or uses web search when it should have hit a known API. Fix
            this in the tool descriptions, not the tool code. Descriptions
            should include &quot;use this when&quot; and &quot;do not use
            this when&quot; guardrails.
          </p>

          <h2 className="text-xl font-bold pt-4">
            Failure-Mode Lookup Table
          </h2>
          <div className="bg-bg-card border border-border rounded-lg p-6 my-6">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-muted border-b border-border">
                  <th className="text-left pb-2 pr-4">Symptom</th>
                  <th className="text-left pb-2 pr-4">Likely Cause</th>
                  <th className="text-left pb-2">First Fix</th>
                </tr>
              </thead>
              <tbody className="text-text-dim">
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">HTTP 404 or unknown tool</td>
                  <td className="py-2 pr-4">Schema drift</td>
                  <td className="py-2">Refresh tool catalog on session start</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">HTTP 400 with field name</td>
                  <td className="py-2 pr-4">Input validation</td>
                  <td className="py-2">Log request payload, add Zod at boundary</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">HTTP 401 or 403</td>
                  <td className="py-2 pr-4">Auth expired or wrong scope</td>
                  <td className="py-2">Refresh token, check permission scope</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">HTTP 429 or silent cap</td>
                  <td className="py-2 pr-4">Rate limit</td>
                  <td className="py-2">Log X-RateLimit headers, exponential backoff</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Timeout on agent side</td>
                  <td className="py-2 pr-4">Default timeout too aggressive</td>
                  <td className="py-2">Raise timeout to match p99 upstream latency</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Empty response envelope</td>
                  <td className="py-2 pr-4">Prompt or query issue</td>
                  <td className="py-2">Replay query by hand, adjust system prompt</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">JSON parse error</td>
                  <td className="py-2 pr-4">Contract drift</td>
                  <td className="py-2">Tolerant parser, alert on unknown fields</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Connection closed unexpectedly</td>
                  <td className="py-2 pr-4">Transport failure</td>
                  <td className="py-2">Log raw bytes, check subprocess exit code</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Wrong tool chosen</td>
                  <td className="py-2 pr-4">Weak tool description</td>
                  <td className="py-2">Add use/do-not-use guardrails in schema</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 className="text-xl font-bold pt-4">
            Step 2: Reproduce Without the Agent
          </h2>
          <p>
            Once you have a trace, strip the agent out of the loop. Take the
            raw request payload and replay it directly against the MCP
            endpoint with curl:
          </p>
          <pre className="bg-bg-card border border-border rounded-lg p-4 overflow-x-auto text-xs">
{`curl -X POST https://api.toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer $TOOLROUTE_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"tool":"tavily","operation":"search","input":{"query":"MCP debugging"}}'`}
          </pre>
          <p>
            If the curl call succeeds and the agent call fails, the bug is
            in prompt interpretation, tool selection, or input construction
            on the agent side. If the curl call fails with the same error,
            the bug is below the agent and you can keep stripping layers.
          </p>

          <h2 className="text-xl font-bold pt-4">
            Step 3: Turn Verbose Logs On (the Right Ones)
          </h2>
          <p>
            Every MCP client has a way to dump the JSON-RPC frames. These
            are the knobs worth knowing:
          </p>
          <ul className="space-y-1.5 text-text-dim pl-4">
            <li>
              <strong className="text-text">Claude Desktop:</strong> logs at{" "}
              <code className="bg-bg-card px-1.5 py-0.5 rounded text-xs">
                ~/Library/Logs/Claude/mcp*.log
              </code>{" "}
              (macOS) or{" "}
              <code className="bg-bg-card px-1.5 py-0.5 rounded text-xs">
                %APPDATA%/Claude/logs
              </code>{" "}
              (Windows). Set{" "}
              <code className="bg-bg-card px-1.5 py-0.5 rounded text-xs">
                MCP_LOG_LEVEL=debug
              </code>{" "}
              on the server process.
            </li>
            <li>
              <strong className="text-text">Claude Code:</strong>{" "}
              <code className="bg-bg-card px-1.5 py-0.5 rounded text-xs">
                CLAUDE_MCP_DEBUG=1
              </code>{" "}
              emits structured logs per call.
            </li>
            <li>
              <strong className="text-text">Cursor:</strong> open Developer
              Tools, filter console by &quot;MCP&quot;. Tool startup errors
              show in Output &rarr; MCP.
            </li>
            <li>
              <strong className="text-text">OpenAI Agents SDK:</strong> set{" "}
              <code className="bg-bg-card px-1.5 py-0.5 rounded text-xs">
                OPENAI_LOG=debug
              </code>{" "}
              to see raw function call payloads.
            </li>
          </ul>
          <p>
            The related walkthroughs on{" "}
            <Link
              href="/blog/claude-code-mcp-server-setup"
              className="text-accent hover:underline"
            >
              Claude Code MCP setup
            </Link>{" "}
            and{" "}
            <Link
              href="/blog/cursor-mcp-server-setup"
              className="text-accent hover:underline"
            >
              Cursor MCP setup
            </Link>{" "}
            cover log locations and auth for each client in more detail.
          </p>

          <h2 className="text-xl font-bold pt-4">
            Step 4: Observability That Pays for Itself
          </h2>
          <p>
            Debugging is faster when every call already has a trace. Three
            pieces of instrumentation pay for themselves within a week:
          </p>
          <ol className="space-y-1.5 text-text-dim pl-4 list-decimal">
            <li>
              <strong className="text-text">Per-tool latency histograms</strong>{" "}
              with p50, p95, p99 so you know what &quot;normal&quot; looks
              like. Sentry, Datadog, or PostHog all do this well;{" "}
              <Link
                href="/blog/sentry-vs-datadog-vs-posthog"
                className="text-accent hover:underline"
              >
                compare them here
              </Link>
              .
            </li>
            <li>
              <strong className="text-text">Error rate alerts</strong> per
              tool, per operation. A 2 percent error rate on a fallback tool
              is fine; a 2 percent rate on your payments tool is an
              incident.
            </li>
            <li>
              <strong className="text-text">Run-level traces</strong> that
              link agent reasoning to tool calls. If you can click a failed
              agent run and see the exact tool payload, your median debug
              time drops by 5-10x.
            </li>
          </ol>

          <h2 className="text-xl font-bold pt-4">
            Why Gateways Make Debugging Easier
          </h2>
          <p>
            Every failure mode above has one thing in common: you cannot
            debug it without structured data. Running 51 direct MCP
            integrations means 51 log formats, 51 error shapes, 51 timeout
            defaults. That is the hidden cost of doing it yourself.
          </p>
          <p>
            A gateway normalizes this. At ToolRoute, every tool call emits
            the same five fields: run ID, tool, operation, upstream status,
            elapsed time. Errors follow one schema regardless of whether the
            underlying tool is Tavily, Resend, or Stripe. The{" "}
            <Link href="/docs" className="text-accent hover:underline">
              docs
            </Link>{" "}
            cover trace headers and the logs endpoint, and the{" "}
            <Link href="/tools" className="text-accent hover:underline">
              tools directory
            </Link>{" "}
            lists every adapter with its expected latency envelope and
            known failure modes. The{" "}
            <Link
              href="/blog/what-is-an-mcp-gateway"
              className="text-accent hover:underline"
            >
              MCP gateway primer
            </Link>{" "}
            explains why this matters architecturally.
          </p>

          <h2 className="text-xl font-bold pt-4">
            A Debugging Checklist You Can Steal
          </h2>
          <ol className="space-y-1.5 text-text-dim pl-4 list-decimal">
            <li>Capture request, upstream status, elapsed time, run ID.</li>
            <li>Replay the exact payload with curl. Does it still fail?</li>
            <li>
              If curl works, look at agent prompts and tool selection.
            </li>
            <li>If curl fails, read the raw upstream body for an error hint.</li>
            <li>Check auth expiry and scope first, rate limits second.</li>
            <li>
              Compare latency to the tool&apos;s historical p99. If spiked,
              suspect upstream.
            </li>
            <li>If empty response, replay the query manually in the tool UI.</li>
            <li>If contract drift, read the provider changelog.</li>
            <li>Ship a structured error and a regression test with the fix.</li>
          </ol>
          <p>
            Print this, pin it to your wall, save yourself the next outage.
            Most MCP bugs are one of these nine, and working the list in
            order beats guessing every time.
          </p>

          <h2 className="text-xl font-bold pt-4">Frequently Asked Questions</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-sm">
                Why is my MCP tool call returning an empty response?
              </h3>
              <p className="text-text-dim mt-1">
                Usually one of three things: the tool returned 200 OK with a
                success envelope but zero results (most common), the adapter
                silently swallowed an error and returned null, or the agent
                timed out before the response arrived. Check the upstream
                HTTP status, the adapter log, and the total elapsed time
                before assuming the tool is broken.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                How do I enable verbose logging for MCP?
              </h3>
              <p className="text-text-dim mt-1">
                Most MCP servers respect{" "}
                <code className="bg-bg-card px-1.5 py-0.5 rounded text-xs">
                  MCP_LOG_LEVEL=debug
                </code>
                . For Claude Desktop, check{" "}
                <code className="bg-bg-card px-1.5 py-0.5 rounded text-xs">
                  ~/Library/Logs/Claude/mcp*.log
                </code>
                . Claude Code uses{" "}
                <code className="bg-bg-card px-1.5 py-0.5 rounded text-xs">
                  CLAUDE_MCP_DEBUG=1
                </code>
                . Cursor exposes MCP logs in Developer Tools.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                Why does my MCP tool work locally but fail in production?
              </h3>
              <p className="text-text-dim mt-1">
                Four common causes: missing env vars on the production host,
                stricter egress rules in the runtime (Vercel Edge vs Node),
                stdio processes that cannot run on serverless, or auth tokens
                scoped to a local account. Gateways eliminate the last three.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                What is the fastest way to reproduce an MCP failure?
              </h3>
              <p className="text-text-dim mt-1">
                Isolate the tool from the agent. Capture the exact JSON
                payload, then replay it directly against the MCP endpoint
                with curl. If curl fails, the bug is in the tool or adapter.
                If only the agent fails, the bug is in prompt interpretation
                or tool selection.
              </p>
            </div>
          </div>

          <div className="border-t border-border pt-8 mt-8">
            <h3 className="font-semibold text-sm mb-4">Related Articles</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/blog/how-ai-agents-handle-tool-failures"
                  className="text-accent hover:underline"
                >
                  How AI Agents Handle Tool Failures: Reliability Patterns
                </Link>
              </li>
              <li>
                <Link
                  href="/blog/sentry-vs-datadog-vs-posthog"
                  className="text-accent hover:underline"
                >
                  Sentry vs Datadog vs PostHog for AI Applications
                </Link>
              </li>
              <li>
                <Link
                  href="/blog/mcp-server-security-best-practices"
                  className="text-accent hover:underline"
                >
                  MCP Server Security Best Practices
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
              Want structured traces across every tool by default? See the{" "}
              <Link href="/docs" className="text-accent hover:underline">
                ToolRoute docs
              </Link>
              , browse the{" "}
              <Link href="/glossary" className="text-accent hover:underline">
                glossary
              </Link>
              , or check the{" "}
              <Link href="/faq" className="text-accent hover:underline">
                FAQ
              </Link>{" "}
              for platform specifics.
            </p>
          </div>
        </div>
      </article>
    </>
  );
}
