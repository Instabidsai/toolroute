import type { Metadata } from "next";
import { getTools } from "@/lib/api";
import { getInventory } from "@/lib/api-server";
import { ToolsClient } from "./ToolsClient";
import { safeJsonLd } from "@/lib/json-ld";

export const metadata: Metadata = {
  title: "MCP Tools Catalog — Browse 70+ Curated AI Tools | ToolRoute",
  description:
    "Browse the MCP tools catalog with 70+ curated best-in-class tools for AI agents. Filter by category, protocol, or search. Every tool rated 9/10+.",
  alternates: {
    canonical: "/tools",
  },
  openGraph: {
    title: "MCP Tools Catalog — Browse 70+ Curated AI Tools | ToolRoute",
    description: "Browse the MCP tools catalog with 70+ curated tools for AI agents. Filter by category, protocol, or search.",
    url: "https://toolroute.ai/tools",
  },
};

export const revalidate = 60;

export default async function ToolsPage() {
  const [tools, inventory] = await Promise.all([getTools(), getInventory()]);
  const installedSlugs = new Set(inventory.map((i) => i.tool_slug));

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "MCP Tools Catalog",
    description:
      "Browse the MCP tools catalog with 70+ curated best-in-class tools for AI agents. Filter by category, protocol, or search.",
    url: "https://toolroute.ai/tools",
    isPartOf: {
      "@type": "WebSite",
      name: "ToolRoute",
      url: "https://toolroute.ai",
    },
    mainEntity: {
      "@type": "ItemList",
      name: "ToolRoute Tools",
      description: "Curated list of MCP-compatible tools for AI agents.",
      numberOfItems: tools.length,
      itemListElement: tools.slice(0, 25).map((tool, idx) => ({
        "@type": "ListItem",
        position: idx + 1,
        url: `https://toolroute.ai/tools/${tool.slug}`,
        name: tool.name,
      })),
    },
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(collectionSchema) }}
      />
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Tool Registry</h1>
        <p className="text-sm text-text-dim">
          {tools.length} curated tools, 9/10+ only. Filter by category,
          protocol, or search.
        </p>
      </div>
      <ToolsClient tools={tools} installedSlugs={Array.from(installedSlugs)} />
    </div>
  );
}
