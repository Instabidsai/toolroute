export const SPEND_ALERT_THRESHOLD_USD = 50;
export const SPEND_ALERT_MULTIPLIER = 5;
export const SPEND_ALERT_DEDUPE_MS = 24 * 60 * 60 * 1000;

const DEFAULT_FROM_EMAIL = "ToolRoute <onboarding@resend.dev>";
const DEFAULT_ADMIN_EMAIL = "support@toolroute.ai";

const sentAlerts = new Map<string, number>();

export interface SpendAnomalyRow {
  user_id: string | null;
  cost_to_user: number | null;
  created_at: string | null;
}

export interface SpendAnomalyAlert {
  user_id: string;
  spend_24h: number;
  baseline_daily_avg: number;
  multiplier: number | "Infinity";
  calls_24h: number;
}

function roundMoney(value: number) {
  return Number(value.toFixed(4));
}

function rowSpend(row: SpendAnomalyRow) {
  const spend = Number(row.cost_to_user) || 0;
  return spend > 0 ? spend : 0;
}

export function buildSpendAnomalyAlerts(
  rows: SpendAnomalyRow[],
  now = new Date(),
  thresholdUsd = SPEND_ALERT_THRESHOLD_USD,
  multiplierThreshold = SPEND_ALERT_MULTIPLIER
): SpendAnomalyAlert[] {
  const nowMs = now.getTime();
  const currentWindowStart = nowMs - 24 * 60 * 60 * 1000;
  const baselineWindowStart = currentWindowStart - 7 * 24 * 60 * 60 * 1000;
  const grouped = new Map<
    string,
    { spend24h: number; baselineSpend: number; calls24h: number }
  >();

  for (const row of rows) {
    if (!row.user_id || !row.created_at) continue;

    const createdMs = new Date(row.created_at).getTime();
    if (!Number.isFinite(createdMs) || createdMs < baselineWindowStart || createdMs >= nowMs) {
      continue;
    }

    const entry =
      grouped.get(row.user_id) ?? { spend24h: 0, baselineSpend: 0, calls24h: 0 };
    const spend = rowSpend(row);

    if (createdMs >= currentWindowStart) {
      entry.spend24h += spend;
      entry.calls24h += 1;
    } else {
      entry.baselineSpend += spend;
    }

    grouped.set(row.user_id, entry);
  }

  return Array.from(grouped.entries())
    .map(([user_id, stats]) => {
      const baselineDailyAvg = stats.baselineSpend / 7;
      const multiplier =
        baselineDailyAvg > 0 ? stats.spend24h / baselineDailyAvg : Infinity;
      const displayMultiplier: number | "Infinity" = Number.isFinite(multiplier)
        ? Number(multiplier.toFixed(2))
        : "Infinity";

      return {
        user_id,
        spend_24h: roundMoney(stats.spend24h),
        baseline_daily_avg: roundMoney(baselineDailyAvg),
        multiplier: displayMultiplier,
        calls_24h: stats.calls24h,
      };
    })
    .filter((alert) => {
      const multiplier =
        alert.multiplier === "Infinity" ? Infinity : alert.multiplier;
      return alert.spend_24h > thresholdUsd && multiplier > multiplierThreshold;
    })
    .sort((a, b) => b.spend_24h - a.spend_24h || b.calls_24h - a.calls_24h);
}

export function filterDedupedSpendAlerts(
  alerts: SpendAnomalyAlert[],
  now = Date.now()
) {
  const fresh: SpendAnomalyAlert[] = [];
  const suppressed: SpendAnomalyAlert[] = [];

  for (const alert of alerts) {
    const lastSent = sentAlerts.get(alert.user_id);
    if (lastSent && now - lastSent < SPEND_ALERT_DEDUPE_MS) {
      suppressed.push(alert);
      continue;
    }

    sentAlerts.set(alert.user_id, now);
    fresh.push(alert);
  }

  return { fresh, suppressed };
}

export function buildSpendAnomalyEmailText(alerts: SpendAnomalyAlert[]) {
  return [
    "ToolRoute spend anomaly alert.",
    "",
    "The following users exceeded $50 spend in the last 24 hours and 5x their 7-day daily average:",
    "",
    ...alerts.map(
      (alert) =>
        `- ${alert.user_id}: $${alert.spend_24h.toFixed(
          4
        )} in 24h, baseline $${alert.baseline_daily_avg.toFixed(
          4
        )}/day, ${alert.multiplier}x (${alert.calls_24h} calls)`
    ),
    "",
    "Review gateway_usage_log and customer balance history before allowing additional high-volume traffic.",
  ].join("\n");
}

export async function sendSpendAnomalyEmail(alerts: SpendAnomalyAlert[]) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey || alerts.length === 0) {
    return false;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM_EMAIL,
      to:
        process.env.SPEND_ALERT_EMAIL ||
        process.env.ALERT_EMAIL ||
        process.env.ADMIN_EMAIL ||
        DEFAULT_ADMIN_EMAIL,
      subject: `ToolRoute alert: ${alerts.length} spend anomal${
        alerts.length === 1 ? "y" : "ies"
      }`,
      text: buildSpendAnomalyEmailText(alerts),
    }),
  });

  return response.ok;
}

export function resetSpendAnomalyDedupeForTests() {
  sentAlerts.clear();
}
