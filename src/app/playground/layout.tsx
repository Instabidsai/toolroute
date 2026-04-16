import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MCP Tool Playground — Test Any Tool in Real Time | ToolRoute",
  description:
    "Try the MCP tool playground to test any of 70+ tools live. Select a tool, edit JSON input, and execute instantly with your API key.",
  alternates: {
    canonical: "/playground",
  },
  openGraph: {
    title: "MCP Tool Playground — Test Any Tool in Real Time | ToolRoute",
    description: "Try the MCP tool playground to test any of 70+ tools live. Execute instantly with your API key.",
    url: "https://toolroute.ai/playground",
  },
};

export default function PlaygroundLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
