import { describe, expect, it } from "vitest";
import {
  ACCOUNT_MANAGEMENT_SCOPE,
  containsReservedScope,
  isAccountManagementScope,
  keyScopeFromAllowedTools,
} from "@/lib/key-scopes";

describe("ToolRoute key scopes", () => {
  it("treats only the reserved singleton marker as a management key", () => {
    expect(isAccountManagementScope([ACCOUNT_MANAGEMENT_SCOPE])).toBe(true);
    expect(isAccountManagementScope(null)).toBe(false);
    expect(isAccountManagementScope([])).toBe(false);
    expect(isAccountManagementScope(["firecrawl/scrape"])).toBe(false);
    expect(isAccountManagementScope([ACCOUNT_MANAGEMENT_SCOPE, "firecrawl/scrape"])).toBe(false);
  });

  it("maps stored allowed_tools to public key scopes", () => {
    expect(keyScopeFromAllowedTools([ACCOUNT_MANAGEMENT_SCOPE])).toBe("management");
    expect(keyScopeFromAllowedTools(null)).toBe("execute");
    expect(keyScopeFromAllowedTools(["firecrawl/scrape"])).toBe("execute");
  });

  it("detects reserved scope tokens inside requested tool allowlists", () => {
    expect(containsReservedScope(["firecrawl/scrape"])).toBe(false);
    expect(containsReservedScope(["firecrawl/scrape", ACCOUNT_MANAGEMENT_SCOPE])).toBe(true);
  });
});
