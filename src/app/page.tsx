import { getLibrarianState, getTools } from "@/lib/api";
import type { Tool } from "@/lib/types";
import Link from "next/link";
import {
  Zap,
  ArrowRight,
  Key,
  Search,
  Play,
  Terminal,
  Code2,
  Globe,
  Cpu,
  ChevronRight,
  Sparkles,
} from "lucide-react";

export const revalidate = 60;

export default async function HomePage() {
  let state;
  let featuredTools: Tool[] = [];
  try {
    state = await getLibrarianState();
  } catch {
    state = null;
  }
  try {
    featuredTools = await getTools();
  } catch {
    featuredTools = [];
  }

  const topTools = featuredTools.slice(0, 8);

  return (
    <div className="space-y-24 pb-16">
      {/* Hero */}
      <section className="text-center pt-16 pb-4">
        <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-full px-4 py-1.5 mb-8">
          <Zap className="w-3.5 h-3.5 text-accent" />
          <span className="text-xs text-accent font-medium">
            The OpenRouter for Tools
          </span>
        </div>
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-[1.1]">
          One API key.
          <br />
          <span className="text-accent">Every tool.</span>
        </h1>
        <p className="text-text-dim max-w-2xl mx-auto text-base sm:text-lg leading-relaxed mb-10">
          ToolRoute is the OpenRouter for tools. One unified API to access 70+
          best-in-class tools for AI agents. Most tools work on the shared
          master pool with zero setup; premium providers (Anthropic, OpenAI,
          Stripe, ElevenLabs and others) require BYOK to comply with their
          resale terms — register your own key once, route through it forever.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold px-6 py-3 rounded-lg transition-colors text-sm"
          >
            <Key className="w-4 h-4" />
            Get Your API Key
          </Link>
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 border border-border hover:border-accent/40 text-text px-6 py-3 rounded-lg transition-colors text-sm"
          >
            <Terminal className="w-4 h-4" />
            View Documentation
          </Link>
        </div>

        {/* Code example */}
        <div className="max-w-2xl mx-auto text-left">
          <div className="bg-[#0d0d18] border border-border rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-bg-card/50">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red/40" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber/40" />
                <div className="w-2.5 h-2.5 rounded-full bg-green/40" />
              </div>
              <span className="text-[10px] text-text-muted ml-2">terminal</span>
            </div>
            <pre className="p-4 text-xs sm:text-sm leading-relaxed overflow-x-auto">
              <code>
                <span className="text-green">curl</span>
                <span className="text-text"> https://toolroute.ai/api/v1/execute \</span>
                {"\n"}
                <span className="text-text-dim">  -H </span>
                <span className="text-amber">{'"Authorization: Bearer tr_live_xxx"'}</span>
                <span className="text-text"> \</span>
                {"\n"}
                <span className="text-text-dim">  -d </span>
                <span className="text-accent">{"'"}</span>
                <span className="text-cyan">{'{"tool": "firecrawl/scrape", "input": {"url": "https://example.com"}}'}</span>
                <span className="text-accent">{"'"}</span>
              </code>
            </pre>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section>
        <h2 className="text-2xl font-bold text-center mb-12">How It Works</h2>
        <div className="grid sm:grid-cols-3 gap-6">
          <div className="border border-border rounded-lg p-6 bg-bg-card text-center">
            <div className="w-12 h-12 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-4">
              <Key className="w-5 h-5 text-accent" />
            </div>
            <div className="text-xs text-accent font-mono mb-2">01</div>
            <h3 className="font-semibold text-base mb-2">Get an API key</h3>
            <p className="text-sm text-text-dim leading-relaxed">
              Sign up, get your{" "}
              <code className="text-xs bg-bg-surface px-1.5 py-0.5 rounded text-accent">
                tr_live_xxx
              </code>{" "}
              key in seconds.
            </p>
          </div>
          <div className="border border-border rounded-lg p-6 bg-bg-card text-center">
            <div className="w-12 h-12 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-4">
              <Search className="w-5 h-5 text-accent" />
            </div>
            <div className="text-xs text-accent font-mono mb-2">02</div>
            <h3 className="font-semibold text-base mb-2">Pick a tool</h3>
            <p className="text-sm text-text-dim leading-relaxed">
              Browse 70+ curated tools across 12 categories. Or let us
              pick&mdash;describe your task, we&apos;ll route it.
            </p>
          </div>
          <div className="border border-border rounded-lg p-6 bg-bg-card text-center">
            <div className="w-12 h-12 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-4">
              <Play className="w-5 h-5 text-accent" />
            </div>
            <div className="text-xs text-accent font-mono mb-2">03</div>
            <h3 className="font-semibold text-base mb-2">Execute</h3>
            <p className="text-sm text-text-dim leading-relaxed">
              One API call. We handle auth, routing, billing, and fallbacks.
            </p>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      {state && (
        <section>
          <div className="border border-border rounded-lg bg-bg-card p-6">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-6 text-center">
              <div>
                <p className="text-3xl font-bold text-accent">{state.tool_count}</p>
                <p className="text-xs text-text-muted mt-1 uppercase tracking-wider">
                  Tools in Registry
                </p>
              </div>
              <div>
                <p className="text-3xl font-bold text-green">40</p>
                <p className="text-xs text-text-muted mt-1 uppercase tracking-wider">
                  API Adapters
                </p>
              </div>
              <div>
                <p className="text-3xl font-bold text-text">80+</p>
                <p className="text-xs text-text-muted mt-1 uppercase tracking-wider">
                  Operations
                </p>
              </div>
              <div>
                <p className="text-3xl font-bold text-text">{state.belief_count}</p>
                <p className="text-xs text-text-muted mt-1 uppercase tracking-wider">
                  Beliefs
                </p>
              </div>
              <div>
                <p className="text-3xl font-bold text-text">{state.composite_count}</p>
                <p className="text-xs text-text-muted mt-1 uppercase tracking-wider">
                  Composites
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Featured Tools */}
      {topTools.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold">Featured Tools</h2>
            <Link
              href="/tools"
              className="text-sm text-accent flex items-center gap-1 hover:underline"
            >
              Browse all tools <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {topTools.map((tool) => (
              <Link
                key={tool.id}
                href={`/tools/${tool.slug}`}
                className="border border-border rounded-lg p-4 bg-bg-card hover:bg-bg-card-hover hover:border-accent/30 transition-all group"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm group-hover:text-accent transition-colors truncate">
                    {tool.name}
                  </h3>
                  <span
                    className={`text-xs font-bold shrink-0 ml-2 ${
                      tool.rating >= 10
                        ? "text-green"
                        : tool.rating >= 9
                          ? "text-accent"
                          : "text-amber"
                    }`}
                  >
                    {tool.rating}/10
                  </span>
                </div>
                <p className="text-xs text-text-dim line-clamp-2 mb-3">
                  {tool.description}
                </p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {tool.protocols?.slice(0, 2).map((p: string) => (
                    <span key={p} className="protocol-badge">
                      {p}
                    </span>
                  ))}
                  <span className="text-[10px] text-text-muted ml-auto">
                    {tool.super_category?.replace(/_/g, " ")}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Skills Section */}
      <section className="border border-border rounded-lg bg-bg-card p-8">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-full px-4 py-1.5 mb-6">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            <span className="text-xs text-accent font-medium">New</span>
          </div>
          <h2 className="text-2xl font-bold mb-3">
            Not just APIs &mdash; discover agent skills too
          </h2>
          <p className="text-text-dim text-sm max-w-2xl mx-auto leading-relaxed mb-6">
            Browse 40+ curated skills for design, development, security, and
            more. Skills are procedures your agent installs to learn new
            capabilities &mdash; they run locally in your agent&apos;s context,
            not through an API.
          </p>
          <Link
            href="/skills"
            className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm"
          >
            <Sparkles className="w-4 h-4" />
            Browse Skills
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Pricing Preview */}
      <section>
        <h2 className="text-2xl font-bold text-center mb-4">Simple Pricing</h2>
        <p className="text-text-dim text-center mb-10 text-sm">
          Start free. Scale when you need to.
        </p>
        <div className="grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {/* Free */}
          <div className="border border-border rounded-lg p-6 bg-bg-card">
            <h3 className="font-semibold text-base mb-1">Free</h3>
            <p className="text-3xl font-bold mb-4">
              $0<span className="text-sm text-text-muted font-normal">/mo</span>
            </p>
            <ul className="space-y-2 text-sm text-text-dim mb-6">
              <li className="flex items-center gap-2">
                <ChevronRight className="w-3 h-3 text-accent shrink-0" />
                100 requests/day
              </li>
              <li className="flex items-center gap-2">
                <ChevronRight className="w-3 h-3 text-accent shrink-0" />
                Basic tools access
              </li>
              <li className="flex items-center gap-2">
                <ChevronRight className="w-3 h-3 text-accent shrink-0" />
                2 API keys
              </li>
            </ul>
            <Link
              href="/login"
              className="block text-center border border-border hover:border-accent/40 text-text text-sm py-2 rounded-lg transition-colors"
            >
              Get Started Free
            </Link>
          </div>
          {/* Pro */}
          <div className="border-2 border-accent rounded-lg p-6 bg-bg-card relative glow-accent">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
              Recommended
            </div>
            <h3 className="font-semibold text-base mb-1">Pro</h3>
            <p className="text-3xl font-bold mb-4">
              $29<span className="text-sm text-text-muted font-normal">/mo</span>
            </p>
            <ul className="space-y-2 text-sm text-text-dim mb-6">
              <li className="flex items-center gap-2">
                <ChevronRight className="w-3 h-3 text-accent shrink-0" />
                10,000 requests/month
              </li>
              <li className="flex items-center gap-2">
                <ChevronRight className="w-3 h-3 text-accent shrink-0" />
                All tools access
              </li>
              <li className="flex items-center gap-2">
                <ChevronRight className="w-3 h-3 text-accent shrink-0" />
                BYOK support
              </li>
            </ul>
            <Link
              href="/login"
              className="block text-center bg-accent hover:bg-accent-hover text-white text-sm py-2 rounded-lg transition-colors font-semibold"
            >
              Start Pro Trial
            </Link>
          </div>
          {/* Enterprise */}
          <div className="border border-border rounded-lg p-6 bg-bg-card">
            <h3 className="font-semibold text-base mb-1">Enterprise</h3>
            <p className="text-3xl font-bold mb-4">
              $299<span className="text-sm text-text-muted font-normal">/mo</span>
            </p>
            <ul className="space-y-2 text-sm text-text-dim mb-6">
              <li className="flex items-center gap-2">
                <ChevronRight className="w-3 h-3 text-accent shrink-0" />
                100,000 requests/month
              </li>
              <li className="flex items-center gap-2">
                <ChevronRight className="w-3 h-3 text-accent shrink-0" />
                Custom adapters
              </li>
              <li className="flex items-center gap-2">
                <ChevronRight className="w-3 h-3 text-accent shrink-0" />
                Dedicated support + SLA
              </li>
            </ul>
            <Link
              href="/login"
              className="block text-center border border-border hover:border-accent/40 text-text text-sm py-2 rounded-lg transition-colors"
            >
              Contact Sales
            </Link>
          </div>
        </div>
        <p className="text-center mt-6">
          <Link
            href="/pricing"
            className="text-sm text-accent hover:underline inline-flex items-center gap-1"
          >
            See full pricing <ArrowRight className="w-4 h-4" />
          </Link>
        </p>
      </section>

      {/* Integration Section */}
      <section>
        <h2 className="text-2xl font-bold text-center mb-4">Works Everywhere</h2>
        <p className="text-text-dim text-center mb-10 text-sm">
          Drop into any workflow. One key, every language.
        </p>

        {/* Platform badges */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
          {[
            { label: "Claude Code", icon: Terminal },
            { label: "Cursor", icon: Code2 },
            { label: "OpenAI Agents", icon: Cpu },
            { label: "Python", icon: Code2 },
            { label: "JavaScript", icon: Globe },
            { label: "curl", icon: Terminal },
          ].map(({ label, icon: Icon }) => (
            <div
              key={label}
              className="inline-flex items-center gap-2 border border-border rounded-lg px-4 py-2 bg-bg-card text-sm text-text-dim"
            >
              <Icon className="w-4 h-4 text-accent" />
              {label}
            </div>
          ))}
        </div>

        {/* Code snippets */}
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Python */}
          <div className="bg-[#0d0d18] border border-border rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-bg-card/50">
              <Code2 className="w-3.5 h-3.5 text-green" />
              <span className="text-[10px] text-text-muted">Python</span>
            </div>
            <pre className="p-4 text-xs leading-relaxed overflow-x-auto">
              <code>
                <span className="text-purple">import</span>
                <span className="text-text"> requests</span>
                {"\n\n"}
                <span className="text-text">r = requests.</span>
                <span className="text-green">post</span>
                <span className="text-text">(</span>
                {"\n"}
                <span className="text-amber">    {'"https://toolroute.ai/api/v1/execute"'}</span>
                <span className="text-text">,</span>
                {"\n"}
                <span className="text-text">    headers={`{`}</span>
                <span className="text-amber">{'"Authorization"'}</span>
                <span className="text-text">: </span>
                <span className="text-amber">{'"Bearer tr_live_xxx"'}</span>
                <span className="text-text">{`}`},</span>
                {"\n"}
                <span className="text-text">    json={`{`}</span>
                {"\n"}
                <span className="text-text">        </span>
                <span className="text-amber">{'"tool"'}</span>
                <span className="text-text">: </span>
                <span className="text-amber">{'"firecrawl/scrape"'}</span>
                <span className="text-text">,</span>
                {"\n"}
                <span className="text-text">        </span>
                <span className="text-amber">{'"input"'}</span>
                <span className="text-text">{': {"url": "https://example.com"}'}</span>
                {"\n"}
                <span className="text-text">    {`}`}</span>
                {"\n"}
                <span className="text-text">)</span>
                {"\n"}
                <span className="text-green">print</span>
                <span className="text-text">(r.</span>
                <span className="text-green">json</span>
                <span className="text-text">()[</span>
                <span className="text-amber">{'"data"'}</span>
                <span className="text-text">])</span>
              </code>
            </pre>
          </div>

          {/* JavaScript */}
          <div className="bg-[#0d0d18] border border-border rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-bg-card/50">
              <Globe className="w-3.5 h-3.5 text-amber" />
              <span className="text-[10px] text-text-muted">JavaScript</span>
            </div>
            <pre className="p-4 text-xs leading-relaxed overflow-x-auto">
              <code>
                <span className="text-purple">const</span>
                <span className="text-text"> res = </span>
                <span className="text-purple">await</span>
                <span className="text-text"> </span>
                <span className="text-green">fetch</span>
                <span className="text-text">(</span>
                {"\n"}
                <span className="text-amber">  {'"https://toolroute.ai/api/v1/execute"'}</span>
                <span className="text-text">,</span>
                {"\n"}
                <span className="text-text">  {`{`}</span>
                {"\n"}
                <span className="text-text">    method: </span>
                <span className="text-amber">{'"POST"'}</span>
                <span className="text-text">,</span>
                {"\n"}
                <span className="text-text">    headers: {`{`}</span>
                {"\n"}
                <span className="text-text">      </span>
                <span className="text-amber">{'"Authorization"'}</span>
                <span className="text-text">: </span>
                <span className="text-amber">{'"Bearer tr_live_xxx"'}</span>
                <span className="text-text">,</span>
                {"\n"}
                <span className="text-text">      </span>
                <span className="text-amber">{'"Content-Type"'}</span>
                <span className="text-text">: </span>
                <span className="text-amber">{'"application/json"'}</span>
                {"\n"}
                <span className="text-text">    {`}`},</span>
                {"\n"}
                <span className="text-text">    body: JSON.</span>
                <span className="text-green">stringify</span>
                <span className="text-text">({`{`}</span>
                {"\n"}
                <span className="text-text">      tool: </span>
                <span className="text-amber">{'"firecrawl/scrape"'}</span>
                <span className="text-text">,</span>
                {"\n"}
                <span className="text-text">      input: {`{`} url: </span>
                <span className="text-amber">{'"https://example.com"'}</span>
                <span className="text-text"> {`}`}</span>
                {"\n"}
                <span className="text-text">    {`}`})</span>
                {"\n"}
                <span className="text-text">  {`}`}</span>
                {"\n"}
                <span className="text-text">);</span>
                {"\n\n"}
                <span className="text-purple">const</span>
                <span className="text-text"> {`{`} data {`}`} = </span>
                <span className="text-purple">await</span>
                <span className="text-text"> res.</span>
                <span className="text-green">json</span>
                <span className="text-text">();</span>
              </code>
            </pre>
          </div>
        </div>
      </section>

      {/* Blog / Learn Section */}
      <section>
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold">Learn</h2>
          <Link
            href="/blog"
            className="text-sm text-accent flex items-center gap-1 hover:underline"
          >
            All articles <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <Link
            href="/blog/what-is-an-mcp-gateway"
            className="border border-border rounded-lg p-5 bg-bg-card hover:border-accent/30 transition-all group"
          >
            <p className="text-[10px] text-accent font-medium mb-2">Infrastructure</p>
            <h3 className="font-semibold text-sm mb-2 group-hover:text-accent transition-colors">
              What Is an MCP Gateway?
            </h3>
            <p className="text-xs text-text-dim line-clamp-2">
              MCP registries list tools. MCP gateways execute them. Learn the
              difference and why it matters.
            </p>
          </Link>
          <Link
            href="/blog/mcp-gateway-vs-api-gateway"
            className="border border-border rounded-lg p-5 bg-bg-card hover:border-accent/30 transition-all group"
          >
            <p className="text-[10px] text-accent font-medium mb-2">Infrastructure</p>
            <h3 className="font-semibold text-sm mb-2 group-hover:text-accent transition-colors">
              MCP Gateway vs API Gateway
            </h3>
            <p className="text-xs text-text-dim line-clamp-2">
              API gateways route HTTP requests. MCP gateways route tool calls.
              A side-by-side comparison of what each does.
            </p>
          </Link>
          <Link
            href="/blog/use-mcp-tools-without-managing-servers"
            className="border border-border rounded-lg p-5 bg-bg-card hover:border-accent/30 transition-all group"
          >
            <p className="text-[10px] text-accent font-medium mb-2">Guide</p>
            <h3 className="font-semibold text-sm mb-2 group-hover:text-accent transition-colors">
              Use MCP Tools Without Managing Servers
            </h3>
            <p className="text-xs text-text-dim line-clamp-2">
              One API key, one endpoint, zero server management. Skip the
              infrastructure and start building.
            </p>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border pt-12 pb-4">
        <div className="grid sm:grid-cols-4 gap-8 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded bg-accent flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-bold text-sm">
                Tool<span className="text-accent">Route</span>
              </span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              One API key. Every tool.
              <br />
              Built by the Venture Factory.
            </p>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
              Product
            </h4>
            <ul className="space-y-2">
              <li>
                <Link href="/tools" className="text-sm text-text-dim hover:text-accent transition-colors">
                  Tools
                </Link>
              </li>
              <li>
                <Link href="/skills" className="text-sm text-text-dim hover:text-accent transition-colors">
                  Skills
                </Link>
              </li>
              <li>
                <Link href="/categories" className="text-sm text-text-dim hover:text-accent transition-colors">
                  Categories
                </Link>
              </li>
              <li>
                <Link href="/composites" className="text-sm text-text-dim hover:text-accent transition-colors">
                  Composites
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
              Developers
            </h4>
            <ul className="space-y-2">
              <li>
                <Link href="/docs" className="text-sm text-text-dim hover:text-accent transition-colors">
                  Documentation
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-sm text-text-dim hover:text-accent transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/blog" className="text-sm text-text-dim hover:text-accent transition-colors">
                  Blog
                </Link>
              </li>
              <li>
                <Link href="/login" className="text-sm text-text-dim hover:text-accent transition-colors">
                  Dashboard
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
              Connect
            </h4>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://github.com/Instabidsai/toolroute"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-text-dim hover:text-accent transition-colors"
                >
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href="https://vibearmor.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-text-dim hover:text-accent transition-colors"
                >
                  Vibe coding security scanner
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-text-muted">
            &copy; 2026 ToolRoute. All rights reserved.
          </p>
          <p className="text-xs text-text-muted">
            Built by the{" "}
            <span className="text-accent">Venture Factory</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
