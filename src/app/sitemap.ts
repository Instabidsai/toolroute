import type { MetadataRoute } from "next";
import { getTools, getComposites } from "@/lib/api";
import { SUPER_CATEGORIES } from "@/lib/types";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://toolroute.ai";

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/tools`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/categories`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/composites`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/discover`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    },
  ];

  // Dynamic tool pages
  let toolPages: MetadataRoute.Sitemap = [];
  try {
    const tools = await getTools();
    toolPages = tools.map((tool) => ({
      url: `${baseUrl}/tools/${tool.slug}`,
      lastModified: new Date(tool.updated_at || tool.created_at),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
  } catch {
    // Supabase unavailable at build time — skip dynamic tool pages
  }

  // Dynamic category pages
  const categoryPages: MetadataRoute.Sitemap = SUPER_CATEGORIES.map((sc) => ({
    url: `${baseUrl}/categories/${sc.key}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.6,
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

  return [...staticPages, ...toolPages, ...categoryPages, ...compositePages];
}
