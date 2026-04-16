import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "The Check-Before-Build MCP Tool Pattern: How Agents Stop Reimplementing Free Capabilities",
  description:
    "The most expensive line of code reimplements something free. Before an AI agent writes a new tool, it should query a capability registry. Here is the pattern, the RPC, and the belief system that makes it work.",
  alternates: { canonical: "/blog/check-before-build-mcp-tool-pattern" },
  openGraph: {
    title: "The Check-Before-Build MCP Tool Pattern",
    description:
      "Before an AI agent writes a new tool, it should query a capability registry. Here is the pattern, the RPC, and the belief system.",
    url: "https://toolroute.ai/blog/check-before-build-mcp-tool-pattern",
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
      name: "What is the check-before-build pattern for AI agents?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Check-before-build is an agent design pattern: before writing any new tool or capability, the agent queries a capability registry to see if an equivalent tool already exists. If it does, the agent uses it. If not, the agent builds it and registers the new tool so future agents find it. The pattern prevents every agent session from reimplementing the same basic capabilities from scratch.",
      },
    },
    {
      "@type": "Question",
      name: "Why do AI agents reimplement existing tools?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Agents have no default awareness of what tools exist outside their immediate context. When asked to 'send an email', a raw agent writes an SMTP wrapper. When asked to 'search the web', it writes a scraper. This happens because the agent's context window is small, the MCP universe is large, and there is no built-in registry lookup. Check-before-build adds that lookup as a required first step.",
      },
    },
    {
      "@type": "Question",
      name: "How do you implement check-before-build in practice?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Three parts. First, a capability registry (Supabase table or vector DB) that stores tool descriptions, success rates, costs, and last-used timestamps. Second, an RPC (check_before_build) that takes a natural-language capability description and returns ranked matches. Third, a rule in the agent's system prompt: before writing any new capability, call the RPC and evaluate the top result. ToolRoute's open-source implementation uses all three and serves as a reference.",
      },
    },
    {
      "@type": "Question",
      name: "What is a capability registry?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A capability registry is a searchable index of tools, skills, and composites that an agent can call. It differs from an MCP registry (which lists servers) because it indexes individual capabilities at the operation level: 'send email', 'transcribe audio', 'generate invoice'. This granularity is what makes semantic matching work - the agent describes what it needs, not which server to call.",
      },
    },
    {
      "@type": "Question",
      name: "Does check-before-build slow down agent execution?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The lookup itself takes 50-200 ms. The time it saves is 10-60 minutes per avoided reimplementation. On our 87-tool registry, the check returns in under 100 ms and prevents an average of 4-7 reimplementation attempts per agent session. Net speedup is multiple orders of magnitude, not a slowdown.",
      },
    },
  ],
};

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "The Check-Before-Build MCP Tool Pattern: How Agents Stop Reimplementing Free Capabilities",
  description:
    "The most expensive line of code reimplements something free. Before an AI agent writes a new tool, it should query a capability registry.",
  datePublished: "2026-04-15T00:00:00Z",
  author: { "@type": "Organization", name: "ToolRoute" },
  publisher: {
    "@type": "Organization",
    name: "ToolRoute",
    url: "https://toolroute.ai",
  },
  mainEntityOfPage: "https://toolroute.ai/blog/check-before-build-mcp-tool-pattern",
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
            Agent Patterns / Infrastructure
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">
            The Check-Before-Build MCP Tool Pattern: How Agents Stop Reimplementing Free Capabilities
          </h1>
          <p className="text-text-dim text-sm leading-relaxed mb-4">
            The most expensive line of code reimplements something free.
            Before an AI agent writes a new tool, it should query a
            capability registry. Here is the pattern, the RPC, and the
            belief system that makes it work.
          </p>
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <span>April 15, 2026</span>
            <span>10 min read</span>
            <span>ToolRoute Team</span>
          </div>
        </header>

        <div className="prose-custom space-y-8 text-sm leading-relaxed">
          <p>
            Every week we watched AI agents reimplement the same five tools:
            email senders, web scrapers, SMS dispatchers, Stripe charge
            wrappers, and CRON schedulers. Not new code - existing tools in
            our own inventory, reimplemented from scratch because the agent
            did not know they existed.
          </p>
          <p>
            The rule that stopped it is one sentence we paste into every
            agent system prompt: <em>the most expensive line of code
            reimplements something free</em>. The mechanism behind that
            rule is an RPC called <code className="bg-bg-card px-1.5 py-0.5 rounded text-accent text-xs">check_before_build</code>.
            It is the single biggest productivity improvement we have
            shipped to any agent fleet. This article is the full pattern:
            what it is, why it works, and how to build one.
          </p>

          <h2 className="text-xl font-bold pt-4">The Failure Mode This Pattern Prevents</h2>
          <p>
            A typical agent failure looks like this. User says: &quot;Send the
            pricing quote to the client by email.&quot; Agent reasoning:
          </p>
          <ol className="space-y-1.5 text-text-dim pl-4 list-decimal">
            <li>I need to send email.</li>
            <li>I have a Node runtime. I will write an SMTP client.</li>
            <li>Requires a provider. I will add <code>nodemailer</code>.</li>
            <li>Requires credentials. I will prompt the user for SMTP host.</li>
            <li>Requires a sender domain. DKIM. SPF records. Rate limiting.</li>
            <li>...35 minutes later, the email is half working.</li>
          </ol>
          <p>
            Meanwhile, a <code className="bg-bg-card px-1.5 py-0.5 rounded text-accent text-xs">resend</code>
            MCP tool was already registered in our capability registry,
            authenticated, rate-limited, and tested. One call and done.
            The agent did not know. It had no reason to look.
          </p>
          <p>
            Scale this across an 8-session, 17-company fleet and the
            waste compounds. We measured one week and found 47
            reimplementation attempts for tools that already existed,
            costing an estimated 28 agent-hours.
          </p>

          <h2 className="text-xl font-bold pt-4">The Pattern in Three Parts</h2>

          <h3 className="text-base font-semibold pt-2">Part 1: A Capability Registry</h3>
          <p>
            Not an MCP server registry. A <em>capability</em> registry. The
            difference matters:
          </p>
          <div className="bg-bg-card border border-border rounded-lg p-6 my-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-2 text-accent">
                  MCP Registry
                </h3>
                <ul className="space-y-1.5 text-text-dim text-xs">
                  <li>Indexes servers</li>
                  <li>Granularity: one entry per server</li>
                  <li>Example entry: &quot;resend-mcp-server&quot;</li>
                  <li>Answer: what servers exist?</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2 text-accent">
                  Capability Registry
                </h3>
                <ul className="space-y-1.5 text-text-dim text-xs">
                  <li>Indexes operations</li>
                  <li>Granularity: one entry per capability</li>
                  <li>Example entry: &quot;send transactional email&quot;</li>
                  <li>Answer: what can I do?</li>
                </ul>
              </div>
            </div>
          </div>
          <p>
            Each capability entry stores at minimum: a natural language
            description, the tool and operation that provides it, success
            rate, average cost per call, latency, and last-used timestamp.
            Ours lives in a Supabase <code className="bg-bg-card px-1.5 py-0.5 rounded text-accent text-xs">tools</code>
            table with 87 capabilities across 14 categories. Each entry is
            embedded with OpenAI <code className="bg-bg-card px-1.5 py-0.5 rounded text-accent text-xs">text-embedding-3-small</code>
            into a pgvector column for semantic search.
          </p>

          <h3 className="text-base font-semibold pt-2">Part 2: The check_before_build RPC</h3>
          <p>
            An RPC that takes a capability description and returns ranked
            matches. In Supabase pseudocode:
          </p>
          <pre className="bg-bg-card border border-border rounded-lg p-4 overflow-x-auto text-xs">
{`create function check_before_build(
  p_capability text,
  p_max_results int default 5
)
returns table (
  tool_slug text,
  operation text,
  description text,
  similarity float,
  success_rate float,
  avg_cost_credits numeric,
  champion_in_category boolean
)
language sql stable
as $$
  with q_embedding as (
    select openai_embed(p_capability) as emb
  )
  select
    t.slug,
    t.operation,
    t.description,
    1 - (t.embedding <=> (select emb from q_embedding)) as similarity,
    t.success_rate,
    t.avg_cost_credits,
    t.is_category_champion
  from tools t
  where t.status = 'active'
  order by t.embedding <=> (select emb from q_embedding)
  limit p_max_results;
$$;`}
          </pre>
          <p>
            Call it with:
          </p>
          <pre className="bg-bg-card border border-border rounded-lg p-4 overflow-x-auto text-xs">
{`select * from check_before_build(
  'send transactional email with tracking'
);

-- Returns:
-- resend | send | "Transactional email API, 99.9% deliverability" | 0.89 | 0.997 | 2 | true
-- sendgrid | mail | "Email API, legacy" | 0.82 | 0.94 | 3 | false
-- mailgun | send | "Email API, rate limit aware" | 0.79 | 0.96 | 2 | false`}
          </pre>
          <p>
            The agent reads the top result, checks similarity threshold
            (we use 0.75), and if above, uses the existing tool. If below,
            the agent has legitimate grounds to build and should register
            the new capability on completion.
          </p>

          <h3 className="text-base font-semibold pt-2">Part 3: The Belief Rule</h3>
          <p>
            The RPC is inert if agents do not call it. The rule that makes
            them call it is one line in the system prompt, written as a
            hard constraint:
          </p>
          <div className="bg-bg-card border border-border rounded-lg p-6 my-6">
            <p className="text-text italic">
              &quot;Check ToolRoute before building. Before building any new
              capability, run <code className="bg-bg-card px-1.5 py-0.5 rounded text-accent text-xs">/toolroute</code>
              or query the ToolRoute MCP (<code className="bg-bg-card px-1.5 py-0.5 rounded text-accent text-xs">check_before_build</code>)
              to see if a tool already exists. The most expensive line of
              code reimplements something free.&quot;
            </p>
          </div>
          <p>
            We tested removing that line. Reimplementation attempts jumped
            4x within the first day. The rule is load-bearing.
          </p>

          <h2 className="text-xl font-bold pt-4">How the Pattern Composes With Other Infrastructure</h2>

          <h3 className="text-base font-semibold pt-2">With an MCP Gateway</h3>
          <p>
            Check-before-build works best when the matched tool is trivially
            callable. If the agent has to set up auth, install SDKs, and
            learn a new API schema, the cost of &quot;use existing&quot; starts
            rivaling the cost of reimplementing. An{" "}
            <Link href="/blog/what-is-an-mcp-gateway" className="text-accent hover:underline">
              MCP gateway
            </Link>{" "}
            flattens the activation cost to one HTTP call with a shared API
            key. That is why we built ToolRoute: the gateway and the
            registry are the same system.
          </p>

          <h3 className="text-base font-semibold pt-2">With Auto-Routing</h3>
          <p>
            The next step beyond check-before-build is{" "}
            <Link href="/blog/mcp-auto-routing-ai-agent-tools" className="text-accent hover:underline">
              auto-routing
            </Link>: instead of returning a ranked list for the agent to
            evaluate, the gateway just picks the best tool and executes.
            Agents describe what they need; the gateway decides how. This
            is safe only once the registry is well-populated and the
            similarity signal is reliable - which is usually after a few
            thousand successful calls with explicit check-before-build.
          </p>

          <h3 className="text-base font-semibold pt-2">With Usage-Based Learning</h3>
          <p>
            Every executed tool call should write back to the registry:
            success or failure, latency, cost, and a short outcome note.
            After a few thousand calls per capability, the registry has
            enough data to rank champions and demote brittle tools.
            Check-before-build then returns the tools that <em>actually
            work</em>, not just the ones that exist.
          </p>

          <h2 className="text-xl font-bold pt-4">The Numbers: Before vs After</h2>
          <div className="bg-bg-card border border-border rounded-lg p-6 my-6">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-muted border-b border-border">
                  <th className="text-left pb-2 pr-4">Metric</th>
                  <th className="text-left pb-2 pr-4">Before (no check)</th>
                  <th className="text-left pb-2">After (check_before_build)</th>
                </tr>
              </thead>
              <tbody className="text-text-dim">
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Reimplementation attempts / week</td>
                  <td className="py-2 pr-4 text-red-400">47</td>
                  <td className="py-2 text-green">3</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Agent-hours wasted / week</td>
                  <td className="py-2 pr-4 text-red-400">~28</td>
                  <td className="py-2 text-green">~2</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Avg task completion</td>
                  <td className="py-2 pr-4">68%</td>
                  <td className="py-2 text-green">91%</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Tools registered</td>
                  <td className="py-2 pr-4">~42 (scattered)</td>
                  <td className="py-2 text-green">87 (catalogued)</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Cost per capability call</td>
                  <td className="py-2 pr-4">Unbounded (fresh build)</td>
                  <td className="py-2 text-green">Known (registered)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 className="text-xl font-bold pt-4">Build Your Own in a Weekend</h2>
          <p>
            The entire pattern is implementable in a few hundred lines. Here
            is the minimum viable version:
          </p>
          <ol className="space-y-1.5 text-text-dim pl-4 list-decimal">
            <li>Supabase table <code className="bg-bg-card px-1.5 py-0.5 rounded text-accent text-xs">tools</code> with columns: slug, operation, description, embedding, success_rate, avg_cost, last_used_at.</li>
            <li>pgvector extension + HNSW index on embedding.</li>
            <li>Seed with 10-20 of your most-used internal capabilities. Generate embeddings with <code>text-embedding-3-small</code>.</li>
            <li>Write the RPC above.</li>
            <li>Expose it as an MCP tool (stdio or HTTP, your choice - see our <Link href="/blog/mcp-stdio-vs-http-hub" className="text-accent hover:underline">transport guide</Link>).</li>
            <li>Add the system-prompt rule: &quot;Before building any new capability, call <code>check_before_build</code> and evaluate the top match.&quot;</li>
            <li>Wire usage-write-back: every executed tool call updates last_used_at and success_rate.</li>
          </ol>
          <p>
            Start with 10 capabilities. Measure reimplementation attempts
            for a week. Add the capabilities that got reimplemented
            anyway. Iterate. Within a month you will have a registry that
            prevents 80%+ of the waste.
          </p>

          <h2 className="text-xl font-bold pt-4">The ToolRoute Reference Implementation</h2>
          <p>
            ToolRoute is our open reference implementation of this pattern.
            It currently catalogs 87 tools across 14 categories with full
            check_before_build support, usage tracking, and category
            champion identification. You can use it directly as an MCP
            gateway, fork the schema for your own registry, or just borrow
            the pattern.
          </p>
          <ul className="space-y-1.5 text-text-dim pl-4 list-disc">
            <li><Link href="/tools" className="text-accent hover:underline">Browse the 87-tool catalog</Link></li>
            <li><Link href="/docs" className="text-accent hover:underline">Read the check_before_build docs</Link></li>
            <li><Link href="/skills" className="text-accent hover:underline">Browse skills (higher-level composites)</Link></li>
            <li><Link href="/glossary" className="text-accent hover:underline">Glossary of registry terms</Link></li>
          </ul>

          <h2 className="text-xl font-bold pt-4">Frequently Asked Questions</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-sm">
                What is the check-before-build pattern for AI agents?
              </h3>
              <p className="text-text-dim mt-1">
                A design pattern where an agent queries a capability
                registry before writing any new tool. If a match exists,
                the agent uses it. If not, the agent builds and registers
                the new tool for future agents to find.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                Why do AI agents reimplement existing tools?
              </h3>
              <p className="text-text-dim mt-1">
                Agents have no default awareness of what exists outside
                their immediate context. The MCP universe is huge, the
                context window is small, and there is no built-in registry
                lookup. Check-before-build adds that lookup as a required
                first step.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                How do you implement check-before-build?
              </h3>
              <p className="text-text-dim mt-1">
                Three parts: a capability registry with embeddings, an RPC
                that does semantic search against it, and a system-prompt
                rule that forces the agent to call the RPC before
                building. ToolRoute is one reference implementation.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                What is a capability registry?
              </h3>
              <p className="text-text-dim mt-1">
                A searchable index of tools, skills, and composites at the
                operation level (&quot;send email&quot;, &quot;transcribe audio&quot;). Different
                from an MCP server registry (which indexes servers).
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                Does check-before-build slow down agent execution?
              </h3>
              <p className="text-text-dim mt-1">
                The lookup takes 50-200 ms. It saves 10-60 minutes per
                avoided reimplementation. Net speedup is orders of
                magnitude, not a slowdown.
              </p>
            </div>
          </div>

          <div className="border-t border-border pt-8 mt-8">
            <h3 className="font-semibold text-sm mb-4">Related Articles</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/blog/what-is-an-mcp-gateway" className="text-accent hover:underline">What Is an MCP Gateway?</Link></li>
              <li><Link href="/blog/mcp-auto-routing-ai-agent-tools" className="text-accent hover:underline">MCP Auto-Routing for AI Agent Tools</Link></li>
              <li><Link href="/blog/mcp-gateway-for-claude-code" className="text-accent hover:underline">MCP Gateway for Claude Code</Link></li>
              <li><Link href="/blog/how-to-choose-mcp-tool-ai-agent" className="text-accent hover:underline">How to Choose the Right MCP Tool</Link></li>
              <li><Link href="/blog/build-ai-agent-multiple-tools" className="text-accent hover:underline">Build an AI Agent With 50+ Tools</Link></li>
              <li><Link href="/glossary" className="text-accent hover:underline">MCP Glossary</Link></li>
            </ul>
          </div>

          <div className="border-t border-border pt-8 mt-8">
            <p className="text-text-dim">
              ToolRoute is the check-before-build reference implementation:
              87 tools, semantic search, usage learning, category
              champions. Free to query, pay only on execution.{" "}
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
