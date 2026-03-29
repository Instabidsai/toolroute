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
  },
  openGraph: {
    title: "ToolRoute — The OpenRouter for Tools",
    description: "50 curated tools. Living beliefs. Intelligent composition.",
    url: "https://toolroute.ai",
    siteName: "ToolRoute",
    type: "website",
    images: [
      {
        url: "https://toolroute.ai/og-image.png",
        width: 1200,
        height: 630,
        alt: "ToolRoute — The OpenRouter for Tools",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ToolRoute — The OpenRouter for Tools",
    description: "50 curated tools. Living beliefs. Intelligent composition.",
    images: ["https://toolroute.ai/og-image.png"],
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
  logo: "https://toolroute.ai/og-image.png",
  description:
    "The OpenRouter for tools — MCP-native capability registry and intelligent librarian for AI agents",
  sameAs: ["https://github.com/toolroute"],
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
      name: "Categories",
      item: "https://toolroute.ai/categories",
    },
    {
      "@type": "ListItem",
      position: 4,
      name: "Composites",
      item: "https://toolroute.ai/composites",
    },
    {
      "@type": "ListItem",
      position: 5,
      name: "Discover",
      item: "https://toolroute.ai/discover",
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
