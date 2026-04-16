import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Calendar, Clock } from "lucide-react";

export const metadata: Metadata = {
  title: "Blog — ToolRoute",
  description:
    "Guides, benchmarks, and deep dives on MCP servers, AI agent tools, and the tool infrastructure powering modern AI applications.",
  alternates: { canonical: "/blog" },
};

const posts = [
  {
    slug: "mcp-gateway-vs-api-gateway",
    title: "MCP Gateway vs API Gateway: What AI Agents Actually Need",
    description:
      "API gateways manage REST traffic. MCP gateways manage AI tool calls. Different problem, different solution. Here is why you cannot just put Kong in front of MCP.",
    date: "2026-04-16",
    readTime: "9 min",
    keywords: ["MCP gateway", "API gateway", "Kong", "AI infrastructure"],
  },
  {
    slug: "build-ai-agent-multiple-tools",
    title: "How to Build an AI Agent That Uses 50+ Tools",
    description:
      "One tool is easy. Fifty tools is an infrastructure problem. Step-by-step guide to discovery, authentication, routing, error handling, and billing at scale.",
    date: "2026-04-16",
    readTime: "10 min",
    keywords: ["AI agent", "multi-tool", "MCP", "tutorial"],
  },
  {
    slug: "what-is-an-mcp-gateway",
    title: "What Is an MCP Gateway? The Infrastructure Layer AI Agents Need",
    description:
      "MCP registries list tools. MCP gateways execute them. Learn how gateways handle authentication, billing, and routing so your agents can call any tool through one API.",
    date: "2026-04-16",
    readTime: "8 min",
    keywords: ["MCP gateway", "Model Context Protocol", "AI infrastructure"],
  },
  {
    slug: "best-mcp-servers-ai-agents-2026",
    title:
      "Best MCP Servers for AI Agents in 2026: 87 Tools Rated and Compared",
    description:
      "We tested and scored 87 MCP-compatible tools across 14 categories. Here are the champions in each category, with real scores and usage data.",
    date: "2026-04-16",
    readTime: "12 min",
    keywords: ["MCP servers", "AI agents", "tool comparison"],
  },
  {
    slug: "use-mcp-tools-without-managing-servers",
    title: "How to Use MCP Tools Without Managing Servers",
    description:
      "Skip the server setup. Learn how unified tool APIs let AI agents execute MCP tools through a single endpoint with one API key, prepaid credits, and zero infrastructure.",
    date: "2026-04-16",
    readTime: "6 min",
    keywords: ["MCP tools", "serverless", "API gateway"],
  },
];

export default function BlogIndex() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-4">Blog</h1>
        <p className="text-text-dim text-sm leading-relaxed max-w-2xl">
          Guides, benchmarks, and deep dives on MCP servers, AI agent tools, and
          the infrastructure powering modern AI.
        </p>
      </div>

      <div className="space-y-6">
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="block group border border-border rounded-lg p-6 hover:border-accent/40 transition-colors"
          >
            <div className="flex items-center gap-4 text-xs text-text-muted mb-3">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3 h-3" />
                {post.date}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                {post.readTime}
              </span>
            </div>
            <h2 className="text-lg font-semibold mb-2 group-hover:text-accent transition-colors">
              {post.title}
            </h2>
            <p className="text-text-dim text-sm leading-relaxed mb-3">
              {post.description}
            </p>
            <span className="inline-flex items-center gap-1 text-accent text-xs font-medium">
              Read article <ArrowRight className="w-3 h-3" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
