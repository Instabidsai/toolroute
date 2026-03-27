import Link from "next/link";
import type { Tool } from "@/lib/types";

const ratingColor = (r: number) =>
  r >= 10 ? "text-green" : r >= 9 ? "text-accent" : "text-amber";

const costLabel: Record<string, string> = {
  free: "Free",
  freemium: "Freemium",
  paid: "Paid",
  "usage-based": "Usage",
  enterprise: "Enterprise",
};

export function ToolCard({ tool }: { tool: Tool }) {
  return (
    <Link
      href={`/tools/${tool.slug}`}
      className="block border border-border rounded-lg p-4 bg-bg-card hover:bg-bg-card-hover hover:border-border-bright transition-all group"
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-sm group-hover:text-accent transition-colors">
          {tool.name}
        </h3>
        <span className={`text-xs font-bold ${ratingColor(tool.rating)}`}>
          {tool.rating}/10
        </span>
      </div>
      <p className="text-xs text-text-dim line-clamp-2 mb-3">
        {tool.description}
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        {tool.protocols?.map((p) => (
          <span key={p} className="protocol-badge">
            {p}
          </span>
        ))}
        <span className="text-[10px] text-text-muted ml-auto">
          {costLabel[tool.cost] ?? tool.cost}
        </span>
      </div>
    </Link>
  );
}
