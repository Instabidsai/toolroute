import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "ToolRoute — The OpenRouter for Tools",
  description:
    "50 curated best-in-class tools for AI agents. Search, discover, compose. The missing capability layer.",
  metadataBase: new URL("https://toolroute.ai"),
  authors: [{ name: "ToolRoute Team", url: "https://toolroute.ai" }],
  alternates: {
    canonical: "/",
    types: {
      "application/json": [
        { url: "/.well-known/openapi.json", title: "OpenAPI 3.1 spec" },
        { url: "/.well-known/ai-plugin.json", title: "ChatGPT plugin manifest" },
        { url: "/.well-known/mcp.json", title: "MCP server manifest" },
        { url: "/.well-known/agent-card.json", title: "A2A agent card" },
        { url: "/agents.json", title: "Agent capability index" },
      ],
      "text/plain": [
        { url: "/llms.txt", title: "LLM summary" },
        { url: "/llms-full.txt", title: "LLM full reference" },
      ],
    },
  },
  openGraph: {
    title: "ToolRoute — The OpenRouter for Tools",
    description: "50 curated tools. Living beliefs. Intelligent composition.",
    url: "https://toolroute.ai",
    siteName: "ToolRoute",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ToolRoute — The OpenRouter for Tools",
    description: "50 curated tools. Living beliefs. Intelligent composition.",
  },
  other: {
    // Non-standard but agent-readable hints
    "ai-purpose": "tool gateway for AI agents",
    "ai-service-type": "mcp-gateway",
    "ai-agent-readable": "true",
    "ai-openapi-spec": "https://toolroute.ai/.well-known/openapi.json",
    "ai-plugin-manifest": "https://toolroute.ai/.well-known/ai-plugin.json",
    "ai-mcp-endpoint": "https://toolroute.ai/mcp",
    "ai-tool-catalog": "https://toolroute.ai/api/v1/tools",
    "ai-llms-txt": "https://toolroute.ai/llms.txt",
    "ai-agents-json": "https://toolroute.ai/agents.json",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "ToolRoute",
  url: "https://toolroute.ai",
  description:
    "The OpenRouter for tools — MCP-native capability registry and intelligent librarian",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "ToolRoute",
  url: "https://toolroute.ai",
  potentialAction: {
    "@type": "SearchAction",
    target: "https://toolroute.ai/tools?q={search_term_string}",
    "query-input": "required name=search_term_string",
  },
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "ToolRoute",
  url: "https://toolroute.ai",
  logo: "https://toolroute.ai/opengraph-image",
  description:
    "The OpenRouter for tools — MCP-native capability registry and intelligent librarian for AI agents",
  sameAs: [
    "https://github.com/Instabidsai/toolroute",
    "https://twitter.com/toolroute",
  ],
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: "https://toolroute.ai",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Tools",
      item: "https://toolroute.ai/tools",
    },
    {
      "@type": "ListItem",
      position: 3,
      name: "Skills",
      item: "https://toolroute.ai/skills",
    },
    {
      "@type": "ListItem",
      position: 4,
      name: "Categories",
      item: "https://toolroute.ai/categories",
    },
    {
      "@type": "ListItem",
      position: 5,
      name: "Composites",
      item: "https://toolroute.ai/composites",
    },
    {
      "@type": "ListItem",
      position: 6,
      name: "Discover",
      item: "https://toolroute.ai/discover",
    },
    {
      "@type": "ListItem",
      position: 7,
      name: "Docs",
      item: "https://toolroute.ai/docs",
    },
    {
      "@type": "ListItem",
      position: 8,
      name: "Blog",
      item: "https://toolroute.ai/blog",
    },
    {
      "@type": "ListItem",
      position: 9,
      name: "Pricing",
      item: "https://toolroute.ai/pricing",
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        />
      </head>
      <body className="antialiased min-h-screen">
        <Nav />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
