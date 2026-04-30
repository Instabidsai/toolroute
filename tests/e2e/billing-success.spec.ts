import { Buffer } from "node:buffer";
import { expect, test } from "@playwright/test";

const AUTH_COOKIE = "sb-isbratmfnnzipzyoefbo-auth-token";

function encodeSession() {
  const session = {
    access_token: "test-access-token",
    refresh_token: "test-refresh-token",
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
    expires_in: 60 * 60,
    token_type: "bearer",
    user: {
      id: "user_123",
      aud: "authenticated",
      role: "authenticated",
      email: "agent@example.com",
      created_at: "2026-04-27T00:00:00.000Z",
      updated_at: "2026-04-27T00:00:00.000Z",
    },
  };

  return `base64-${Buffer.from(JSON.stringify(session), "utf8").toString(
    "base64url"
  )}`;
}

test.describe("/dashboard/billing checkout return", () => {
  test("guides a paid customer into creating a live key", async ({
    context,
    page,
  }) => {
    await context.addCookies([
      {
        name: AUTH_COOKIE,
        value: encodeSession(),
        url: "http://127.0.0.1:3014",
      },
    ]);

    await page.route("**/api/v1/settings", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          credit_balance: 5,
          plan_slug: "free",
          auto_topup_enabled: false,
          auto_topup_threshold: 1,
          auto_topup_amount_cents: 1000,
          has_payment_method: false,
          payment_method: null,
        }),
      });
    });

    await page.route("**/rest/v1/credit_transactions**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "content-range": "0-0/0" },
        body: "[]",
      });
    });

    await page.route("**/api/v1/keys", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: [] }),
        });
        return;
      }
      await route.fallback();
    });

    await page.goto("/dashboard/billing?success=true&amount=5");

    await expect(page.getByText("$5 credits added.")).toBeVisible();
    await page.getByRole("link", { name: /create live key/i }).click();

    await expect(page).toHaveURL(/\/dashboard\/keys\?new=1$/);
    await expect(page.getByText("Create New API Key")).toBeVisible();
    await expect(page.getByPlaceholder("e.g., Production, Development")).toHaveValue(
      "Production Agent Key"
    );
  });
});
