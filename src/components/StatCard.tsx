interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
}

export function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <div className="border border-border rounded-lg p-4 bg-bg-card">
      <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">
        {label}
      </p>
      <p className="text-2xl font-bold text-text">{value}</p>
      {sub && <p className="text-xs text-text-dim mt-0.5">{sub}</p>}
    </div>
  );
}
