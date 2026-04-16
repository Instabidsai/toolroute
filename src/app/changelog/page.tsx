import type { Metadata } from "next";
import { Rocket, Wrench, Bug, Zap } from "lucide-react";

export const metadata: Metadata = {
  title: "Changelog — ToolRoute",
  description:
    "Track every update to ToolRoute's MCP gateway, tool registry, and API.",
  alternates: {
    canonical: "/changelog",
  },
  openGraph: {
    title: "Changelog — ToolRoute",
    description:
      "Track every update to ToolRoute's MCP gateway, tool registry, and API.",
    url: "https://toolroute.ai/changelog",
  },
};

/* ---------- Types ---------- */
type Badge = "feature" | "improvement" | "fix";

interface ChangelogEntry {
  date: string;
  title: string;
  badge: Badge;
  bullets: string[];
}

interface MonthGroup {
  month: string;
  entries: ChangelogEntry[];
}

/* ---------- Badge component ---------- */
function BadgePill({ type }: { type: Badge }) {
  const styles: Record<Badge, { bg: string; text: string; label: string }> = {
    feature: {
      bg: "bg-accent/15",
      text: "text-accent",
      label: "Feature",
    },
    improvement: {
      bg: "bg-blue-500/15",
      text: "text-blue-400",
      label: "Improvement",
    },
    fix: {
      bg: "bg-amber-500/15",
      text: "text-amber-400",
      label: "Fix",
    },
  };
  const s = styles[type];
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}
    >
      {type === "feature" && <Rocket className="w-3 h-3" />}
      {type === "improvement" && <Wrench className="w-3 h-3" />}
      {type === "fix" && <Bug className="w-3 h-3" />}
      {s.label}
    </span>
  );
}

/* ---------- Changelog data ---------- */
const changelog: MonthGroup[] = [
  {
    month: "April 2026",
    entries: [
      {
        date: "April 16",
        title: "Blog launch, SEO content, and product positioning",
        badge: "feature",
        bullets: [
          "Published 16 SEO articles covering MCP gateways, tool comparisons, security, BYOK, protocol deep dives, and integration guides",
          "Added llms.txt and llms-full.txt for AI model discovery (GEO optimization)",
          "Launched glossary page with 40+ MCP and tool infrastructure terms",
          "Added use cases page showing real agent workflows",
          "Shipped compare page positioning ToolRoute against alternatives",
          "Full cross-linking across all blog posts, glossary, and product pages",
          "Tool schema markup on all tool pages for rich search results",
        ],
      },
      {
        date: "April 15",
        title: "87 tools, auto-top-up billing, and E2E test suite",
        badge: "feature",
        bullets: [
          "Registry grew to 87 tools across 14 categories",
          "Auto-top-up billing: set a threshold and credits refill automatically via Stripe",
          "Settings API (PATCH /api/v1/settings) for programmatic billing configuration",
          "39 end-to-end tests covering execute, billing, BYOK, and error paths",
          "Auto-router gracefully handles missing API keys instead of hard failing",
          "Stripe webhook secret deployed for production payment events",
        ],
      },
      {
        date: "April 14",
        title: "47 adapters, social tools, agent discovery, and video AI",
        badge: "feature",
        bullets: [
          "Expanded to 51 adapters: added Exa, Tavily, Twitter/X, LinkedIn, YouTube, Slack, Notion, HubSpot CRM, Google Sheets, and Linear",
          "Higgsfield adapter: 30+ AI video and image generation models through one API",
          "Skills Directory launched: agents discover tools AND reusable skills in one place",
          "Multi-protocol agent discovery: MCP Streamable HTTP, A2A, and OpenAI function calling format",
          "Interactive API playground at /playground for live tool testing",
          "SDK files and status page for monitoring uptime",
          "Fixed 11 critical/high bugs identified in a 4-team security audit",
        ],
      },
      {
        date: "April 13",
        title: "API gateway launch: the OpenRouter for Tools",
        badge: "feature",
        bullets: [
          "Transformed ToolRoute from a static registry into a live API gateway",
          "Unified execute endpoint (POST /api/v1/execute) routes to any tool with one API key",
          "5 protocols supported: REST, MCP Streamable HTTP, A2A (Google), OpenAI Functions, and direct SDKs",
          "Launched with 40 adapters covering AI, search, voice, email, image, video, content, business, and data categories",
          "BYOK (Bring Your Own Key) dashboard: use existing provider keys with zero markup",
          "Auto-routing picks the best adapter for each request",
          "14 adapters with MCP execute support, master key pooling, and admin endpoints",
          "OpenAPI spec v1.2.0 published: 13 paths, 35 schemas, full adapter documentation",
          "Context7 adapter rewritten with Playwright PDF fallback",
        ],
      },
    ],
  },
  {
    month: "March 2026",
    entries: [
      {
        date: "March 29",
        title: "SEO foundation and Google OAuth",
        badge: "improvement",
        bullets: [
          "Google Sign-in button for one-click authentication",
          "Agent discovery files: llms.txt, OpenAPI schema, robots.txt, and XML sitemap",
          "A2A agent.json endpoint for Google Agent-to-Agent protocol discovery",
          "Dynamic OG images for social sharing",
          "Fixed AIO (AI Optimization) SEO gaps across all public pages",
        ],
      },
      {
        date: "March 27",
        title: "Initial registry with MCP server and 50 tools",
        badge: "feature",
        bullets: [
          "Initial ToolRoute build on Next.js 16 with Supabase backend",
          "MCP server with 7 tools: check_before_build, search_tools, get_category_champion, record_usage, register_tool, get_tool_detail, and list_categories",
          "50 curated tools seeded with belief scores and category rankings",
          "Belief system: every tool rated on reliability, speed, cost, and developer experience",
          "Published llms.txt and OpenAPI spec for AI-native discovery",
        ],
      },
    ],
  },
];

/* ---------- Page ---------- */
export default function ChangelogPage() {
  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-accent/10">
            <Zap className="w-5 h-5 text-accent" />
          </div>
          <h1 className="text-4xl font-bold">Changelog</h1>
        </div>
        <p className="text-text-dim text-sm leading-relaxed max-w-2xl">
          Every update to ToolRoute&apos;s MCP gateway, tool registry, API, and
          infrastructure. Most recent first.
        </p>
      </div>

      {/* Timeline */}
      <div className="space-y-16">
        {changelog.map((group) => (
          <section key={group.month}>
            <h2 className="text-xl font-bold mb-8 text-text-dim">
              {group.month}
            </h2>

            <div className="space-y-0">
              {group.entries.map((entry, i) => (
                <div
                  key={`${group.month}-${i}`}
                  className="relative pl-8 pb-10 last:pb-0 border-l-2 border-border"
                >
                  {/* Timeline dot */}
                  <div className="absolute -left-[7px] top-0.5 w-3 h-3 rounded-full bg-accent border-2 border-bg" />

                  {/* Date + badge */}
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <span className="text-xs text-text-muted font-medium">
                      {entry.date}
                    </span>
                    <BadgePill type={entry.badge} />
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-semibold mb-3">{entry.title}</h3>

                  {/* Bullets */}
                  <ul className="space-y-2">
                    {entry.bullets.map((bullet, j) => (
                      <li
                        key={j}
                        className="text-sm text-text-dim leading-relaxed pl-4 relative before:content-[''] before:absolute before:left-0 before:top-[9px] before:w-1.5 before:h-1.5 before:rounded-full before:bg-border"
                      >
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Footer note */}
      <div className="mt-16 pt-8 border-t border-border">
        <p className="text-xs text-text-muted text-center">
          ToolRoute is actively maintained and updated multiple times per week.
          Follow our{" "}
          <a
            href="https://github.com/Instabidsai/toolroute"
            className="text-accent hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub repository
          </a>{" "}
          for commit-level detail.
        </p>
      </div>
    </div>
  );
}
