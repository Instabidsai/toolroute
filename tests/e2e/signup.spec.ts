import { expect, test } from "@playwright/test";

test.describe("/signup", () => {
  test("posts accepted signup details and redirects to the dashboard", async ({
    page,
  }) => {
    await page.route(/\/dashboard\?welcome=1$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<!doctype html><title>Dashboard</title><h1>Dashboard</h1>",
      });
    });

    await page.route("**/api/v1/signup", async (route) => {
      const request = route.request();
      expect(request.method()).toBe("POST");
      expect(request.headers()["content-type"]).toContain("application/json");
      expect(JSON.parse(request.postData() ?? "{}")).toEqual({
        email: "agent@example.com",
        password: "strong-password-123",
        accepted_tos: true,
      });

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user_id: "user_123",
          key_prefix: "tr_test_1234",
        }),
      });
    });

    await page.goto("/signup");
    await page.getByLabel("Email").fill("Agent@Example.com");
    await page.getByLabel("Password").fill("strong-password-123");
    await page.getByLabel(/I accept the terms/i).check();
    await page.getByRole("button", { name: /create account/i }).click();

    await expect(page).toHaveURL(/\/dashboard\?welcome=1$/);
  });

  test("shows an inline email-taken error", async ({ page }) => {
    await page.route("**/api/v1/signup", async (route) => {
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          error: { message: "User already registered" },
        }),
      });
    });

    await page.goto("/signup");
    await page.getByLabel("Email").fill("taken@example.com");
    await page.getByLabel("Password").fill("strong-password-123");
    await page.getByLabel(/I accept the terms/i).check();
    await page.getByRole("button", { name: /create account/i }).click();

    await expect(
      page.getByRole("alert").filter({
        hasText: "Email already registered.",
      })
    ).toContainText(
      "Email already registered. Sign in instead."
    );
    await expect(page).toHaveURL(/\/signup$/);
  });
});
