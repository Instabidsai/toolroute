import { expect, test } from "@playwright/test";

test.describe("/abuse", () => {
  test("renders a public abuse report form", async ({ page }) => {
    await page.goto("/abuse");

    await expect(
      page.getByRole("heading", { name: "Report abuse" })
    ).toBeVisible();
    await expect(page.getByLabel("Contact email")).toBeVisible();
    await expect(page.getByLabel("Report type")).toBeVisible();
    await expect(page.getByLabel("Description")).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit report" })).toBeVisible();
  });
});
