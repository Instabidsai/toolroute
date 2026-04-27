import { expect, test } from "@playwright/test";

test("agent discovery files expose llms, plugin manifest, and OpenAPI", async ({
  request,
}) => {
  const llms = await request.get("/llms.txt");
  expect(llms.status()).toBe(200);
  const llmsText = await llms.text();
  expect(llmsText).toContain("POST /api/v1/execute");
  expect(llmsText).toContain("GET /api/v1/tools");

  const plugin = await request.get("/.well-known/ai-plugin.json");
  expect(plugin.status()).toBe(200);
  const pluginJson = await plugin.json();
  expect(pluginJson.api.url).toBe("https://toolroute.ai/api/v1/openapi.json");

  const openapi = await request.get("/api/v1/openapi.json");
  expect(openapi.status()).toBe(200);
  const openapiJson = await openapi.json();
  expect(openapiJson.openapi).toBe("3.1.0");
  expect(openapiJson.paths["/api/v1/execute"]).toBeTruthy();
});
