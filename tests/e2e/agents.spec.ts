import { expect, test } from "@playwright/test";

test("/agents exposes copy-paste integration tabs", async ({ page }) => {
  await page.route("**/api/v1/tools", async (route) => {
    await route.fulfill({
      json: {
        tools: [
          { status: "available" },
          { status: "available" },
          { status: "unavailable" },
        ],
      },
    });
  });

  await page.goto("/agents");

  await expect(
    page.getByRole("heading", { name: "ToolRoute for AI Agents" })
  ).toBeVisible();
  await expect(page.getByText("3 tools live")).toBeVisible();

  await expect(page.getByRole("tab", { name: "curl" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await expect(
    page.locator("pre").filter({ hasText: "tavily/search" })
  ).toBeVisible();

  await page.getByRole("tab", { name: "MCP HTTP config" }).click();
  await expect(
    page.locator("pre").filter({ hasText: "https://toolroute.ai/mcp" })
  ).toBeVisible();

  await page.getByRole("tab", { name: "OpenAI Functions format" }).click();
  await expect(
    page.locator("pre").filter({ hasText: "format=openai" })
  ).toBeVisible();
});
