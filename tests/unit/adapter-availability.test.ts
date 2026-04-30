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

  it("marks pooled adapters available only when their pooled env vars exist", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "present");
    vi.stubEnv("POSTIZ_API_KEY", "");

    expect(getAdapterAvailability("claude")).toEqual({
      adapter_slug: "claude",
      status: "available",
      access_mode: "byok",
      pool_available: true,
      byok_required: true,
    });
    expect(getAdapterAvailability("postiz")).toEqual({
      adapter_slug: "postiz",
      status: "available",
      access_mode: "byok",
      pool_available: false,
      byok_required: true,
    });
  });

  it("marks BYOK-insufficient adapters unavailable", () => {
    expect(getAdapterAvailability("apollo")).toEqual({
      adapter_slug: "apollo",
      status: "coming_soon",
      access_mode: "unavailable",
      pool_available: false,
      byok_required: true,
    });
  });

  it("maps public registry tool slugs to runtime adapter slugs", () => {
    vi.stubEnv("FAL_KEY", "present");

    expect(getToolAvailability("fal-ai")).toEqual({
      adapter_slug: "image",
      status: "available",
      access_mode: "byok",
      pool_available: true,
      byok_required: true,
    });
    expect(getToolAvailability("unknown-tool")).toEqual({
      adapter_slug: null,
      status: "coming_soon",
      access_mode: "unavailable",
      pool_available: false,
      byok_required: false,
    });
  });

  it("filters schema formats to adapters that can execute", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "present");
    vi.stubEnv("POSTIZ_API_KEY", "");

    expect(
      listAvailableAdapters([adapter("claude"), adapter("context7"), adapter("postiz"), adapter("apollo")])
        .map((item) => item.slug)
        .sort()
    ).toEqual(["claude", "context7", "postiz"]);
  });
});
