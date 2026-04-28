import { expect, test } from "@playwright/test";

const pages = [
  { path: "/terms", heading: "Terms of Service", text: "API keys" },
  { path: "/privacy", heading: "Privacy Policy", text: "upstream providers" },
  { path: "/aup", heading: "Acceptable Use Policy", text: "Prohibited uses" },
  { path: "/refunds", heading: "Refund Policy", text: "Prepaid credits" },
];

test.describe("legal pages", () => {
  for (const pageInfo of pages) {
    test(`${pageInfo.path} returns real legal content`, async ({ page }) => {
      await page.goto(pageInfo.path);

      await expect(
        page.getByRole("heading", { name: pageInfo.heading })
      ).toBeVisible();
      await expect(page.getByText("Last updated 2026-04-27")).toBeVisible();
      await expect(page.getByText(pageInfo.text).first()).toBeVisible();
      await expect(page.getByText("support@toolroute.ai").first()).toBeVisible();
    });
  }
});
