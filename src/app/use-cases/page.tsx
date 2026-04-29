import type { Metadata } from "next";
import Link from "next/link";
import {
  Search,
  ShieldCheck,
  PenTool,
  Mail,
  Headphones,
  Server,
  Database,
  Mic,
  ArrowRight,
  Code2,
  Globe,
  Key,
} from "lucide-react";

export const metadata: Metadata = {
  title: "MCP Gateway Use Cases — ToolRoute",
  description:
    "Real-world MCP use cases for AI agents. See how teams combine tools like Tavily, Firecrawl, Supabase, Semgrep, Playwright, and more through one API.",
  keywords: [
    "mcp use cases",
    "ai agents",
    "mcp gateway examples",
    "ai agent workflows",
    "tool orchestration",
    "mcp tools",
  ],
  alternates: {
    canonical: "/use-cases",
  },
  openGraph: {
    title: "MCP Gateway Use Cases — ToolRoute",
    description:
      "Real-world MCP use cases for AI agents. See how teams combine tools through one unified API.",
    url: "https://toolroute.ai/use-cases",
  },
};

const useCases = [
  {
    icon: Search,
    title: "AI Research Agent",
    description:
      "Build an autonomous research agent that searches the web for information, scrapes relevant pages for full content, and stores structured findings in your database. Perfect for market research, competitive analysis, and knowledge base construction.",
    tools: ["Tavily", "Firecrawl", "Supabase"],
    toolSlugs: ["tavily", "firecrawl", "supabase"],
    snippet: `const research = await toolroute.execute({
  tool: "tavily/search",
  input: { query: "AI agent frameworks 2026" }
});

for (const result of research.results) {
  const page = await toolroute.execute({
    tool: "firecrawl/scrape",
    input: { url: result.url }
  });

  await toolroute.execute({
    // BYOK required (Class-A — Supabase)
    tool: "supabase/insert",
    input: {
      table: "research_findings",
      data: { url: result.url, content: page.markdown }
    }
  });
}`,
  },
  {
    icon: ShieldCheck,
    title: "Automated Code Review",
    description:
      "Scan every pull request for security vulnerabilities, run end-to-end tests against staging, and post structured results back to GitHub. Catches OWASP Top 10 issues, broken flows, and regressions before they hit production.",
    tools: ["Semgrep", "Playwright", "GitHub"],
    toolSlugs: ["semgrep", "playwright", "github"],
    snippet: `const vulns = await toolroute.execute({
  tool: "semgrep/scan",
  input: { path: "./src", rules: "p/owasp-top-ten" }
});

const tests = await toolroute.execute({
  tool: "playwright/run-tests",
  input: { suite: "e2e", baseUrl: stagingUrl }
});

await toolroute.execute({
  tool: "github/create-comment",
  input: {
    repo: "org/app", pr: 42,
    body: formatReview(vulns, tests)
  }
});`,
  },
  {
    icon: PenTool,
    title: "Content Pipeline",
    description:
      "Generate written content with AI, produce video assets with code-driven rendering, and distribute across social channels automatically. Ideal for marketing teams shipping content at scale without manual handoffs.",
    tools: ["Claude (BYOK)", "Remotion", "Postiz"],
    toolSlugs: ["claude-api", "remotion", "postiz"],
    snippet: `// BYOK required for Claude (Class-A) — see /dashboard/byok
const article = await toolroute.execute({
  tool: "claude/chat",
  input: {
    model: "claude-sonnet-4-20250514",
    messages: [{ role: "user", content: "Write a blog post about MCP tools" }]
  }
});

const video = await toolroute.execute({
  tool: "remotion/render",
  input: { template: "blog-summary", props: article }
});

await toolroute.execute({
  // BYOK required (Class-A — Postiz)
  tool: "postiz/schedule",
  input: {
    platforms: ["twitter", "linkedin"],
    content: article.summary,
    media: video.url
  }
});`,
  },
  {
    icon: Mail,
    title: "Lead Outreach",
    description:
      "Find qualified prospects from a contact database, generate personalized outreach emails using AI that references their company and pain points, then send at scale. Each email feels hand-written because it is -- by your agent.",
    tools: ["Apollo", "Claude (BYOK)", "Resend (BYOK)"],
    toolSlugs: ["apollo", "claude-api", "resend"],
    snippet: `const leads = await toolroute.execute({
  tool: "apollo/search-contacts",
  input: { title: "CTO", industry: "SaaS", limit: 50 }
});

for (const lead of leads.contacts) {
  // BYOK required for Claude + Resend (Class-A premium providers)
  const email = await toolroute.execute({
    tool: "claude/chat",
    input: {
      messages: [{ role: "user", content: \`Personalized cold email for \${lead.name}
        at \${lead.company}. Pain: tool sprawl.\` }]
    }
  });

  await toolroute.execute({
    // BYOK required (Class-A — Resend)
    tool: "resend/send-email",
    input: { to: lead.email, subject: email.subject, html: email.body }
  });
}`,
  },
  {
    icon: Headphones,
    title: "Customer Support Bot",
    description:
      "Search your documentation for relevant answers, query your database for customer-specific data, and compose accurate replies. Resolves tier-1 tickets instantly while escalating edge cases to humans with full context attached.",
    tools: ["Context7", "Supabase", "Resend (BYOK)"],
    toolSlugs: ["context7", "supabase", "resend"],
    snippet: `const docs = await toolroute.execute({
  // BYOK required (Class-A — Context7)
  tool: "context7/search",
  input: { query: ticket.question, library: "your-docs" }
});

const customer = await toolroute.execute({
  tool: "supabase/query",
  input: {
    sql: "SELECT * FROM customers WHERE email = $1",
    params: [ticket.email]
  }
});

const reply = await generateReply(docs, customer, ticket);

// BYOK required for Resend (Class-A premium provider)
await toolroute.execute({
  tool: "resend/send-email",
  input: { to: ticket.email, subject: \`Re: \${ticket.subject}\`, html: reply }
});`,
  },
  {
    icon: Server,
    title: "DevOps Automation",
    description:
      "Deploy your application, monitor for errors in real-time, and alert the right team when something breaks. Close the loop from commit to production to incident response with zero manual steps.",
    tools: ["Vercel", "Sentry", "Twilio"],
    toolSlugs: ["vercel", "sentry", "twilio"],
    snippet: `const deploy = await toolroute.execute({
  tool: "vercel/deploy",
  input: { project: "my-app", branch: "main" }
});

// Monitor for 5 minutes post-deploy
const errors = await toolroute.execute({
  // BYOK required (Class-A — Sentry)
  tool: "sentry/query",
  input: {
    project: "my-app",
    query: "is:unresolved firstSeen:-5m"
  }
});

if (errors.issues.length > 0) {
  await toolroute.execute({
    tool: "twilio/send-sms",
    input: {
      to: "+1234567890",
      body: \`Deploy alert: \${errors.issues.length} new errors\`
    }
  });
}`,
  },
  {
    icon: Database,
    title: "Data Enrichment",
    description:
      "Scrape company websites for firmographic data, enrich contact records with verified emails and titles, and store everything in your CRM database. Turns a list of domains into a fully enriched sales pipeline overnight.",
    tools: ["Firecrawl", "Apollo", "Supabase"],
    toolSlugs: ["firecrawl", "apollo", "supabase"],
    snippet: `const domains = ["acme.com", "initech.com", "globex.com"];

for (const domain of domains) {
  const site = await toolroute.execute({
    tool: "firecrawl/scrape",
    input: { url: \`https://\${domain}\` }
  });

  const contacts = await toolroute.execute({
    tool: "apollo/enrich-company",
    input: { domain, fields: ["employees", "revenue", "tech_stack"] }
  });

  await toolroute.execute({
    // BYOK required (Class-A — Supabase)
    tool: "supabase/upsert",
    input: {
      table: "enriched_leads",
      data: { domain, about: site.markdown, ...contacts }
    }
  });
}`,
  },
  {
    icon: Mic,
    title: "Voice AI Agent",
    description:
      "Transcribe incoming audio with speech-to-text, process the transcript through AI to understand intent and generate a response, then convert the reply back to natural speech. Build phone bots, voice assistants, and audio interfaces.",
    tools: ["Whisper STT (BYOK)", "Claude (BYOK)", "ElevenLabs TTS (BYOK)"],
    toolSlugs: ["whisper", "claude-api", "elevenlabs"],
    snippet: `// BYOK required for Whisper (STT) + Claude + ElevenLabs (Class-A premium providers)
const transcript = await toolroute.execute({
  tool: "whisper/transcribe",
  input: { audio: incomingAudioBuffer }
});

const response = await toolroute.execute({
  tool: "claude/chat",
  input: {
    model: "claude-sonnet-4-20250514",
    system: "You are a helpful phone assistant.",
    messages: [{ role: "user", content: transcript.text }]
  }
});

const speech = await toolroute.execute({
  // BYOK required (Class-A — ElevenLabs)
  tool: "elevenlabs/text-to-speech",
  input: {
    text: response.content,
    voice: "rachel",
    model: "eleven_multilingual_v2"
  }
});`,
  },
];

export default function UseCasesPage() {
  return (
    <div className="space-y-16 pb-16">
      {/* Hero */}
      <section className="text-center pt-12 pb-4">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4 leading-[1.1]">
          What you can <span className="text-accent">build</span>
        </h1>
        <p className="text-text-dim max-w-2xl mx-auto text-sm sm:text-base leading-relaxed mb-8">
          Real-world workflows that combine multiple tools through one API key.
          Each use case chains 2-3 ToolRoute calls into a complete pipeline your
          agent runs autonomously.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
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
            <Code2 className="w-4 h-4" />
            Implementation Guide
          </Link>
        </div>
      </section>

      {/* Use Case Cards */}
      <section className="space-y-8">
        {useCases.map((uc, i) => {
          const Icon = uc.icon;
          return (
            <div
              key={i}
              className="border border-border rounded-lg bg-bg-card overflow-hidden"
            >
              <div className="grid lg:grid-cols-2 gap-0">
                {/* Left: info */}
                <div className="p-6 sm:p-8 flex flex-col">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <div className="text-[10px] text-accent font-mono mb-0.5">
                        {String(i + 1).padStart(2, "0")}
                      </div>
                      <h2 className="font-semibold text-base">{uc.title}</h2>
                    </div>
                  </div>
                  <p className="text-sm text-text-dim leading-relaxed mb-6">
                    {uc.description}
                  </p>

                  {/* Tools used */}
                  <div className="mb-6">
                    <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">
                      Tools Used
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {uc.tools.map((tool, j) => (
                        <Link
                          key={j}
                          href={`/tools`}
                          className="inline-flex items-center gap-1.5 text-xs border border-border rounded px-2.5 py-1 text-text-dim hover:border-accent/40 hover:text-accent transition-colors"
                        >
                          <Globe className="w-3 h-3" />
                          {tool}
                        </Link>
                      ))}
                    </div>
                  </div>

                  <div className="mt-auto">
                    <Link
                      href="/docs"
                      className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
                    >
                      View implementation guide{" "}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>

                {/* Right: code snippet */}
                <div className="bg-[#0d0d18] border-t lg:border-t-0 lg:border-l border-border">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-bg-card/50">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red/40" />
                      <div className="w-2.5 h-2.5 rounded-full bg-amber/40" />
                      <div className="w-2.5 h-2.5 rounded-full bg-green/40" />
                    </div>
                    <span className="text-[10px] text-text-muted ml-2">
                      {uc.title.toLowerCase().replace(/\s+/g, "-")}.ts
                    </span>
                  </div>
                  <pre className="p-4 text-xs leading-relaxed overflow-x-auto max-h-[360px] overflow-y-auto">
                    <code className="text-text-dim">{uc.snippet}</code>
                  </pre>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* CTA */}
      <section className="border border-border rounded-lg bg-bg-card p-8 text-center">
        <h2 className="text-2xl font-bold mb-3">
          Ready to build your pipeline?
        </h2>
        <p className="text-text-dim text-sm max-w-xl mx-auto leading-relaxed mb-6">
          One API key gives you access to 70+ tools. Chain them together however
          you want. No separate accounts, no key management, no vendor lock-in.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold px-6 py-3 rounded-lg transition-colors text-sm"
          >
            <Key className="w-4 h-4" />
            Get Started Free
          </Link>
          <Link
            href="/tools"
            className="inline-flex items-center gap-2 border border-border hover:border-accent/40 text-text px-6 py-3 rounded-lg transition-colors text-sm"
          >
            Browse All Tools
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
