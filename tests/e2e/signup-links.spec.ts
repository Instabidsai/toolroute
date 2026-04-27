import { expect, test } from "@playwright/test";

test.describe("signup entry points", () => {
  test("login page links to account creation", async ({ page }) => {
    await page.goto("/login");

    await expect(
      page.getByRole("link", { name: "Create account" })
    ).toHaveAttribute("href", "/signup");
  });

  test("pricing CTAs link to signup with plan context", async ({ page }) => {
    await page.goto("/pricing");

    await expect(
      page.getByRole("link", { name: /Get Started Free/i })
    ).toHaveAttribute("href", "/signup?plan=free");
    await expect(
      page.getByRole("link", { name: /Start Pro Trial/i })
    ).toHaveAttribute("href", "/signup?plan=pro");
    await expect(
      page.getByRole("link", { name: /Contact Sales/i })
    ).toHaveAttribute("href", "/signup?plan=enterprise");
    await expect(
      page.getByRole("link", { name: /Get Your API Key/i })
    ).toHaveAttribute("href", "/signup");
  });
});
