import { describe, expect, it } from "vitest";
import { hasToolRouteBearerToken } from "@/lib/toolroute-key-format";

describe("ToolRoute API key format", () => {
  it("accepts both live and test ToolRoute API keys for gateway protocols", () => {
    expect(hasToolRouteBearerToken("Bearer tr_live_abc123")).toBe(true);
    expect(hasToolRouteBearerToken("Bearer tr_test_abc123")).toBe(true);
  });

  it("rejects missing or non-ToolRoute bearer tokens", () => {
    expect(hasToolRouteBearerToken(null)).toBe(false);
    expect(hasToolRouteBearerToken("Bearer sk_live_abc123")).toBe(false);
    expect(hasToolRouteBearerToken("Basic tr_live_abc123")).toBe(false);
  });
});
