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

test.describe("/dashboard/keys", () => {
  test("creates, renames, and revokes a key", async ({ context, page }) => {
    await context.addCookies([
      {
        name: AUTH_COOKIE,
        value: encodeSession(),
        url: "http://127.0.0.1:3014",
      },
    ]);

    let keys: Array<{
      id: string;
      name: string;
      key_prefix: string;
      allowed_tools: string[] | null;
      is_active: boolean;
      last_used_at: string | null;
      created_at: string;
      expires_at: string | null;
    }> = [];

    await page.route("**/api/v1/keys", async (route) => {
      const request = route.request();
      const method = request.method();

      if (method === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: keys }),
        });
        return;
      }

      if (method === "POST") {
        const body = request.postDataJSON() as { name?: string };
        keys = [
          {
            id: "key_123",
            name: body.name || "Default Key",
            key_prefix: "tr_test_abc",
            allowed_tools: null,
            is_active: true,
            last_used_at: null,
            created_at: "2026-04-27T00:00:00.000Z",
            expires_at: null,
          },
        ];
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            key: "tr_test_abcdefghijklmnopqrstuvwxyz",
            id: "key_123",
            name: keys[0].name,
            prefix: keys[0].key_prefix,
          }),
        });
        return;
      }

      if (method === "PATCH") {
        const body = request.postDataJSON() as { key_id: string; name: string };
        keys = keys.map((key) =>
          key.id === body.key_id ? { ...key, name: body.name } : key
        );
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: keys[0] }),
        });
        return;
      }

      if (method === "DELETE") {
        const body = request.postDataJSON() as { key_id: string };
        keys = keys.map((key) =>
          key.id === body.key_id ? { ...key, is_active: false } : key
        );
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ message: "API key revoked", key_id: body.key_id }),
        });
        return;
      }

      await route.fallback();
    });

    await page.goto("/dashboard/keys");

    await page.getByRole("button", { name: "Create New Key" }).click();
    await page.getByPlaceholder("e.g., Production, Development").fill("Development");
    await page.getByRole("button", { name: "Create Key" }).click();

    await expect(page.getByText("API Key Created")).toBeVisible();
    await expect(page.getByText("tr_test_abcdefghijklmnopqrstuvwxyz")).toBeVisible();
    await expect(page.getByText("Development")).toBeVisible();

    await page.getByRole("button", { name: "Rename key" }).click();
    await page.getByLabel("Key name").fill("Production");
    await page.getByRole("button", { name: "Save name" }).click();
    await expect(page.getByText("Production")).toBeVisible();

    await page.getByRole("button", { name: "Revoke key" }).click();
    await page.getByRole("button", { name: "Yes" }).click();
    await expect(page.getByText("Revoked")).toBeVisible();
  });
});
