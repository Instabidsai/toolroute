import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "ToolRoute — The OpenRouter for Tools",
  description:
    "50 curated best-in-class tools for AI agents. Search, discover, compose. The missing capability layer.",
  openGraph: {
    title: "ToolRoute — The OpenRouter for Tools",
    description: "50 curated tools. Living beliefs. Intelligent composition.",
    url: "https://toolroute.ai",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">
        <Nav />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
