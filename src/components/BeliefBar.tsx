import type { CategoryBelief } from "@/lib/types";

export function BeliefBar({ belief }: { belief: CategoryBelief }) {
  const pct = Math.round(belief.confidence * 100);
  const color =
    belief.confidence >= 0.8
      ? "bg-green"
      : belief.confidence >= 0.6
        ? "bg-accent"
        : "bg-amber";

  return (
    <div className="border border-border rounded-lg p-3 bg-bg-card">
      <div className="flex items-center justify-between mb-1.5">
        <div>
          <span className="text-xs font-semibold text-text">
            {belief.champion}
          </span>
          <span className="text-[10px] text-text-muted ml-2">
            {belief.sub_category.replace(/_/g, " ")}
          </span>
        </div>
        <span className="text-xs font-mono text-text-dim">{pct}%</span>
      </div>
      <div className="w-full bg-bg-surface rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full ${color} transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {belief.observation_count > 0 && (
        <p className="text-[10px] text-text-muted mt-1">
          {belief.observation_count} observations
        </p>
      )}
    </div>
  );
}
