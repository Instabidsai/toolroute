import type { Metadata } from "next";
import Link from "next/link";
import { safeJsonLd } from "@/lib/json-ld";

export const metadata: Metadata = {
  title: "MCP Tool Caching Best Practices: Cut Latency and Cost in 2026",
  description:
    "A practical guide to caching MCP tool responses without breaking correctness. Cache key design, TTL strategy, invalidation, and what never to cache.",
  alternates: { canonical: "/blog/mcp-tool-caching-best-practices" },
  openGraph: {
    title: "MCP Tool Caching Best Practices",
    description:
      "Cache key design, TTL strategy, invalidation patterns, and what never to cache when running MCP tools at scale.",
    url: "https://toolroute.ai/blog/mcp-tool-caching-best-practices",
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
      name: "Should I cache MCP tool responses?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, for read-heavy tools with stable outputs: documentation lookups, public web search, currency conversion, static product catalogs. No, for write operations, personalized results, real-time data like stock prices, or anything tied to a specific user session. The rule: cache if the same input reliably produces the same output for some minimum TTL.",
      },
    },
    {
      "@type": "Question",
      name: "What is a good default TTL for MCP tool caches?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "There is no universal default. Documentation: 24 hours. Web search: 15 minutes to 1 hour. Product pricing: 1-5 minutes. User-specific data: do not cache. Start with a short TTL and extend it only after you measure hit rate and staleness complaints. A 5-minute TTL with 70 percent hit rate is almost always better than a 24-hour TTL with correctness bugs.",
      },
    },
    {
      "@type": "Question",
      name: "How do I build a good cache key for MCP tool calls?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A cache key needs three parts: tool name, operation name, and a canonical hash of the input. Canonicalize the input first: sort object keys, lowercase strings where case does not matter, normalize whitespace. The key should be deterministic so identical semantic requests share a cache entry. Add version prefix so a schema change invalidates old entries automatically.",
      },
    },
    {
      "@type": "Question",
      name: "What MCP tool responses should I never cache?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Never cache: payment and billing calls, authentication or OAuth flows, user-specific data, write operations of any kind, real-time market data, inventory lookups for live commerce, rate-limit checks, and anything returning tokens or session IDs. When in doubt, do not cache. A stale result is worse than a cache miss.",
      },
    },
  ],
};

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "MCP Tool Caching Best Practices: Cut Latency and Cost",
  description:
    "Cache key design, TTL strategy, and invalidation patterns for MCP tool calls at scale.",
  datePublished: "2026-04-15T00:00:00Z",
  author: { "@type": "Organization", name: "ToolRoute" },
  publisher: {
    "@type": "Organization",
    name: "ToolRoute",
    url: "https://toolroute.ai",
  },
  mainEntityOfPage:
    "https://toolroute.ai/blog/mcp-tool-caching-best-practices",
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
          <p className="text-accent text-xs font-medium mb-4">Performance</p>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">
            MCP Tool Caching Best Practices: Cut Latency and Cost
          </h1>
          <p className="text-text-dim text-sm leading-relaxed mb-4">
            A practical guide to caching MCP tool responses without breaking
            correctness. Cache key design, TTL strategy, invalidation, and
            what never to cache.
          </p>
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <span>April 15, 2026</span>
            <span>10 min read</span>
            <span>ToolRoute Team</span>
          </div>
        </header>

        <div className="prose-custom space-y-8 text-sm leading-relaxed">
          <p>
            Agents are repetitive. An agent debugging a Next.js hook might
            call{" "}
            <code className="bg-bg-card px-1.5 py-0.5 rounded text-accent text-xs">
              context7.query-docs
            </code>{" "}
            for the same library three times in five minutes. A research
            agent will search the web for &quot;MCP Streamable HTTP&quot; on
            every run. A pricing comparison agent will fetch the same product
            page ten times across a reporting window. Each of those calls
            takes 500-3000ms and costs credits.
          </p>
          <p>
            Good caching turns most of that into zero-cost, single-digit-ms
            lookups. Bad caching shows stale data to users and creates
            correctness bugs that take weeks to find. This is the
            shortest path we know to the first without the second.
          </p>

          <h2 className="text-xl font-bold pt-4">
            The Cacheability Test
          </h2>
          <p>
            Before you touch code, decide whether each tool call is
            cacheable. Ask three questions:
          </p>
          <ol className="space-y-1.5 text-text-dim pl-4 list-decimal">
            <li>
              <strong className="text-text">Is it a read?</strong> Writes are
              never cacheable on the response side. You can debounce writes,
              but that is a different pattern.
            </li>
            <li>
              <strong className="text-text">Is the output a function of the
              input?</strong> If two identical inputs can produce different
              outputs (user context, personalization, time-of-day pricing),
              you need the request-specific context in the cache key or you
              cannot cache at all.
            </li>
            <li>
              <strong className="text-text">What TTL keeps it correct?</strong>{" "}
              If your users tolerate a 5-minute lag, you can cache for 5
              minutes. If they cannot tolerate any lag, you cannot cache this
              tool.
            </li>
          </ol>
          <p>
            Only tool calls that answer yes-yes-nonzero survive to the next
            step. Everything else goes straight to the upstream.
          </p>

          <h2 className="text-xl font-bold pt-4">
            Cache Key Design: The Part Everyone Gets Wrong
          </h2>
          <p>
            A bad cache key is the root cause of most caching bugs. A cache
            key has three responsibilities: it must be deterministic (same
            semantic request to same key), unique (different semantic
            requests to different keys), and versioned (old cached entries
            invalidate when the schema or adapter changes).
          </p>
          <p>
            The working pattern is:
          </p>
          <pre className="bg-bg-card border border-border rounded-lg p-4 overflow-x-auto text-xs">
{`key = [
  "mcp",
  SCHEMA_VERSION,     // "v3"
  tool,               // "tavily"
  operation,          // "search"
  canonicalHash(input)
].join(":")`}
          </pre>
          <p>
            The{" "}
            <code className="bg-bg-card px-1.5 py-0.5 rounded text-xs">
              canonicalHash
            </code>{" "}
            step does three things: sort object keys alphabetically,
            normalize strings (lowercase where safe, trim whitespace, strip
            duplicate spaces), then SHA-256 the result. Two semantically
            identical queries will hash to the same key. Different queries
            always diverge.
          </p>
          <p>
            The schema version prefix is critical. When you change an
            adapter&apos;s output shape, bumping{" "}
            <code className="bg-bg-card px-1.5 py-0.5 rounded text-xs">
              SCHEMA_VERSION
            </code>{" "}
            invalidates every cached entry under the old version without a
            single delete call. Without this, you will ship a bug fix that
            cannot propagate because yesterday&apos;s broken cache keeps
            serving the old response.
          </p>

          <h2 className="text-xl font-bold pt-4">
            TTL Strategy by Tool Type
          </h2>
          <p>
            The right TTL is almost never the provider&apos;s default
            cache-control header. Providers set long TTLs because it helps
            them. You want TTLs that match how fast your users expect data
            to update.
          </p>
          <div className="bg-bg-card border border-border rounded-lg p-6 my-6">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-muted border-b border-border">
                  <th className="text-left pb-2 pr-4">Tool Category</th>
                  <th className="text-left pb-2 pr-4">Typical TTL</th>
                  <th className="text-left pb-2">Why</th>
                </tr>
              </thead>
              <tbody className="text-text-dim">
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Documentation (Context7, DeepWiki)</td>
                  <td className="py-2 pr-4">24h</td>
                  <td className="py-2">Versioned, changes slowly</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Web search (Tavily, Brave)</td>
                  <td className="py-2 pr-4">15-60 min</td>
                  <td className="py-2">Index lag already exists</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Web scrape (Firecrawl)</td>
                  <td className="py-2 pr-4">1-6h</td>
                  <td className="py-2">Public pages update rarely</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Product catalog</td>
                  <td className="py-2 pr-4">5-15 min</td>
                  <td className="py-2">Pricing can change</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Geocoding, currency</td>
                  <td className="py-2 pr-4">24h</td>
                  <td className="py-2">Essentially static</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">LLM completions</td>
                  <td className="py-2 pr-4">None</td>
                  <td className="py-2">Stochastic by design</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Payment / billing</td>
                  <td className="py-2 pr-4">Never</td>
                  <td className="py-2">Correctness critical</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">User inbox, real-time</td>
                  <td className="py-2 pr-4">Never</td>
                  <td className="py-2">Freshness critical</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Start with the short end of each range. Extend only after you
            measure hit rate and have zero complaints about stale data. A
            5-minute TTL with 70 percent hit rate is almost always better
            than a 24-hour TTL with a correctness bug you will find next
            quarter.
          </p>

          <h2 className="text-xl font-bold pt-4">
            Five Caching Patterns Worth Using
          </h2>

          <h3 className="text-base font-semibold pt-2">
            1. Read-Through Cache
          </h3>
          <p>
            The workhorse pattern. Agent calls the tool. Gateway checks
            cache. Hit returns immediately. Miss fetches upstream, stores,
            returns. Ninety percent of MCP caching should be this. Add
            instrumentation so you can graph hit rate per tool; anything
            below 30 percent probably is not worth caching.
          </p>

          <h3 className="text-base font-semibold pt-2">
            2. Stale-While-Revalidate
          </h3>
          <p>
            Two TTLs per entry: a fresh TTL and a stale-tolerated TTL. If the
            entry is fresh, return it. If it is stale but still within
            tolerance, return the stale value immediately and kick off an
            async refresh. If it is past tolerance, treat as a miss. This
            pattern gives you low p99 latency because users rarely wait for
            the revalidation.
          </p>

          <h3 className="text-base font-semibold pt-2">
            3. Negative Caching
          </h3>
          <p>
            Cache failures too, but with a short TTL (30 seconds to 2
            minutes). If a tool just returned 404 or &quot;not found,&quot;
            the next identical call probably will too. Negative caching
            avoids hammering upstreams on repeated bad queries, which
            matters for rate-limited APIs.
          </p>

          <h3 className="text-base font-semibold pt-2">
            4. Request Coalescing (Single-Flight)
          </h3>
          <p>
            When 50 agents ask for the same expensive lookup at once, you
            want to fetch upstream once, not 50 times. Single-flight pins
            the first request as the in-flight fetch; the other 49 await the
            result instead of triggering their own. This pairs beautifully
            with cold-start traffic and viral agent workflows.
          </p>

          <h3 className="text-base font-semibold pt-2">
            5. Layered Caches (Edge + Regional + Memory)
          </h3>
          <p>
            For hot documentation lookups, a three-layer stack is
            reasonable: process-local LRU (sub-millisecond), regional Redis
            (5-15ms), and upstream (500-3000ms). The process-local layer
            absorbs burst traffic; the regional layer survives deploys. Do
            not add a layer unless you are seeing real cache stampedes.
          </p>

          <h2 className="text-xl font-bold pt-4">
            What to Never Cache
          </h2>
          <ul className="space-y-1.5 text-text-dim pl-4">
            <li>Any write operation, ever.</li>
            <li>Auth token issuance, OAuth exchanges, session creation.</li>
            <li>Payment, refund, invoice, subscription calls.</li>
            <li>User-specific inbox, notifications, DMs.</li>
            <li>Real-time market or inventory data.</li>
            <li>LLM completions (sampled, not deterministic).</li>
            <li>Rate-limit probe calls.</li>
            <li>
              Calls whose response includes a nonce, session ID, or expiring
              token.
            </li>
          </ul>
          <p>
            If you are not sure, err on the side of no cache. Users forgive
            latency more than they forgive wrong answers.
          </p>

          <h2 className="text-xl font-bold pt-4">
            Invalidation Strategies That Actually Work
          </h2>
          <p>
            There are four invalidation strategies worth knowing, in order
            of preference:
          </p>
          <ol className="space-y-1.5 text-text-dim pl-4 list-decimal">
            <li>
              <strong className="text-text">TTL expiry.</strong> Simplest,
              most reliable. Use it by default.
            </li>
            <li>
              <strong className="text-text">Version prefix bump.</strong> Ship
              a schema change, bump the prefix, the old cache is gone with
              zero deletes.
            </li>
            <li>
              <strong className="text-text">Explicit invalidation on
              write.</strong> If an agent writes a new product, invalidate
              the product catalog cache. Works only when writes and reads
              share the same key namespace.
            </li>
            <li>
              <strong className="text-text">Webhook-driven
              invalidation.</strong> Upstream fires a webhook when data
              changes; you invalidate the matching key. High complexity; use
              it only when the other three are not enough.
            </li>
          </ol>
          <p>
            Write-through caching (the write goes to cache and upstream
            together) is tempting but brittle. Avoid it unless you have a
            specific reason.
          </p>

          <h2 className="text-xl font-bold pt-4">
            Measuring the Win
          </h2>
          <p>
            You cannot tune what you do not measure. Track four numbers per
            tool:
          </p>
          <ul className="space-y-1.5 text-text-dim pl-4">
            <li>
              <strong className="text-text">Hit rate:</strong> hits / total.
              Under 30 percent probably means your keys are too granular or
              your TTL is too short.
            </li>
            <li>
              <strong className="text-text">Cache latency vs upstream
              latency:</strong> if your cache is 50ms and upstream is 200ms,
              you are not winning much. Aim for a 10x gap minimum.
            </li>
            <li>
              <strong className="text-text">Staleness complaints:</strong>{" "}
              tagged tickets or error reports where users saw outdated data.
              Zero is the goal; one is a signal to shorten TTL.
            </li>
            <li>
              <strong className="text-text">Cost saved:</strong> missed
              upstream calls times upstream cost per call. This is the
              number you show to finance.
            </li>
          </ul>

          <h2 className="text-xl font-bold pt-4">
            Caching at the Gateway Layer
          </h2>
          <p>
            Every app team building their own MCP cache re-solves the same
            problems: key canonicalization, TTL selection, invalidation,
            observability. A gateway-level cache lifts this into shared
            infrastructure. At ToolRoute, the gateway can memoize
            read-heavy tool calls per API key with operation-aware defaults,
            which means documentation lookups across 51 adapters share one
            well-tuned cache instead of 51 leaky ones.
          </p>
          <p>
            The related articles on{" "}
            <Link
              href="/blog/what-is-an-mcp-gateway"
              className="text-accent hover:underline"
            >
              what MCP gateways do
            </Link>
            ,{" "}
            <Link
              href="/blog/how-to-debug-mcp-tool-calls"
              className="text-accent hover:underline"
            >
              debugging MCP tool calls
            </Link>
            , and{" "}
            <Link
              href="/blog/ai-agent-tool-billing-credits"
              className="text-accent hover:underline"
            >
              tool billing and credits
            </Link>{" "}
            cover how a gateway reduces operational burden overall. The{" "}
            <Link href="/tools" className="text-accent hover:underline">
              tools directory
            </Link>{" "}
            shows which adapters are cache-friendly by default. For the
            terms used in this post, see the{" "}
            <Link href="/glossary" className="text-accent hover:underline">
              glossary
            </Link>
            .
          </p>

          <h2 className="text-xl font-bold pt-4">
            A Cache Sanity Checklist
          </h2>
          <ol className="space-y-1.5 text-text-dim pl-4 list-decimal">
            <li>Only cache reads with a TTL short enough to stay correct.</li>
            <li>Canonicalize inputs before hashing; sort object keys.</li>
            <li>Prefix keys with a schema version you bump on changes.</li>
            <li>Default to the short end of TTL ranges; extend on evidence.</li>
            <li>Use stale-while-revalidate for hot read paths.</li>
            <li>Add single-flight coalescing before you scale.</li>
            <li>Cache negatives with short TTL on 404s and empty results.</li>
            <li>Never cache writes, payments, auth, or real-time data.</li>
            <li>Measure hit rate, latency delta, staleness complaints, cost saved.</li>
          </ol>
          <p>
            Keep caching boring. Most of the speedup comes from three or
            four well-chosen TTLs, not from clever invalidation schemes.
          </p>

          <h2 className="text-xl font-bold pt-4">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-sm">
                Should I cache MCP tool responses?
              </h3>
              <p className="text-text-dim mt-1">
                Yes for read-heavy tools with stable outputs (docs, public
                web search, geocoding, static catalogs). No for writes,
                personalization, real-time data, or anything tied to a user
                session. The rule: cache if the same input reliably produces
                the same output for some minimum TTL.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                What is a good default TTL for MCP tool caches?
              </h3>
              <p className="text-text-dim mt-1">
                No universal default. Documentation: 24 hours. Web search:
                15-60 minutes. Product pricing: 1-5 minutes. User data: do
                not cache. Start short, extend on evidence.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                How do I build a good cache key for MCP tool calls?
              </h3>
              <p className="text-text-dim mt-1">
                Three parts: tool name, operation name, canonical hash of
                the input. Canonicalize by sorting object keys, lowercasing
                where safe, normalizing whitespace. Prefix with a schema
                version so schema changes invalidate old entries
                automatically.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                What MCP tool responses should I never cache?
              </h3>
              <p className="text-text-dim mt-1">
                Never cache payment and billing calls, OAuth flows,
                user-specific data, write operations, real-time market data,
                live inventory, rate-limit probes, or anything returning
                tokens. When in doubt, do not cache.
              </p>
            </div>
          </div>

          <div className="border-t border-border pt-8 mt-8">
            <h3 className="font-semibold text-sm mb-4">Related Articles</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/blog/how-to-debug-mcp-tool-calls"
                  className="text-accent hover:underline"
                >
                  How to Debug MCP Tool Calls
                </Link>
              </li>
              <li>
                <Link
                  href="/blog/how-ai-agents-handle-tool-failures"
                  className="text-accent hover:underline"
                >
                  How AI Agents Handle Tool Failures
                </Link>
              </li>
              <li>
                <Link
                  href="/blog/ai-agent-tool-billing-credits"
                  className="text-accent hover:underline"
                >
                  AI Agent Tool Billing and Credits Explained
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
              Ship one cache configuration across every MCP tool you use.
              See the{" "}
              <Link href="/docs" className="text-accent hover:underline">
                ToolRoute docs
              </Link>
              , browse the{" "}
              <Link href="/tools" className="text-accent hover:underline">
                tool catalog
              </Link>
              , or check the{" "}
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
