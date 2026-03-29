import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "ToolRoute — The OpenRouter for Tools",
  description:
    "50 curated best-in-class tools for AI agents. Search, discover, compose. The missing capability layer.",
  metadataBase: new URL("https://toolroute.ai"),
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
      </head>
      <body className="antialiased min-h-screen">
        <Nav />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
