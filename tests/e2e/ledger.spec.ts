import { expect, test } from "@playwright/test";

test("/ledger renders public aggregate ledger surface", async ({ page }) => {
  await page.goto("/ledger");

  await expect(page.getByRole("heading", { name: "Public Ledger" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "24h Tool Rollups" })).toBeVisible();
  await expect(page.getByText("p50")).toBeVisible();
  await expect(page.getByText("p99")).toBeVisible();
  await expect(page.getByText("Raw usage events remain private")).toBeVisible();
});
