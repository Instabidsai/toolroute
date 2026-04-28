import type { Metadata } from "next";
import Link from "next/link";
import { safeJsonLd } from "@/lib/json-ld";

export const metadata: Metadata = {
  title:
    "MCP Server List 2026: The Definitive Directory of Every Server Worth Using",
  description:
    "The definitive 2026 directory of MCP servers, organized by category. Ratings, protocols, cost, and real usage data for 34 servers across Infrastructure, Communication, Content, DevOps, and more.",
  alternates: { canonical: "/blog/mcp-server-list-directory-2026" },
  openGraph: {
    title: "MCP Server List 2026: The Definitive Directory",
    description:
      "Every MCP server worth using in 2026, grouped by category with ratings and usage data.",
    url: "https://toolroute.ai/blog/mcp-server-list-directory-2026",
    type: "article",
    publishedTime: "2026-04-15T00:00:00Z",
  },
};

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline:
    "MCP Server List 2026: The Definitive Directory of Every Server Worth Using",
  description:
    "The definitive 2026 directory of MCP servers, organized by category. 34 servers ranked across Infrastructure, DevOps, Communication, Content, and more.",
  datePublished: "2026-04-15T00:00:00Z",
  dateModified: "2026-04-15T00:00:00Z",
  author: { "@type": "Organization", name: "ToolRoute" },
  publisher: {
    "@type": "Organization",
    name: "ToolRoute",
    url: "https://toolroute.ai",
    logo: {
      "@type": "ImageObject",
      url: "https://toolroute.ai/logo.png",
    },
  },
  mainEntityOfPage:
    "https://toolroute.ai/blog/mcp-server-list-directory-2026",
};

type Tool = {
  name: string;
  slug: string;
  description: string;
  rating: number;
  protocols: string[];
  cost: string;
};

type Category = {
  name: string;
  blurb: string;
  tools: Tool[];
};

const categories: Category[] = [
  {
    name: "Infrastructure",
    blurb:
      "The bedrock layer — databases, auth, browser control, docs, and the plumbing agents lean on most.",
    tools: [
      {
        name: "Supabase MCP",
        slug: "supabase-mcp",
        description:
          "Full Supabase backend in one MCP server: DB, storage, auth, edge functions, migrations, config.",
        rating: 10,
        protocols: ["mcp", "rest", "openapi"],
        cost: "free",
      },
      {
        name: "Playwright MCP",
        slug: "playwright-mcp",
        description:
          "Official Anthropic Playwright MCP. Deterministic browser automation via accessibility snapshots. The standard.",
        rating: 10,
        protocols: ["mcp"],
        cost: "free",
      },
      {
        name: "Composio",
        slug: "composio",
        description:
          "OAuth for 850+ apps. 11K+ tools. Managed auth infrastructure for AI agents. MCP + REST + SDK.",
        rating: 10,
        protocols: ["mcp", "rest", "openapi"],
        cost: "freemium",
      },
      {
        name: "Context7",
        slug: "context7",
        description:
          "Injects live, version-specific documentation into prompts. #1 MCP server. 50.1K GitHub stars. Eliminates doc hallucination.",
        rating: 10,
        protocols: ["mcp"],
        cost: "free",
      },
      {
        name: "Blender MCP",
        slug: "blender-mcp",
        description:
          "Natural language to 3D scenes in real time. 17K+ stars. 1500 Blender operators simplified to chat.",
        rating: 9,
        protocols: ["mcp"],
        cost: "free",
      },
      {
        name: "Google Stitch",
        slug: "google-stitch",
        description:
          "Voice/text to finished UI designs. DESIGN.md export. MCP server. Free 350 gen/mo. Ships CC skills.",
        rating: 9,
        protocols: ["mcp", "skill"],
        cost: "free",
      },
      {
        name: "Grafana MCP",
        slug: "grafana-mcp",
        description:
          "40+ tools across 15 categories. Apache 2.0. 2.6K stars. Observability standard.",
        rating: 9,
        protocols: ["mcp"],
        cost: "free",
      },
    ],
  },
  {
    name: "DevOps & Deployment",
    blurb:
      "Ship code, manage containers, and run edge infra without leaving the agent loop.",
    tools: [
      {
        name: "GitHub MCP",
        slug: "github-mcp",
        description:
          "Official GitHub MCP. Repos, PRs, issues, workflows — full integration. 27K stars.",
        rating: 10,
        protocols: ["mcp"],
        cost: "free",
      },
      {
        name: "Vercel MCP",
        slug: "vercel-mcp",
        description:
          "Official Vercel MCP. Access logs, docs, projects, deployments, domains.",
        rating: 9,
        protocols: ["mcp", "rest"],
        cost: "freemium",
      },
      {
        name: "Cloudflare MCP",
        slug: "cloudflare-mcp",
        description:
          "Deploy/configure Workers, KV, R2, D1. Edge computing standard.",
        rating: 9,
        protocols: ["mcp", "rest"],
        cost: "free",
      },
      {
        name: "Docker MCP",
        slug: "docker-mcp",
        description:
          "Container management via MCP. Build, run, manage Docker containers.",
        rating: 9,
        protocols: ["mcp"],
        cost: "free",
      },
    ],
  },
  {
    name: "Communication",
    blurb:
      "Email, SMS, voice, team chat — the surfaces where agents actually reach humans.",
    tools: [
      {
        name: "Twilio",
        slug: "twilio",
        description:
          "SMS, voice, video, messaging automation. The undisputed standard for communication APIs.",
        rating: 10,
        protocols: ["rest", "openapi", "mcp"],
        cost: "paid",
      },
      {
        name: "Slack API",
        slug: "slack",
        description:
          "Send messages, read channels, reply to threads, list channels.",
        rating: 10,
        protocols: ["rest", "mcp"],
        cost: "free",
      },
      {
        name: "Slack MCP",
        slug: "slack-mcp",
        description:
          "Official Slack MCP. 47 tools. Post messages, read channels, manage workflows.",
        rating: 9,
        protocols: ["mcp"],
        cost: "freemium",
      },
      {
        name: "Gmail MCP",
        slug: "gmail-mcp",
        description:
          "Official Gmail MCP via Composio. Read inbox, parse emails, auto-respond across accounts.",
        rating: 9,
        protocols: ["mcp"],
        cost: "free",
      },
    ],
  },
  {
    name: "CRM & Sales",
    blurb:
      "Where pipeline data lives. Agents read, write, and progress deals without human copy-paste.",
    tools: [
      {
        name: "HubSpot CRM",
        slug: "hubspot",
        description: "CRM — contacts, deals, pipeline, notes.",
        rating: 10,
        protocols: ["rest", "mcp"],
        cost: "freemium",
      },
      {
        name: "HubSpot MCP",
        slug: "hubspot-mcp",
        description:
          "CRM management via MCP. Contacts, deals, pipeline, companies, notes.",
        rating: 9,
        protocols: ["mcp", "rest"],
        cost: "freemium",
      },
      {
        name: "Smartlead",
        slug: "smartlead",
        description:
          "116-tool MCP for cold email. Sequences, warmup, tracking, deliverability.",
        rating: 9,
        protocols: ["mcp", "rest"],
        cost: "paid",
      },
    ],
  },
  {
    name: "Content & Creative",
    blurb:
      "AI video, avatars, and generative media. The highest-leverage category for solo operators.",
    tools: [
      {
        name: "Higgsfield",
        slug: "higgsfield",
        description:
          "AI video & image platform — 30+ models (Sora 2, Kling 3.0, Veo 3.1, Soul 2.0, Seedance). 4.5M generations/day.",
        rating: 10,
        protocols: ["rest", "mcp"],
        cost: "usage-based",
      },
      {
        name: "HeyGen MCP",
        slug: "heygen-mcp",
        description:
          "AI avatar/spokesperson videos. Talking head explainers. Official MCP.",
        rating: 9,
        protocols: ["mcp", "rest"],
        cost: "paid",
      },
    ],
  },
  {
    name: "Marketing & Growth",
    blurb:
      "Distribution and data — social, scraping, and the tools that push reach beyond a single app.",
    tools: [
      {
        name: "Postiz",
        slug: "postiz",
        description:
          "Self-hosted social media management. 32 platforms. Free ULTIMATE tier.",
        rating: 9,
        protocols: ["rest", "mcp"],
        cost: "free",
      },
      {
        name: "Firecrawl",
        slug: "firecrawl",
        description:
          "Fastest web scraping MCP (7s avg, 83% accuracy). Search + extract + crawl in one.",
        rating: 9,
        protocols: ["mcp", "rest"],
        cost: "freemium",
      },
    ],
  },
  {
    name: "Finance & Payments",
    blurb:
      "Billing, invoicing, and subscriptions. This is where agents move money, so it has to be exact.",
    tools: [
      {
        name: "Stripe MCP",
        slug: "stripe-mcp",
        description:
          "Official Anthropic Stripe integration. Customers, invoices, subscriptions, products, refunds.",
        rating: 10,
        protocols: ["mcp", "rest", "openapi"],
        cost: "freemium",
      },
    ],
  },
  {
    name: "E-commerce",
    blurb: "Storefronts agents can read inventory from and push product updates to.",
    tools: [
      {
        name: "Shopify MCP",
        slug: "shopify-mcp",
        description:
          "E-commerce management via MCP. Products, orders, collections, inventory.",
        rating: 9,
        protocols: ["mcp", "rest", "graphql"],
        cost: "freemium",
      },
    ],
  },
  {
    name: "Operations & Workspace",
    blurb:
      "Docs, sheets, tasks, and the automation glue holding the rest together.",
    tools: [
      {
        name: "Notion",
        slug: "notion",
        description:
          "Workspace — pages, databases, search, knowledge base.",
        rating: 10,
        protocols: ["rest", "mcp"],
        cost: "freemium",
      },
      {
        name: "Notion MCP",
        slug: "notion-mcp",
        description:
          "Official Notion MCP. Pages, databases, blocks. Internal documentation.",
        rating: 9,
        protocols: ["mcp", "rest"],
        cost: "freemium",
      },
      {
        name: "Zapier MCP",
        slug: "zapier-mcp",
        description:
          "30K actions, 8K apps. When nothing else covers it, Zapier does. Long-tail king.",
        rating: 9,
        protocols: ["mcp"],
        cost: "freemium",
      },
      {
        name: "n8n",
        slug: "n8n",
        description:
          "Self-hostable workflow automation. 1084+ nodes, 2646+ configs. Open source alternative to Zapier.",
        rating: 9,
        protocols: ["mcp", "rest", "npm"],
        cost: "freemium",
      },
      {
        name: "Google Sheets MCP",
        slug: "google-sheets-mcp",
        description:
          "Spreadsheet operations via MCP. Create/edit/analyze spreadsheets.",
        rating: 9,
        protocols: ["mcp"],
        cost: "free",
      },
      {
        name: "Google Drive MCP",
        slug: "google-drive-mcp",
        description:
          "File storage via MCP. Store/retrieve/share files across accounts.",
        rating: 9,
        protocols: ["mcp"],
        cost: "free",
      },
      {
        name: "Linear MCP",
        slug: "linear-mcp",
        description:
          "Issue management and project tracking via MCP. Developer-focused. Clean API.",
        rating: 9,
        protocols: ["mcp", "rest", "graphql"],
        cost: "freemium",
      },
    ],
  },
  {
    name: "Scheduling",
    blurb:
      "Calendar access is still one of the highest-agency things you can give an agent.",
    tools: [
      {
        name: "Google Calendar MCP",
        slug: "google-calendar-mcp",
        description:
          "Official Google Calendar MCP. Create/edit/delete events, check availability.",
        rating: 9,
        protocols: ["mcp"],
        cost: "free",
      },
    ],
  },
  {
    name: "Security",
    blurb:
      "Static analysis and scanning so agents can audit their own code before it ships.",
    tools: [
      {
        name: "Semgrep MCP",
        slug: "semgrep-mcp",
        description:
          "Code security scanning via MCP. Find vulnerabilities in code.",
        rating: 9,
        protocols: ["mcp"],
        cost: "freemium",
      },
    ],
  },
  {
    name: "Analytics & Observability",
    blurb: "Close the loop. Know when something broke before your customers do.",
    tools: [
      {
        name: "Sentry MCP",
        slug: "sentry-mcp",
        description:
          "Zero-install remote MCP. OAuth 2.0. Seer AI root cause analysis. Best error tracking.",
        rating: 9,
        protocols: ["mcp"],
        cost: "freemium",
      },
    ],
  },
];

const totalTools = categories.reduce((n, c) => n + c.tools.length, 0);

export default function Article() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(articleSchema) }}
      />
      <article className="max-w-3xl mx-auto">
        <header className="mb-12">
          <p className="text-accent text-xs font-medium mb-4">Directory</p>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">
            MCP Server List 2026: The Definitive Directory of Every Server
            Worth Using
          </h1>
          <p className="text-text-dim text-sm leading-relaxed mb-4">
            A curated directory of {totalTools} MCP-compatible servers, grouped
            by category. Every entry is a server that an actual production agent
            loop has depended on — not a GitHub link someone skimmed once. If a
            server is on this list, it earned a place through an 8-dimension
            review.
          </p>
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <span>April 15, 2026</span>
            <span>14 min read</span>
            <span>ToolRoute Team</span>
          </div>
        </header>

        <div className="prose-custom space-y-8 text-sm leading-relaxed">
          <p>
            Search for &quot;mcp server list&quot; in 2026 and you get two
            flavors of answer: raw GitHub awesome-lists with 400 dead links, or
            marketing pages that pretend every new server is a breakthrough.
            Neither is useful when you are trying to actually ship an agent.
          </p>
          <p>
            This is a third option. We maintain the{" "}
            <Link href="/tools" className="text-accent hover:underline">
              ToolRoute registry
            </Link>
            , a living catalog of tools that AI agents use through a single API
            gateway. Every server here is scored on capability, protocol
            support, cost, maturity, resale potential, reliability, ecosystem,
            and agent-native design. Servers are only listed if they clear
            rating 9 or 10 on that scale. Everything below that line gets
            demoted quietly.
          </p>

          <h2 className="text-xl font-bold pt-4">Curation methodology</h2>
          <p>
            Three things make this list different from the average awesome-mcp
            repo:
          </p>
          <ul className="space-y-1.5 text-text-dim pl-4 list-disc">
            <li>
              <strong className="text-text">8-dimension scoring.</strong> Every
              server gets rated 1 to 10 on eight axes. A new entry has to beat
              the incumbent on 5 of 8 to take a category slot. Hype alone does
              not move the rankings.
            </li>
            <li>
              <strong className="text-text">Real usage telemetry.</strong> The
              registry powers a production{" "}
              <Link
                href="/glossary"
                className="text-accent hover:underline"
              >
                MCP gateway
              </Link>
              . Every call we route feeds back into reliability and latency
              scores. Tools that fail in production fall off the list, even if
              they look great on paper.
            </li>
            <li>
              <strong className="text-text">Category champions.</strong> We do
              not dump 400 servers on you. We pick winners. If two servers do
              the same thing, only the one that won is listed — unless the
              loser has a specific edge case worth documenting.
            </li>
          </ul>
          <p>
            The list below is the output of that process as of April 2026. It
            is organized by super-category so you can jump to the layer you
            care about. For a narrative version of the same data focused on
            individual champions, see{" "}
            <Link
              href="/blog/best-mcp-servers-ai-agents-2026"
              className="text-accent hover:underline"
            >
              Best MCP Servers for AI Agents in 2026
            </Link>
            .
          </p>

          <h2 className="text-xl font-bold pt-4">What qualifies as an MCP server</h2>
          <p>
            Every entry below speaks the Model Context Protocol natively — the
            JSON-RPC spec Anthropic open-sourced in late 2024 that has since
            become the default integration surface for agent frameworks. Most
            also expose a REST or OpenAPI surface for backward compatibility,
            but the MCP interface is what gets them on this list. If a tool has
            only a REST API and no MCP server, it lives elsewhere in the
            registry and is not part of this directory.
          </p>

          {categories.map((cat) => (
            <section key={cat.name} className="pt-2">
              <h2 className="text-xl font-bold pt-4">
                {cat.name}{" "}
                <span className="text-text-muted text-sm font-normal">
                  ({cat.tools.length})
                </span>
              </h2>
              <p className="text-text-dim">{cat.blurb}</p>
              <div className="overflow-x-auto my-4">
                <table className="w-full text-xs border border-border rounded-lg overflow-hidden">
                  <thead>
                    <tr className="bg-bg-card text-text-muted border-b border-border">
                      <th className="text-left p-3">Server</th>
                      <th className="text-left p-3">What it does</th>
                      <th className="text-left p-3">Rating</th>
                      <th className="text-left p-3">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cat.tools.map((t) => (
                      <tr
                        key={t.slug}
                        className="border-b border-border/50 hover:bg-bg-card/50 align-top"
                      >
                        <td className="p-3 font-medium whitespace-nowrap">
                          <Link
                            href={`/tools/${t.slug}`}
                            className="text-accent hover:underline"
                          >
                            {t.name}
                          </Link>
                          <div className="text-text-muted font-normal mt-0.5">
                            {t.protocols.join(" / ")}
                          </div>
                        </td>
                        <td className="p-3 text-text-dim">{t.description}</td>
                        <td className="p-3 whitespace-nowrap">
                          {t.rating}/10
                        </td>
                        <td className="p-3 text-text-dim whitespace-nowrap">
                          {t.cost}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}

          <h2 className="text-xl font-bold pt-4">Observations from running the registry</h2>
          <p>
            A few patterns show up every time we refresh this list:
          </p>
          <ol className="space-y-2 text-text-dim pl-4 list-decimal">
            <li>
              <strong className="text-text">Official beats community.</strong>{" "}
              Whenever Anthropic, GitHub, Stripe, Vercel, or Slack ships a
              first-party MCP, it almost always dethrones the community server
              within a quarter. Stripe MCP, GitHub MCP, Playwright MCP, Vercel
              MCP, and Slack MCP all arrived that way. Community servers still
              matter for long-tail coverage, but the top of every category
              eventually goes first-party.
            </li>
            <li>
              <strong className="text-text">
                Most teams need four servers, not forty.
              </strong>{" "}
              The realistic starter stack is something like{" "}
              <Link
                href="/tools/supabase-mcp"
                className="text-accent hover:underline"
              >
                Supabase
              </Link>{" "}
              (data) +{" "}
              <Link
                href="/tools/github-mcp"
                className="text-accent hover:underline"
              >
                GitHub
              </Link>{" "}
              (code) +{" "}
              <Link
                href="/tools/playwright-mcp"
                className="text-accent hover:underline"
              >
                Playwright
              </Link>{" "}
              (browser) + one integration hub like{" "}
              <Link
                href="/tools/composio"
                className="text-accent hover:underline"
              >
                Composio
              </Link>{" "}
              or{" "}
              <Link
                href="/tools/zapier-mcp"
                className="text-accent hover:underline"
              >
                Zapier MCP
              </Link>{" "}
              to cover every other SaaS the agent eventually needs. Everything
              beyond that is specialization.
            </li>
            <li>
              <strong className="text-text">
                Aggregators cover the long tail.
              </strong>{" "}
              Composio alone maps to 850+ apps and 11K+ tools. Zapier MCP covers
              8K apps and 30K actions. For the servers you will hit once a
              month, aggregators are almost always the right answer — dedicated
              MCP only wins when you hit the API every day.
            </li>
            <li>
              <strong className="text-text">
                Context7 stays #1 because it solves the base problem.
              </strong>{" "}
              Almost every agent bug we see traces back to outdated API
              knowledge. Context7 injects current, version-specific docs at
              prompt time. It is rating 10 because skipping it costs more than
              installing it.
            </li>
            <li>
              <strong className="text-text">
                Protocol breadth beats protocol purity.
              </strong>{" "}
              The best servers expose MCP plus REST plus (often) OpenAPI.
              Clients change. Agents change. Servers that support multiple
              surfaces survive longer.
            </li>
          </ol>

          <h2 className="text-xl font-bold pt-4">
            What to install vs. what to access through a gateway
          </h2>
          <p>
            Every server on this list ships as a standalone MCP binary you can
            self-install. Most of them take between five and thirty minutes to
            wire up: install, configure credentials, restart your client,
            register the tool, then start troubleshooting whatever silent
            auth failure inevitably surfaces.
          </p>
          <p>
            Multiply that by the 34 servers in this directory and you have a
            full-time job. The reason we built ToolRoute was precisely this
            math. One API key fronts all of them through a single{" "}
            <Link
              href="/docs"
              className="text-accent hover:underline"
            >
              gateway
            </Link>
            . Authentication, credit billing, rate limiting, retries, and
            protocol translation all happen upstream. Your agent calls{" "}
            <code className="text-xs bg-bg-card px-1.5 py-0.5 rounded">
              POST /api/v1/execute
            </code>{" "}
            with the tool slug and arguments, and the response comes back in
            whatever protocol you asked for — MCP Streamable HTTP, REST, A2A,
            OpenAI function calling, or a native SDK call.
          </p>
          <p>
            We still maintain and recommend the standalone servers. If you are
            building on a long-lived, single-tenant agent where install time is
            amortized over years of use, hosting them yourself is fine. If you
            are running a fleet of agents, spinning up ephemeral sessions, or
            embedding tools into a product where end users bring their own
            credentials, the gateway pattern almost always wins.
          </p>

          <h2 className="text-xl font-bold pt-4">
            How the list changes month to month
          </h2>
          <p>
            A few things trigger a re-rank:
          </p>
          <ul className="space-y-1.5 text-text-dim pl-4 list-disc">
            <li>
              A new MCP ships from an official vendor (most common cause of a
              champion swap).
            </li>
            <li>
              A provider kills a server or breaks a major version without a
              migration path (rarer, but it happens).
            </li>
            <li>
              Production usage data contradicts the paper score. A server rated
              9 that reliably returns 503s under load will get reviewed and
              demoted.
            </li>
            <li>
              A new super-category emerges. 3D modeling, avatar video, and
              observability were not meaningful agent categories two years
              ago. Now they are.
            </li>
          </ul>
          <p>
            Each change gets logged with a reason. You can see the current
            state any time at{" "}
            <Link href="/tools" className="text-accent hover:underline">
              /tools
            </Link>
            .
          </p>

          <h2 className="text-xl font-bold pt-4">FAQ</h2>

          <h3 className="text-base font-semibold pt-2">
            How many MCP servers are in the ToolRoute registry total?
          </h3>
          <p className="text-text-dim">
            87 tools across 14 categories, of which 34 expose a native MCP
            server (the rest are REST-only or SDK-based). This directory lists
            the MCP-speaking subset. The full registry including REST-only
            tools lives at{" "}
            <Link href="/tools" className="text-accent hover:underline">
              /tools
            </Link>
            .
          </p>

          <h3 className="text-base font-semibold pt-2">
            Do I have to install every server on this list?
          </h3>
          <p className="text-text-dim">
            No. You can install any of them directly from their own repos, or
            you can call all of them through a single ToolRoute API key. Both
            are supported paths.
          </p>

          <h3 className="text-base font-semibold pt-2">
            Why is server X not on the list?
          </h3>
          <p className="text-text-dim">
            Either it did not clear rating 9, it duplicates a champion in its
            category without a unique edge, or we have not scored it yet. The
            registry is open — submit a tool at{" "}
            <Link href="/tools" className="text-accent hover:underline">
              /tools
            </Link>{" "}
            and it enters the review queue.
          </p>

          <h3 className="text-base font-semibold pt-2">
            How is this different from the official MCP registry?
          </h3>
          <p className="text-text-dim">
            The official registry is open and comprehensive — every server gets
            in. This directory is opinionated and curated — only champions get
            in. Both are useful. Ours is designed for operators who want a
            short list they can build on today, not a catalog.
          </p>

          <h2 className="text-xl font-bold pt-4">One API key. All of them.</h2>
          <p>
            You can install all {totalTools} servers above yourself over the
            next weekend. You will spend most of that weekend on OAuth flows,
            rate limit retries, and config files. Or you can call every server
            in this directory through one{" "}
            <Link
              href="/docs"
              className="text-accent hover:underline"
            >
              ToolRoute API key
            </Link>
            : prepaid credits, MCP Streamable HTTP + REST + A2A + OpenAI
            Functions from the same endpoint, unified billing, and the same
            curation you just read.
          </p>
          <p>
            Start with the four-server stack, graduate to the dozen you
            actually need, and let the registry keep evolving in the
            background. That is the whole pitch.
          </p>

          <div className="border-t border-border pt-8 mt-8">
            <h3 className="font-semibold text-sm mb-4">Related reading</h3>
            <ul className="space-y-2 text-sm">
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
                  href="/blog/what-is-an-mcp-gateway"
                  className="text-accent hover:underline"
                >
                  What Is an MCP Gateway? The Infrastructure Layer AI Agents
                  Need
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
                  href="/glossary"
                  className="text-accent hover:underline"
                >
                  MCP, A2A, and agent tooling glossary
                </Link>
              </li>
            </ul>
          </div>

          <div className="border-t border-border pt-8 mt-8">
            <p className="text-text-dim">
              This directory updates as the registry evolves.{" "}
              <Link href="/tools" className="text-accent hover:underline">
                Browse all {totalTools}+ MCP servers
              </Link>{" "}
              or{" "}
              <Link href="/docs" className="text-accent hover:underline">
                grab an API key
              </Link>{" "}
              and call any of them through one gateway.
            </p>
          </div>
        </div>
      </article>
    </>
  );
}
