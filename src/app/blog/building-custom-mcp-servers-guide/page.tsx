import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Building Custom MCP Servers: A Complete Guide for 2026",
  description:
    "Build your own MCP server from scratch. Transport, tools, schemas, auth, testing, and deployment. Includes a minimal working TypeScript example.",
  alternates: { canonical: "/blog/building-custom-mcp-servers-guide" },
  openGraph: {
    title: "Building Custom MCP Servers: A Complete Guide",
    description:
      "Transport, tools, schemas, auth, testing, and deployment for custom MCP servers in 2026.",
    url: "https://toolroute.ai/blog/building-custom-mcp-servers-guide",
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
      name: "Do I need to build a custom MCP server?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Only if no existing MCP server covers your capability. Check the official MCP registry, the ToolRoute catalog, and community lists first. Build your own when you need to expose a private internal API, proprietary data, or a workflow composed of multiple operations that no public server handles. Roll-your-own when you have to; integrate when you can.",
      },
    },
    {
      "@type": "Question",
      name: "What language should I use to build an MCP server?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "TypeScript and Python have the most mature SDKs from the MCP team. TypeScript is the default for front-end-adjacent work and Vercel-deployable servers. Python is the default when your data logic already lives in Python. Both handle stdio and Streamable HTTP transports. Use the @modelcontextprotocol/sdk package for TS or the modelcontextprotocol Python package.",
      },
    },
    {
      "@type": "Question",
      name: "Should my MCP server use stdio or Streamable HTTP?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Stdio for local developer tools that run inside an IDE or desktop client. Streamable HTTP for remote production servers that multiple users or agents access over the network. Stdio cannot be shared across users; Streamable HTTP can. If you need both, expose both transports from the same server; the SDK supports that.",
      },
    },
    {
      "@type": "Question",
      name: "How do I test an MCP server without a client?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The MCP Inspector is the official testing tool. Run npx @modelcontextprotocol/inspector against your server and you get a web UI to list tools, call them, and inspect the raw JSON-RPC frames. For automated tests, write unit tests against your tool handlers directly and integration tests against a loopback client using the SDK.",
      },
    },
  ],
};

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Building Custom MCP Servers: A Complete Guide",
  description:
    "Transport, tools, schemas, auth, testing, and deployment for custom MCP servers.",
  datePublished: "2026-04-15T00:00:00Z",
  author: { "@type": "Organization", name: "ToolRoute" },
  publisher: {
    "@type": "Organization",
    name: "ToolRoute",
    url: "https://toolroute.ai",
  },
  mainEntityOfPage:
    "https://toolroute.ai/blog/building-custom-mcp-servers-guide",
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
          <p className="text-accent text-xs font-medium mb-4">Tutorial</p>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">
            Building Custom MCP Servers: A Complete Guide for 2026
          </h1>
          <p className="text-text-dim text-sm leading-relaxed mb-4">
            A production-oriented walkthrough for building your own MCP
            server. Transport, tools, schemas, auth, testing, deployment, and
            the mistakes worth skipping.
          </p>
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <span>April 15, 2026</span>
            <span>13 min read</span>
            <span>ToolRoute Team</span>
          </div>
        </header>

        <div className="prose-custom space-y-8 text-sm leading-relaxed">
          <p>
            The Model Context Protocol is the universal socket for AI
            agents. Any tool that speaks MCP can be called by Claude,
            Cursor, Claude Code, OpenAI Agents SDK, and every other
            framework that has added MCP support. Building an MCP server is
            how you expose your own capability to all of them at once.
          </p>
          <p>
            This guide is the opinionated version of the official docs. It
            assumes you want to ship a server to real users rather than
            just experiment, so it covers the operational questions you
            will hit in production: auth, versioning, testing, and
            deployment. The code samples are TypeScript; Python looks
            nearly identical. For what MCP actually is, start with the{" "}
            <Link
              href="/blog/what-is-model-context-protocol"
              className="text-accent hover:underline"
            >
              protocol primer
            </Link>
            .
          </p>

          <h2 className="text-xl font-bold pt-4">
            Decide Whether to Build at All
          </h2>
          <p>
            Before writing code, check if someone already solved your
            problem. A good heuristic: search three places in this order.
            The{" "}
            <Link
              href="https://registry.modelcontextprotocol.io/"
              className="text-accent hover:underline"
              target="_blank"
              rel="noopener"
            >
              official MCP Registry
            </Link>
            , the{" "}
            <Link href="/tools" className="text-accent hover:underline">
              ToolRoute catalog
            </Link>
            , and community lists like PulseMCP. If an existing server
            covers 80 percent of what you need, fork or extend it. You
            should build your own when:
          </p>
          <ul className="space-y-1.5 text-text-dim pl-4">
            <li>You are exposing a private internal API.</li>
            <li>Your capability is proprietary and cannot be shared.</li>
            <li>
              You need a composition of operations no public server handles.
            </li>
            <li>
              You need specific latency or reliability guarantees no public
              server meets.
            </li>
          </ul>
          <p>
            If none of those apply, integrate an existing server. A custom
            server is ongoing maintenance; a public one is somebody
            else&apos;s maintenance.
          </p>

          <h2 className="text-xl font-bold pt-4">
            Choose Your Transport
          </h2>
          <p>
            MCP supports two transports. Pick based on deployment target.
          </p>
          <div className="bg-bg-card border border-border rounded-lg p-6 my-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-2 text-accent">
                  stdio
                </h3>
                <ul className="space-y-1.5 text-text-dim text-xs">
                  <li>Runs as a local subprocess of the client</li>
                  <li>Zero network exposure, single-user</li>
                  <li>Ideal for IDE plugins and desktop tools</li>
                  <li>
                    Config: Claude Desktop, Cursor, Claude Code all support
                    stdio commands
                  </li>
                  <li>Limitation: cannot be shared across users</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2 text-accent">
                  Streamable HTTP
                </h3>
                <ul className="space-y-1.5 text-text-dim text-xs">
                  <li>Runs as a normal HTTP server</li>
                  <li>Multi-user, authenticatable, observable</li>
                  <li>Ideal for production SaaS and shared tools</li>
                  <li>Config: any client that supports remote MCP URLs</li>
                  <li>Requires auth, rate limiting, observability</li>
                </ul>
              </div>
            </div>
          </div>
          <p>
            You can expose both from the same codebase. The SDK separates
            transport from logic, which means a well-written server can run
            locally for dev and remotely for prod without forking.
          </p>

          <h2 className="text-xl font-bold pt-4">
            A Minimal Working Server
          </h2>
          <p>
            Here is the smallest TypeScript server that does real work.
            Copy this, replace the tool body with yours, and you have a
            working MCP server.
          </p>
          <pre className="bg-bg-card border border-border rounded-lg p-4 overflow-x-auto text-xs">
{`import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "my-weather-server",
  version: "0.1.0",
});

server.tool(
  "get_forecast",
  "Returns a 3-day forecast for a city",
  {
    city: z.string().describe("City name, e.g. 'Austin'"),
    units: z.enum(["metric", "imperial"]).default("metric"),
  },
  async ({ city, units }) => {
    const res = await fetch(
      \`https://api.weather.example/v1/forecast?city=\${city}&units=\${units}\`
    );
    if (!res.ok) {
      return {
        content: [{ type: "text", text: \`Upstream error: \${res.status}\` }],
        isError: true,
      };
    }
    const data = await res.json();
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);`}
          </pre>
          <p>
            Three things worth noticing. First, the Zod schema is the
            source of truth for both validation and the agent-facing tool
            description. Second, errors are explicit: return{" "}
            <code className="bg-bg-card px-1.5 py-0.5 rounded text-xs">
              isError: true
            </code>{" "}
            with a message the agent can reason about. Third, the transport
            is a separate object, so swapping stdio for Streamable HTTP is a
            one-line change.
          </p>

          <h2 className="text-xl font-bold pt-4">
            Tool Schema Design: The Part That Matters Most
          </h2>
          <p>
            An agent&apos;s ability to use your tool correctly is
            proportional to how well your schema is written. A weak
            description gets your tool called at the wrong moments; a
            strong description keeps the agent on-task.
          </p>
          <p>
            Three rules we enforce on every adapter at ToolRoute:
          </p>
          <ol className="space-y-1.5 text-text-dim pl-4 list-decimal">
            <li>
              <strong className="text-text">Describe the what, when, and
              when-not.</strong> A tool called &quot;get_forecast&quot; should
              say &quot;Use for future weather lookups. Do not use for
              historical or real-time current conditions.&quot; Agents use
              negative examples as much as positive ones.
            </li>
            <li>
              <strong className="text-text">Include expected output
              shape.</strong> &quot;Returns JSON with fields{" "}
              <code className="bg-bg-card px-1.5 py-0.5 rounded text-xs">
                days[].high
              </code>
              ,{" "}
              <code className="bg-bg-card px-1.5 py-0.5 rounded text-xs">
                days[].low
              </code>
              ,{" "}
              <code className="bg-bg-card px-1.5 py-0.5 rounded text-xs">
                days[].summary
              </code>
              .&quot; Agents plan better when they know the shape.
            </li>
            <li>
              <strong className="text-text">Give each parameter a
              description and an example.</strong> &quot;city: City
              name, e.g. Austin.&quot; The example alone reduces input
              validation errors by a large margin.
            </li>
          </ol>
          <p>
            For more on how tool selection works from the agent side, see{" "}
            <Link
              href="/blog/how-to-choose-mcp-tool-ai-agent"
              className="text-accent hover:underline"
            >
              choosing the right MCP tool
            </Link>{" "}
            and{" "}
            <Link
              href="/blog/build-ai-agent-multiple-tools"
              className="text-accent hover:underline"
            >
              building agents with multiple tools
            </Link>
            .
          </p>

          <h2 className="text-xl font-bold pt-4">
            Authentication: Stdio vs HTTP
          </h2>
          <p>
            Stdio servers inherit the caller&apos;s trust. The user has
            already authenticated to the IDE; the server runs in their
            process space; credentials usually come from environment
            variables the user sets locally.
          </p>
          <p>
            Streamable HTTP servers need real auth. Two patterns work:
          </p>
          <ul className="space-y-1.5 text-text-dim pl-4">
            <li>
              <strong className="text-text">Bearer API keys</strong> over
              TLS. Simplest. Good for server-to-server. Rotate on a
              schedule. This is what most MCP gateways use.
            </li>
            <li>
              <strong className="text-text">OAuth 2.1 with PKCE</strong>.
              Required if your tool acts on behalf of an end user (e.g., a
              user&apos;s Gmail or Notion). The MCP spec includes an
              authorization flow; the community has battle-tested patterns
              in{" "}
              <Link
                href="/blog/oauth-for-ai-agents-composio-vs-manual"
                className="text-accent hover:underline"
              >
                Composio vs manual OAuth
              </Link>
              .
            </li>
          </ul>
          <p>
            Whatever you choose, log auth failures separately from other
            failures. 401s look like transient errors to agents unless you
            surface them explicitly, and agents will retry until the rate
            limit hammer falls.
          </p>

          <h2 className="text-xl font-bold pt-4">
            Versioning Your Tools
          </h2>
          <p>
            MCP servers are contracts. Clients cache tool schemas. If you
            change a parameter name, remove a field from a response, or
            change a type, you can break live agents.
          </p>
          <p>
            Three rules for safe evolution:
          </p>
          <ol className="space-y-1.5 text-text-dim pl-4 list-decimal">
            <li>
              <strong className="text-text">Additive changes only</strong>{" "}
              on a published tool. Add new optional parameters, add new
              fields, add new tools.
            </li>
            <li>
              <strong className="text-text">Version in the tool
              name</strong> for breaking changes:{" "}
              <code className="bg-bg-card px-1.5 py-0.5 rounded text-xs">
                get_forecast_v2
              </code>
              . Keep the old one alive for a deprecation window.
            </li>
            <li>
              <strong className="text-text">Document deprecations</strong>{" "}
              in the tool description: &quot;Deprecated. Use get_forecast_v2
              for unit-configurable output.&quot;
            </li>
          </ol>

          <h2 className="text-xl font-bold pt-4">
            Error Handling Agents Can Actually Use
          </h2>
          <p>
            The agent reading your error message is a language model. It
            responds to structure, not stack traces. Return errors with a
            stable shape:
          </p>
          <pre className="bg-bg-card border border-border rounded-lg p-4 overflow-x-auto text-xs">
{`{
  "content": [{
    "type": "text",
    "text": "Validation failed: 'city' must be a non-empty string"
  }],
  "isError": true
}`}
          </pre>
          <p>
            Prefer error messages that tell the agent what to do next:
            &quot;City not found. Try a valid city name or country code.&quot;
            vs &quot;ERROR 404.&quot; The first recovers; the second
            loops. The same principle underlies the{" "}
            <Link
              href="/blog/how-ai-agents-handle-tool-failures"
              className="text-accent hover:underline"
            >
              reliability patterns
            </Link>{" "}
            every production agent needs.
          </p>

          <h2 className="text-xl font-bold pt-4">
            Testing Your MCP Server
          </h2>
          <p>
            Three testing layers, in order of value.
          </p>
          <ol className="space-y-1.5 text-text-dim pl-4 list-decimal">
            <li>
              <strong className="text-text">Unit tests on tool
              handlers.</strong> Call the handler function directly with
              fixtures. Test validation, happy paths, and upstream error
              paths. Fast, deterministic, catches regressions.
            </li>
            <li>
              <strong className="text-text">Integration tests via MCP
              Inspector.</strong> Run{" "}
              <code className="bg-bg-card px-1.5 py-0.5 rounded text-xs">
                npx @modelcontextprotocol/inspector
              </code>{" "}
              against your server in CI. The Inspector gives you a UI for
              listing tools, calling them, and inspecting raw frames. It
              also catches schema problems that unit tests miss.
            </li>
            <li>
              <strong className="text-text">Live agent smoke tests.</strong>{" "}
              A handful of scripted prompts that exercise each tool
              end-to-end with a real client (Claude Desktop, Claude Code,
              or OpenAI Agents). Runs once before every release; catches
              &quot;tool description is unclear&quot; bugs that unit tests
              cannot.
            </li>
          </ol>

          <h2 className="text-xl font-bold pt-4">
            Deployment Patterns
          </h2>
          <p>
            Where you deploy depends on transport and scale.
          </p>
          <ul className="space-y-1.5 text-text-dim pl-4">
            <li>
              <strong className="text-text">Stdio servers:</strong> publish
              as npm or PyPI packages. Users install and configure their
              client. Zero infrastructure on your side.
            </li>
            <li>
              <strong className="text-text">HTTP servers on Vercel or
              Fly:</strong> works for stateless tools. Cold starts can hurt
              latency-sensitive workflows.
            </li>
            <li>
              <strong className="text-text">HTTP servers on long-running
              infra (Fly VMs, ECS, Railway):</strong> required for stateful
              servers or streaming workloads.
            </li>
            <li>
              <strong className="text-text">Behind a gateway:</strong> if
              your tool is one of many, put it behind an MCP gateway so
              agents hit one auth surface, one billing flow, one trace
              format. This is what{" "}
              <Link href="/tools" className="text-accent hover:underline">
                ToolRoute
              </Link>{" "}
              does for 51 adapters.
            </li>
          </ul>

          <h2 className="text-xl font-bold pt-4">
            Observability Day One, Not Day 90
          </h2>
          <p>
            Every MCP server needs three signals from day one.
          </p>
          <ol className="space-y-1.5 text-text-dim pl-4 list-decimal">
            <li>
              <strong className="text-text">Per-tool latency
              histograms</strong> (p50, p95, p99). You cannot set an
              agent-side timeout without knowing your p99.
            </li>
            <li>
              <strong className="text-text">Per-tool error rate</strong>{" "}
              broken down by error type (validation, upstream, auth,
              timeout). 1 percent validation errors is fine; 1 percent
              upstream errors is an incident.
            </li>
            <li>
              <strong className="text-text">Tool-call traces</strong> that
              include the input, the upstream call, and the final response.
              Without this, debugging is guesswork. Covered in depth in{" "}
              <Link
                href="/blog/how-to-debug-mcp-tool-calls"
                className="text-accent hover:underline"
              >
                how to debug MCP tool calls
              </Link>
              .
            </li>
          </ol>

          <h2 className="text-xl font-bold pt-4">
            Mistakes Worth Skipping
          </h2>
          <ul className="space-y-1.5 text-text-dim pl-4">
            <li>
              <strong className="text-text">Printing to stdout in stdio
              servers.</strong> A single stray{" "}
              <code className="bg-bg-card px-1.5 py-0.5 rounded text-xs">
                console.log
              </code>{" "}
              corrupts the JSON-RPC frame and breaks the whole session. Log
              to stderr only.
            </li>
            <li>
              <strong className="text-text">Overly generic tool
              names.</strong>{" "}
              <code className="bg-bg-card px-1.5 py-0.5 rounded text-xs">
                search
              </code>{" "}
              is ambiguous;{" "}
              <code className="bg-bg-card px-1.5 py-0.5 rounded text-xs">
                search_internal_wiki
              </code>{" "}
              is specific. Names are how agents decide which tool to call.
            </li>
            <li>
              <strong className="text-text">Returning raw HTML or XML.</strong>{" "}
              Agents work best with structured JSON or readable markdown.
              Transform before returning.
            </li>
            <li>
              <strong className="text-text">Missing rate limits.</strong> A
              misbehaving agent can DOS your upstream if you do not cap
              calls per key per minute.
            </li>
            <li>
              <strong className="text-text">Not reviewing security.</strong>{" "}
              Every remote MCP server should be reviewed against the
              checklist in{" "}
              <Link
                href="/blog/mcp-server-security-best-practices"
                className="text-accent hover:underline"
              >
                MCP server security best practices
              </Link>
              .
            </li>
          </ul>

          <h2 className="text-xl font-bold pt-4">
            When to Self-Host vs Put It on a Gateway
          </h2>
          <p>
            You built an MCP server. Should you run it yourself or hand it
            to a gateway? A rough decision table:
          </p>
          <div className="bg-bg-card border border-border rounded-lg p-6 my-6">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-muted border-b border-border">
                  <th className="text-left pb-2 pr-4">Scenario</th>
                  <th className="text-left pb-2 pr-4">Self-Host</th>
                  <th className="text-left pb-2">Gateway</th>
                </tr>
              </thead>
              <tbody className="text-text-dim">
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Internal-only, single tenant</td>
                  <td className="py-2 pr-4 text-green">Fine</td>
                  <td className="py-2">Overkill</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">One tool, internal team</td>
                  <td className="py-2 pr-4 text-green">Fine</td>
                  <td className="py-2">Optional</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">5+ tools, mixed users</td>
                  <td className="py-2 pr-4">Painful</td>
                  <td className="py-2 text-green">Recommended</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Need unified billing</td>
                  <td className="py-2 pr-4">Build yourself</td>
                  <td className="py-2 text-green">Included</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Multi-tenant SaaS</td>
                  <td className="py-2 pr-4">High burden</td>
                  <td className="py-2 text-green">Recommended</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            The decision is not religious. Ship the server. If it grows,
            move it behind a gateway when the operational load justifies
            it. The{" "}
            <Link
              href="/blog/self-hosted-vs-cloud-mcp-servers"
              className="text-accent hover:underline"
            >
              self-hosted vs cloud MCP comparison
            </Link>{" "}
            covers the trade-offs in more depth.
          </p>

          <h2 className="text-xl font-bold pt-4">Frequently Asked Questions</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-sm">
                Do I need to build a custom MCP server?
              </h3>
              <p className="text-text-dim mt-1">
                Only if no existing MCP server covers your capability.
                Check the official MCP registry, the ToolRoute catalog, and
                community lists first. Build when you need to expose a
                private internal API, proprietary data, or a workflow no
                public server handles.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                What language should I use?
              </h3>
              <p className="text-text-dim mt-1">
                TypeScript and Python have the most mature SDKs. Use
                TypeScript for front-end-adjacent and Vercel-deployable
                servers, Python when your data logic already lives in
                Python. Both handle stdio and Streamable HTTP.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                Stdio or Streamable HTTP?
              </h3>
              <p className="text-text-dim mt-1">
                Stdio for local developer tools inside an IDE. Streamable
                HTTP for remote servers that multiple users access over the
                network. You can expose both transports from the same
                server.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                How do I test without a client?
              </h3>
              <p className="text-text-dim mt-1">
                Use the MCP Inspector:{" "}
                <code className="bg-bg-card px-1.5 py-0.5 rounded text-xs">
                  npx @modelcontextprotocol/inspector
                </code>
                . For automated tests, unit-test your tool handlers and
                integration-test a loopback client using the SDK.
              </p>
            </div>
          </div>

          <div className="border-t border-border pt-8 mt-8">
            <h3 className="font-semibold text-sm mb-4">Related Articles</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/blog/what-is-model-context-protocol"
                  className="text-accent hover:underline"
                >
                  What Is the Model Context Protocol?
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
                  href="/blog/self-hosted-vs-cloud-mcp-servers"
                  className="text-accent hover:underline"
                >
                  Self-Hosted vs Cloud MCP Servers
                </Link>
              </li>
              <li>
                <Link
                  href="/blog/how-to-debug-mcp-tool-calls"
                  className="text-accent hover:underline"
                >
                  How to Debug MCP Tool Calls
                </Link>
              </li>
            </ul>
          </div>

          <div className="border-t border-border pt-8 mt-8">
            <p className="text-text-dim">
              Ready to ship it? See the{" "}
              <Link href="/docs" className="text-accent hover:underline">
                ToolRoute docs
              </Link>{" "}
              for gateway integration, browse the{" "}
              <Link href="/tools" className="text-accent hover:underline">
                tool catalog
              </Link>{" "}
              for inspiration, or check the{" "}
              <Link href="/glossary" className="text-accent hover:underline">
                glossary
              </Link>{" "}
              and{" "}
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
