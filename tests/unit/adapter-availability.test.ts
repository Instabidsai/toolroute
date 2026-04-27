import { afterEach, describe, expect, it, vi } from "vitest";
import type { ToolAdapter } from "@/lib/gateway-types";
import {
  getAdapterAvailability,
  getToolAvailability,
  listAvailableAdapters,
} from "@/lib/adapter-availability";

function adapter(slug: string) {
  return { slug } as ToolAdapter;
}

describe("adapter availability", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("marks adapters available only when their pooled env vars exist", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "present");
    vi.stubEnv("TAVILY_API_KEY", "");

    expect(getAdapterAvailability("claude")).toEqual({
      adapter_slug: "claude",
      status: "available",
    });
    expect(getAdapterAvailability("tavily")).toEqual({
      adapter_slug: "tavily",
      status: "coming_soon",
    });
  });

  it("maps public registry tool slugs to runtime adapter slugs", () => {
    vi.stubEnv("FAL_KEY", "present");

    expect(getToolAvailability("fal-ai")).toEqual({
      adapter_slug: "image",
      status: "available",
    });
    expect(getToolAvailability("unknown-tool")).toEqual({
      adapter_slug: null,
      status: "coming_soon",
    });
  });

  it("filters schema formats to adapters that can execute", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "present");
    vi.stubEnv("TAVILY_API_KEY", "");

    expect(
      listAvailableAdapters([adapter("claude"), adapter("context7"), adapter("tavily")])
        .map((item) => item.slug)
        .sort()
    ).toEqual(["claude", "context7"]);
  });
});
