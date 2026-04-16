import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ToolRoute Login — Sign In to Your API Dashboard",
  description:
    "Sign in to ToolRoute to manage API keys, monitor usage, and access 70+ MCP tools from one dashboard. Free to start.",
  alternates: {
    canonical: "/login",
  },
  openGraph: {
    title: "ToolRoute Login — Sign In to Your API Dashboard",
    description: "Sign in to ToolRoute to manage API keys, monitor usage, and access 70+ MCP tools.",
    url: "https://toolroute.ai/login",
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
