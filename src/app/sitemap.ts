import type { MetadataRoute } from "next";
import { getTools, getComposites } from "@/lib/api";
import { SUPER_CATEGORIES } from "@/lib/types";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://toolroute.ai";

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date('2026-04-13'),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/tools`,
      lastModified: new Date('2026-04-13'),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/docs`,
      lastModified: new Date('2026-04-13'),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: new Date('2026-04-13'),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/skills`,
      lastModified: new Date('2026-04-13'),
      changeFrequency: "daily",
      priority: 0.85,
    },
    {
      url: `${baseUrl}/categories`,
      lastModified: new Date('2026-03-15'),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/composites`,
      lastModified: new Date('2026-03-15'),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/discover`,
      lastModified: new Date('2026-03-20'),
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/use-cases`,
      lastModified: new Date('2026-04-15'),
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${baseUrl}/integrations`,
      lastModified: new Date('2026-04-15'),
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${baseUrl}/playground`,
      lastModified: new Date('2026-04-13'),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/status`,
      lastModified: new Date('2026-04-13'),
      changeFrequency: "hourly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/glossary`,
      lastModified: new Date('2026-04-15'),
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${baseUrl}/faq`,
      lastModified: new Date('2026-04-16'),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/mcp-statistics`,
      lastModified: new Date('2026-04-16'),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date('2026-04-16'),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/what-is-an-mcp-gateway`,
      lastModified: new Date('2026-04-16'),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/best-mcp-servers-ai-agents-2026`,
      lastModified: new Date('2026-04-16'),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/use-mcp-tools-without-managing-servers`,
      lastModified: new Date('2026-04-16'),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/mcp-gateway-vs-api-gateway`,
      lastModified: new Date('2026-04-16'),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/build-ai-agent-multiple-tools`,
      lastModified: new Date('2026-04-16'),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/what-is-model-context-protocol`,
      lastModified: new Date('2026-04-16'),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/blog/mcp-server-security-best-practices`,
      lastModified: new Date('2026-04-16'),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/mcp-tools-for-developers`,
      lastModified: new Date('2026-04-16'),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/mcp-vs-rest-api-ai-agents`,
      lastModified: new Date('2026-04-16'),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/ai-agent-tool-billing-credits`,
      lastModified: new Date('2026-04-16'),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/bring-your-own-key-mcp-byok`,
      lastModified: new Date('2026-04-16'),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/claude-code-mcp-server-setup`,
      lastModified: new Date('2026-04-16'),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/openai-agents-mcp-tools`,
      lastModified: new Date('2026-04-16'),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/a2a-vs-mcp-protocol-comparison`,
      lastModified: new Date('2026-04-16'),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/self-hosted-vs-cloud-mcp-servers`,
      lastModified: new Date('2026-04-16'),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/tavily-vs-firecrawl-vs-brave-search`,
      lastModified: new Date('2026-04-16'),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/resend-vs-sendgrid-email-api`,
      lastModified: new Date('2026-04-16'),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/playwright-vs-puppeteer-vs-selenium`,
      lastModified: new Date('2026-04-16'),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/supabase-vs-firebase-ai-apps`,
      lastModified: new Date('2026-04-16'),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/composio-vs-zapier-ai-automation`,
      lastModified: new Date('2026-04-16'),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/context7-documentation-mcp-review`,
      lastModified: new Date('2026-04-16'),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/vercel-vs-netlify-ai-deployment`,
      lastModified: new Date('2026-04-16'),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/stripe-vs-square-payment-api`,
      lastModified: new Date('2026-04-16'),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/elevenlabs-vs-amazon-polly-tts`,
      lastModified: new Date('2026-04-16'),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/twilio-vs-vonage-sms-api`,
      lastModified: new Date('2026-04-16'),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/assemblyai-vs-whisper-speech-to-text`,
      lastModified: new Date('2026-04-16'),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/github-vs-gitlab-ai-agents`,
      lastModified: new Date('2026-04-16'),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/sentry-vs-datadog-vs-posthog`,
      lastModified: new Date('2026-04-16'),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/mcp-server-list-directory-2026`,
      lastModified: new Date('2026-04-16'),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/blog/how-to-choose-mcp-tool-ai-agent`,
      lastModified: new Date('2026-04-15'),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/oauth-for-ai-agents-composio-vs-manual`,
      lastModified: new Date('2026-04-15'),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/how-ai-agents-handle-tool-failures`,
      lastModified: new Date('2026-04-15'),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/how-to-debug-mcp-tool-calls`,
      lastModified: new Date('2026-04-15'),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/mcp-tool-caching-best-practices`,
      lastModified: new Date('2026-04-15'),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/building-custom-mcp-servers-guide`,
      lastModified: new Date('2026-04-15'),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/mcp-stdio-vs-http-hub`,
      lastModified: new Date('2026-04-15'),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/blog/mcp-gateway-for-claude-code`,
      lastModified: new Date('2026-04-15'),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/blog/check-before-build-mcp-tool-pattern`,
      lastModified: new Date('2026-04-15'),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/changelog`,
      lastModified: new Date('2026-04-16'),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/compare`,
      lastModified: new Date('2026-04-15'),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/alternatives`,
      lastModified: new Date('2026-04-15'),
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${baseUrl}/dashboard`,
      lastModified: new Date('2026-04-13'),
      changeFrequency: "weekly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/dashboard/keys`,
      lastModified: new Date('2026-04-13'),
      changeFrequency: "weekly",
      priority: 0.4,
    },
    {
      url: `${baseUrl}/dashboard/usage`,
      lastModified: new Date('2026-04-13'),
      changeFrequency: "weekly",
      priority: 0.4,
    },
    {
      url: `${baseUrl}/dashboard/billing`,
      lastModified: new Date('2026-04-13'),
      changeFrequency: "weekly",
      priority: 0.4,
    },
  ];

  // Dynamic tool pages + alternatives pages (same source)
  let toolPages: MetadataRoute.Sitemap = [];
  let alternativesPages: MetadataRoute.Sitemap = [];
  try {
    const tools = await getTools();
    toolPages = tools.map((tool) => ({
      url: `${baseUrl}/tools/${tool.slug}`,
      lastModified: new Date(tool.updated_at || tool.created_at),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
    alternativesPages = tools
      .filter((tool) => tool.rating >= 9)
      .map((tool) => ({
        url: `${baseUrl}/alternatives/${tool.slug}`,
        lastModified: new Date('2026-04-15'),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      }));
  } catch {
    // Supabase unavailable at build time — skip dynamic tool pages
  }

  // Dynamic category pages
  const categoryPages: MetadataRoute.Sitemap = SUPER_CATEGORIES.map((sc) => ({
    url: `${baseUrl}/categories/${sc.key}`,
    lastModified: new Date('2026-03-15'),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  // Dynamic "Best [Category] Tools" programmatic SEO pages
  const categoryBestPages: MetadataRoute.Sitemap = SUPER_CATEGORIES.map((sc) => ({
    url: `${baseUrl}/categories/${sc.key}/best`,
    lastModified: new Date('2026-04-15'),
    changeFrequency: "weekly" as const,
    priority: 0.85,
  }));

  // Dynamic protocol pages (MCP, REST, A2A, GraphQL, OpenAPI, Skill, CLI, NPM)
  const protocolKeys = ["mcp", "rest", "a2a", "graphql", "openapi", "skill", "cli", "npm"];
  const protocolPages: MetadataRoute.Sitemap = protocolKeys.map((key) => ({
    url: `${baseUrl}/protocols/${key}`,
    lastModified: new Date('2026-04-15'),
    changeFrequency: "weekly" as const,
    priority: 0.85,
  }));

  // Dynamic composite pages
  let compositePages: MetadataRoute.Sitemap = [];
  try {
    const composites = await getComposites();
    compositePages = composites.map((comp) => ({
      url: `${baseUrl}/composites/${comp.id}`,
      lastModified: new Date(comp.created_at),
      changeFrequency: "weekly" as const,
      priority: 0.5,
    }));
  } catch {
    // Supabase unavailable at build time — skip dynamic composite pages
  }

  return [
    ...staticPages,
    ...toolPages,
    ...categoryPages,
    ...categoryBestPages,
    ...protocolPages,
    ...alternativesPages,
    ...compositePages,
  ];
}
