import { describe, expect, it } from "vitest";
import {
  buildRevenueDigest,
  buildRevenueDigestEmailText,
} from "@/lib/revenue-digest";

describe("revenue digest", () => {
  it("summarizes revenue, errors, top tools, and top customers", () => {
    const digest = buildRevenueDigest([
      {
        user_id: "user-a",
        tool_slug: "search",
        response_status: 200,
        cost_to_user: 1.25,
      },
      {
        user_id: "user-a",
        tool_slug: "search",
        response_status: 500,
        cost_to_user: 0.25,
      },
      {
        user_id: "user-b",
        tool_slug: "email",
        response_status: 202,
        cost_to_user: 2,
      },
    ]);

    expect(digest.total_revenue).toBe(3.5);
    expect(digest.total_calls).toBe(3);
    expect(digest.error_count).toBe(1);
    expect(digest.top_tools[0]).toEqual({
      tool_slug: "email",
      calls: 1,
      revenue: 2,
    });
    expect(digest.top_customers[0]).toEqual({
      user_id: "user-b",
      calls: 1,
      spend: 2,
    });
  });

  it("builds a readable digest email", () => {
    const digest = buildRevenueDigest([
      {
        user_id: "customer-123456",
        tool_slug: "search",
        response_status: 200,
        cost_to_user: 1,
      },
    ]);

    const text = buildRevenueDigestEmailText(digest, "2026-04-26");
    expect(text).toContain("Revenue: $1.0000");
    expect(text).toContain("search: $1.0000 (1 calls)");
    expect(text).toContain("customer...");
  });
});
