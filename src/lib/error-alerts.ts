export const ERROR_RATE_THRESHOLD = 20;
export const ERROR_ALERT_DEDUPE_MS = 60 * 60 * 1000;

const DEFAULT_FROM_EMAIL = "ToolRoute <onboarding@resend.dev>";
const DEFAULT_ADMIN_EMAIL = "support@toolroute.ai";

const sentAlerts = new Map<string, number>();

export interface GatewayErrorRow {
  tool_slug: string | null;
  response_status: number | null;
}

export interface ErrorRateAlert {
  tool_slug: string;
  total_calls: number;
  error_calls: number;
  error_rate: number;
}

function isErrorStatus(status: number | null) {
  return typeof status !== "number" || status < 200 || status >= 400;
}

export function buildErrorRateAlerts(
  rows: GatewayErrorRow[],
  thresholdPct = ERROR_RATE_THRESHOLD
): ErrorRateAlert[] {
  const grouped = new Map<string, { total: number; errors: number }>();

  for (const row of rows) {
    if (!row.tool_slug) continue;
    const entry = grouped.get(row.tool_slug) ?? { total: 0, errors: 0 };
    entry.total += 1;
    if (isErrorStatus(row.response_status)) {
      entry.errors += 1;
    }
    grouped.set(row.tool_slug, entry);
  }

  return Array.from(grouped.entries())
    .map(([tool_slug, stats]) => ({
      tool_slug,
      total_calls: stats.total,
      error_calls: stats.errors,
      error_rate: Number(((stats.errors / stats.total) * 100).toFixed(2)),
    }))
    .filter((alert) => alert.error_rate > thresholdPct)
    .sort((a, b) => b.error_rate - a.error_rate || b.error_calls - a.error_calls);
}

export function filterDedupedErrorAlerts(
  alerts: ErrorRateAlert[],
  now = Date.now()
) {
  const fresh: ErrorRateAlert[] = [];
  const suppressed: ErrorRateAlert[] = [];

  for (const alert of alerts) {
    const lastSent = sentAlerts.get(alert.tool_slug);
    if (lastSent && now - lastSent < ERROR_ALERT_DEDUPE_MS) {
      suppressed.push(alert);
      continue;
    }

    sentAlerts.set(alert.tool_slug, now);
    fresh.push(alert);
  }

  return { fresh, suppressed };
}

export function buildErrorRateAlertEmailText(alerts: ErrorRateAlert[]) {
  return [
    "ToolRoute adapter error-rate alert.",
    "",
    "The following adapters exceeded a 20% error rate over the last hour:",
    "",
    ...alerts.map(
      (alert) =>
        `- ${alert.tool_slug}: ${alert.error_rate}% errors (${alert.error_calls}/${alert.total_calls} calls)`
    ),
    "",
    "Review gateway_usage_log and upstream provider status before re-enabling paid traffic.",
  ].join("\n");
}

export async function sendErrorRateAlertEmail(alerts: ErrorRateAlert[]) {
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
        process.env.ALERT_EMAIL ||
        process.env.ADMIN_EMAIL ||
        DEFAULT_ADMIN_EMAIL,
      subject: `ToolRoute alert: ${alerts.length} adapter error-rate issue${
        alerts.length === 1 ? "" : "s"
      }`,
      text: buildErrorRateAlertEmailText(alerts),
    }),
  });

  return response.ok;
}

export function resetErrorAlertDedupeForTests() {
  sentAlerts.clear();
}
