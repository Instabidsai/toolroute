const DEFAULT_FROM_EMAIL = "ToolRoute <onboarding@resend.dev>";
const DEFAULT_ADMIN_EMAIL = "support@toolroute.ai";

export interface RevenueDigestRow {
  user_id: string | null;
  tool_slug: string | null;
  response_status: number | null;
  cost_to_user: number | null;
}

export interface RevenueDigest {
  total_revenue: number;
  total_calls: number;
  error_count: number;
  top_tools: Array<{ tool_slug: string; calls: number; revenue: number }>;
  top_customers: Array<{ user_id: string; calls: number; spend: number }>;
}

function roundMoney(value: number) {
  return Number(value.toFixed(4));
}

function isErrorStatus(status: number | null) {
  return typeof status !== "number" || status < 200 || status >= 400;
}

export function buildRevenueDigest(rows: RevenueDigestRow[]): RevenueDigest {
  const toolMap = new Map<string, { calls: number; revenue: number }>();
  const customerMap = new Map<string, { calls: number; spend: number }>();
  let totalRevenue = 0;
  let errorCount = 0;

  for (const row of rows) {
    const revenue = Number(row.cost_to_user) || 0;
    totalRevenue += revenue;
    if (isErrorStatus(row.response_status)) {
      errorCount += 1;
    }

    if (row.tool_slug) {
      const tool = toolMap.get(row.tool_slug) ?? { calls: 0, revenue: 0 };
      tool.calls += 1;
      tool.revenue += revenue;
      toolMap.set(row.tool_slug, tool);
    }

    if (row.user_id) {
      const customer = customerMap.get(row.user_id) ?? { calls: 0, spend: 0 };
      customer.calls += 1;
      customer.spend += revenue;
      customerMap.set(row.user_id, customer);
    }
  }

  return {
    total_revenue: roundMoney(totalRevenue),
    total_calls: rows.length,
    error_count: errorCount,
    top_tools: Array.from(toolMap.entries())
      .map(([tool_slug, stats]) => ({
        tool_slug,
        calls: stats.calls,
        revenue: roundMoney(stats.revenue),
      }))
      .sort((a, b) => b.revenue - a.revenue || b.calls - a.calls)
      .slice(0, 5),
    top_customers: Array.from(customerMap.entries())
      .map(([user_id, stats]) => ({
        user_id,
        calls: stats.calls,
        spend: roundMoney(stats.spend),
      }))
      .sort((a, b) => b.spend - a.spend || b.calls - a.calls)
      .slice(0, 5),
  };
}

export function buildRevenueDigestEmailText(
  digest: RevenueDigest,
  dateLabel: string
) {
  const topTools = digest.top_tools.length
    ? digest.top_tools
        .map(
          (tool) =>
            `- ${tool.tool_slug}: $${tool.revenue.toFixed(4)} (${tool.calls} calls)`
        )
        .join("\n")
    : "- none";

  const topCustomers = digest.top_customers.length
    ? digest.top_customers
        .map(
          (customer) =>
            `- ${customer.user_id.slice(0, 8)}...: $${customer.spend.toFixed(
              4
            )} (${customer.calls} calls)`
        )
        .join("\n")
    : "- none";

  return [
    `ToolRoute daily revenue digest for ${dateLabel}.`,
    "",
    `Revenue: $${digest.total_revenue.toFixed(4)}`,
    `Calls: ${digest.total_calls}`,
    `Errors: ${digest.error_count}`,
    "",
    "Top tools:",
    topTools,
    "",
    "Top customers:",
    topCustomers,
  ].join("\n");
}

export async function sendRevenueDigestEmail(
  digest: RevenueDigest,
  dateLabel: string
) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
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
        process.env.REVENUE_DIGEST_EMAIL ||
        process.env.ALERT_EMAIL ||
        process.env.ADMIN_EMAIL ||
        DEFAULT_ADMIN_EMAIL,
      subject: `ToolRoute daily revenue digest: ${dateLabel}`,
      text: buildRevenueDigestEmailText(digest, dateLabel),
    }),
  });

  return response.ok;
}
