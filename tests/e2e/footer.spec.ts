import { expect, test } from "@playwright/test";

test.describe("site footer", () => {
  test("links to the support inbox", async ({ page }) => {
    await page.goto("/");

    const supportLink = page
      .locator("footer")
      .getByRole("link", { name: "support@toolroute.ai" });

    await expect(supportLink).toBeVisible();
    await expect(supportLink).toHaveAttribute(
      "href",
      "mailto:support@toolroute.ai"
    );
  });
});
