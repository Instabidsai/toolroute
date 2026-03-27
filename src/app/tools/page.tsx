import { getTools, getInventory } from "@/lib/api";
import { ToolsClient } from "./ToolsClient";

export const revalidate = 60;

export default async function ToolsPage() {
  const [tools, inventory] = await Promise.all([getTools(), getInventory()]);
  const installedSlugs = new Set(inventory.map((i) => i.tool_slug));

  return (
    <div>
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
