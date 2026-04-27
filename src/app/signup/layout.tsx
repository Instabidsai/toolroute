import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create a ToolRoute Account - Start with API Keys",
  description:
    "Create a ToolRoute account to manage API keys, billing, and access to the MCP tool gateway.",
  alternates: {
    canonical: "/signup",
  },
  openGraph: {
    title: "Create a ToolRoute Account",
    description:
      "Create a ToolRoute account to manage API keys, billing, and MCP gateway access.",
    url: "https://toolroute.ai/signup",
  },
};

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
