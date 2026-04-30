import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildAgentsJson,
  buildAiPluginManifest,
  buildMcpManifest,
  buildOpenApiSpec,
} from "@/lib/agent-discovery";

describe("agent-native discovery manifests", () => {
  it("ships every well-known URL advertised by the health endpoint", () => {
    const routeFiles = [
      "src/app/.well-known/openapi.json/route.ts",
      "src/app/openapi.json/route.ts",
      "src/app/.well-known/ai-plugin.json/route.ts",
      "src/app/.well-known/mcp.json/route.ts",
      "src/app/agents.json/route.ts",
    ];

    for (const routeFile of routeFiles) {
      expect(existsSync(resolve(process.cwd(), routeFile)), routeFile).toBe(true);
    }
  });

  it("does not let stale public files shadow the app route handlers", () => {
    const shadowFiles = [
      "public/.well-known/openapi.json",
      "public/openapi.json",
      "public/.well-known/ai-plugin.json",
      "public/.well-known/mcp.json",
      "public/agents.json",
    ];

    for (const shadowFile of shadowFiles) {
      expect(existsSync(resolve(process.cwd(), shadowFile)), shadowFile).toBe(false);
    }
  });

  it("documents the core agent onboarding and execution API in OpenAPI", () => {
    const spec = buildOpenApiSpec();

    expect(spec.openapi).toBe("3.1.0");
    expect(spec.servers[0].url).toBe("https://toolroute.ai");
    expect(spec.paths["/api/v1/agent/manifest"].get.security).toEqual([]);
    expect(spec.paths["/api/v1/signup"].post.security).toEqual([]);
    expect(spec.paths["/api/v1/signup"].post.responses["201"].description).toContain(
      "management-scoped"
    );
    expect(spec.paths["/api/v1/provider-requirements"].get.security).toEqual([]);
    expect(spec.paths["/api/v1/execute"].post.security).toEqual([
      { ToolRouteBearer: [] },
    ]);
    expect(spec.paths["/api/v1/keys"].post.security).toEqual([
      { ToolRouteManagementBearer: [] },
      { SupabaseSession: [] },
    ]);
    expect(spec.components.securitySchemes.ToolRouteManagementBearer.description).toContain(
      "cannot execute tools"
    );
  });

  it("points plugin and MCP manifests at the production OpenAPI and MCP endpoints", () => {
    const plugin = buildAiPluginManifest();
    const mcp = buildMcpManifest();
    const agents = buildAgentsJson();

    expect(plugin.api.url).toBe("https://toolroute.ai/.well-known/openapi.json");
    expect(plugin.auth.authorization_type).toBe("bearer");
    expect(mcp.endpoint).toBe("https://toolroute.ai/mcp");
    expect(mcp.capabilities.tools_call_requires_execution_key).toBe(true);
    expect(agents.agent_controlled).toBe(true);
    expect(agents.discovery.openapi).toBe("https://toolroute.ai/.well-known/openapi.json");
  });
});
