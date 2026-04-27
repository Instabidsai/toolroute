export interface UsageChartInput {
  created_at: string;
  cost_to_user: number | null;
}

export interface UsageChartPoint {
  date: string;
  label: string;
  requests: number;
  cost: number;
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function buildSevenDayUsageChart(
  usageRows: UsageChartInput[],
  now = new Date()
): UsageChartPoint[] {
  const points = new Map<string, UsageChartPoint>();

  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date(now);
    day.setDate(now.getDate() - offset);
    day.setHours(0, 0, 0, 0);
    const key = dateKey(day);
    points.set(key, {
      date: key,
      label: day.toLocaleDateString("en-US", { weekday: "short" }),
      requests: 0,
      cost: 0,
    });
  }

  for (const row of usageRows) {
    const key = dateKey(new Date(row.created_at));
    const point = points.get(key);
    if (!point) continue;
    point.requests += 1;
    point.cost += row.cost_to_user ?? 0;
  }

  return [...points.values()].map((point) => ({
    ...point,
    cost: Number(point.cost.toFixed(6)),
  }));
}
