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
    slug: "context7-documentation-mcp-review",
    title: "Context7 MCP Server Review: Why Every AI Coding Session Needs It",
    description:
      "Deep review of Context7, the #1 MCP server with 50K+ GitHub stars. How it eliminates doc hallucination with version-specific docs injected into prompts.",
    date: "2026-04-16",
    readTime: "9 min",
    keywords: ["Context7", "MCP server", "documentation", "AI coding"],
  },
  {
    slug: "vercel-vs-netlify-ai-deployment",
    title: "Vercel vs Netlify for AI Applications: Which Platform Wins in 2026?",
    description:
      "Vercel vs Netlify for AI apps. MCP support, edge functions, AI SDK, pricing, and why Vercel became the default for AI agent deployment.",
    date: "2026-04-16",
    readTime: "10 min",
    keywords: ["Vercel", "Netlify", "AI deployment", "edge functions"],
  },
  {
    slug: "stripe-vs-square-payment-api",
    title: "Stripe vs Square API for AI Agents: Payment Processing Compared",
    description:
      "Stripe vs Square compared for AI agent payment workflows. API design, MCP support, subscriptions, global coverage, and which wins for SaaS vs retail.",
    date: "2026-04-16",
    readTime: "10 min",
    keywords: ["Stripe", "Square", "payment API", "AI agents", "MCP"],
  },
  {
    slug: "elevenlabs-vs-amazon-polly-tts",
    title: "ElevenLabs vs Amazon Polly: Best Text-to-Speech API for AI Agents",
    description:
      "ElevenLabs vs Amazon Polly compared for AI voice agents. Voice quality, cloning, pricing, latency, and when to use each one.",
    date: "2026-04-16",
    readTime: "10 min",
    keywords: ["ElevenLabs", "Amazon Polly", "TTS", "text-to-speech", "AI voice"],
  },
  {
    slug: "tavily-vs-firecrawl-vs-brave-search",
    title: "Tavily vs Firecrawl vs Brave Search API: Which Search Tool Do AI Agents Actually Need?",
    description:
      "Head-to-head comparison of Tavily, Firecrawl, and Brave Search API for AI agents. Pricing, MCP support, latency, and when to use each one.",
    date: "2026-04-16",
    readTime: "11 min",
    keywords: ["Tavily", "Firecrawl", "Brave Search", "search API", "AI agents", "MCP"],
  },
  {
    slug: "resend-vs-sendgrid-email-api",
    title: "Resend vs SendGrid for AI Agents: Which Email API Should Your Agent Use?",
    description:
      "Resend vs SendGrid compared for AI agent email workflows. API design, pricing, deliverability, MCP support, and developer experience.",
    date: "2026-04-16",
    readTime: "9 min",
    keywords: ["Resend", "SendGrid", "email API", "AI agents", "MCP", "deliverability"],
  },
  {
    slug: "playwright-vs-puppeteer-vs-selenium",
    title: "Playwright vs Puppeteer vs Selenium for AI Agents in 2026: Which Wins?",
    description:
      "Three-way comparison of Playwright, Puppeteer, and Selenium for AI agent browser automation. MCP support, snapshots, and real data.",
    date: "2026-04-16",
    readTime: "11 min",
    keywords: ["Playwright", "Puppeteer", "Selenium", "browser automation", "AI agents", "MCP"],
  },
  {
    slug: "supabase-vs-firebase-ai-apps",
    title: "Supabase vs Firebase for AI Applications in 2026: Which Database Should Your Agents Use?",
    description:
      "Supabase vs Firebase for AI agent workflows. SQL vs NoSQL, MCP support, pricing, and real production data from 50 observations.",
    date: "2026-04-16",
    readTime: "9 min",
    keywords: ["Supabase", "Firebase", "database", "AI agents", "MCP", "backend"],
  },
  {
    slug: "composio-vs-zapier-ai-automation",
    title: "Composio vs Zapier MCP: Which AI Agent Automation Platform Should You Use?",
    description:
      "Composio handles OAuth for 60+ apps. Zapier MCP connects to 7,000+. Breakdown of when to use each for AI agent automation.",
    date: "2026-04-16",
    readTime: "10 min",
    keywords: ["Composio", "Zapier", "automation", "AI agents", "OAuth", "MCP"],
  },
  {
    slug: "elevenlabs-vs-amazon-polly-tts",
    title: "ElevenLabs vs Amazon Polly: Which Text-to-Speech AI Should Your Agent Use?",
    description:
      "ElevenLabs vs Amazon Polly for AI agent TTS. Voice quality, pricing, cloning, MCP support, latency, and language coverage compared.",
    date: "2026-04-16",
    readTime: "9 min",
    keywords: ["ElevenLabs", "Amazon Polly", "text-to-speech", "TTS", "AI agents", "voice"],
  },
  {
    slug: "vercel-vs-netlify-ai-deployment",
    title: "Vercel vs Netlify for AI Applications Deployment in 2026: Which Platform Wins?",
    description:
      "Vercel vs Netlify for AI app deployment. MCP server support, AI SDK, edge functions, framework integration, and pricing compared.",
    date: "2026-04-16",
    readTime: "10 min",
    keywords: ["Vercel", "Netlify", "deployment", "AI applications", "edge functions", "MCP"],
  },
  {
    slug: "mcp-auto-routing-ai-agent-tools",
    title: "MCP Auto-Routing for AI Agent Tools: Let the Gateway Pick the Right Tool",
    description:
      "Most MCP tool calls require agents to know exact tool names. Auto-routing lets agents describe what they need and the gateway selects the best tool using semantic matching, beliefs, and fallback chains.",
    date: "2026-04-16",
    readTime: "9 min",
    keywords: ["MCP auto routing", "AI agent tools", "auto-routing", "gateway", "tool selection", "belief system"],
  },
  {
    slug: "a2a-vs-mcp-protocol-comparison",
    title: "A2A vs MCP: Comparing Google's Agent-to-Agent Protocol and Anthropic's Model Context Protocol",
    description:
      "Google's A2A protocol connects agents to agents. Anthropic's MCP connects agents to tools. Compare purpose, transport, discovery, auth, and use cases to decide when to use each protocol.",
    date: "2026-04-16",
    readTime: "12 min",
    keywords: ["A2A", "MCP", "Google", "Anthropic", "protocol comparison", "AI agents"],
  },
  {
    slug: "self-hosted-vs-cloud-mcp-servers",
    title: "Self-Hosted vs Cloud MCP Servers: Pros, Cons, and Decision Matrix",
    description:
      "Should you run MCP servers yourself or use a cloud gateway? Honest comparison of setup time, maintenance, scaling, security, and cost at 1, 10, and 50 tools.",
    date: "2026-04-16",
    readTime: "8 min",
    keywords: ["self-hosted", "cloud", "MCP servers", "decision matrix", "infrastructure"],
  },
  {
    slug: "openai-agents-mcp-tools",
    title: "OpenAI Agents SDK + MCP Tools Integration: The Missing Bridge",
    description:
      "OpenAI's Agents SDK doesn't natively support MCP. Use ToolRoute's OpenAI-compatible endpoint to bridge MCP tools into function calling with one gateway.",
    date: "2026-04-15",
    readTime: "10 min",
    keywords: ["OpenAI Agents SDK", "MCP tools", "function calling", "integration", "gateway"],
  },
  {
    slug: "claude-code-mcp-server-setup",
    title: "Claude Code MCP Server Setup: 3 Ways to Connect Tools (2026 Guide)",
    description:
      "Step-by-step guide to connecting MCP tools to Claude Code. Compare direct stdio servers, HTTP hub transport, and the ToolRoute gateway for one-config access to 87 tools.",
    date: "2026-04-16",
    readTime: "8 min",
    keywords: ["Claude Code", "MCP server setup", "mcp.json", "stdio", "HTTP transport", "gateway"],
  },
  {
    slug: "mcp-vs-rest-api-ai-agents",
    title: "MCP vs REST APIs for AI Agents: When to Use Which",
    description:
      "REST APIs power the web. MCP powers AI tool use. A side-by-side comparison of protocols, discovery, auth, and composability for agent builders.",
    date: "2026-04-16",
    readTime: "9 min",
    keywords: ["MCP vs REST", "AI agents", "API comparison", "Model Context Protocol"],
  },
  {
    slug: "ai-agent-tool-billing-credits",
    title: "AI Agent Tool Billing: How Credits, Metering, and Cost Control Work",
    description:
      "AI agents call tools that cost money. Learn how prepaid credits, per-call metering, spend limits, and auto-top-up keep agent costs predictable.",
    date: "2026-04-16",
    readTime: "8 min",
    keywords: ["AI billing", "tool credits", "metering", "cost control", "MCP gateway"],
  },
  {
    slug: "bring-your-own-key-mcp-byok",
    title: "Bring Your Own Key (BYOK) for MCP Tools: How It Works",
    description:
      "Use your existing API keys through an MCP gateway. BYOK gives you unified routing and logging without paying markup on tools you already own.",
    date: "2026-04-16",
    readTime: "7 min",
    keywords: ["BYOK", "bring your own key", "MCP tools", "API keys", "gateway"],
  },
  {
    slug: "what-is-model-context-protocol",
    title: "What Is Model Context Protocol (MCP)? The Complete Guide for 2026",
    description:
      "MCP is the open standard that lets AI agents call external tools. Learn how MCP works, its architecture, transport types, and why it matters.",
    date: "2026-04-15",
    readTime: "10 min",
    keywords: ["Model Context Protocol", "MCP", "AI tools", "Anthropic", "open standard"],
  },
  {
    slug: "mcp-server-security-best-practices",
    title: "MCP Server Security Best Practices 2026: Protect Your AI Agent Infrastructure",
    description:
      "MCP servers give agents access to databases and APIs. Learn authentication, authorization, input validation, rate limiting, and audit logging.",
    date: "2026-04-16",
    readTime: "10 min",
    keywords: ["MCP security", "AI agent security", "input validation", "audit logging"],
  },
  {
    slug: "mcp-tools-for-developers",
    title: "MCP Tools for Developers in 2026: The Complete Workflow Guide",
    description:
      "The 8 MCP tools developers actually use daily, organized by workflow stage: Code, Test, Deploy, Monitor. Real registry data and chain examples.",
    date: "2026-04-15",
    readTime: "11 min",
    keywords: ["MCP tools", "developer workflow", "Semgrep", "Playwright", "Context7"],
  },
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
