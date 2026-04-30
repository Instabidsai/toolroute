export const ACCOUNT_MANAGEMENT_SCOPE = "__toolroute_account_management";

export type ToolRouteKeyScope = "execute" | "management";

export function isAccountManagementScope(
  allowedTools: string[] | null | undefined
): boolean {
  return (
    Array.isArray(allowedTools) &&
    allowedTools.length === 1 &&
    allowedTools[0] === ACCOUNT_MANAGEMENT_SCOPE
  );
}

export function keyScopeFromAllowedTools(
  allowedTools: string[] | null | undefined
): ToolRouteKeyScope {
  return isAccountManagementScope(allowedTools) ? "management" : "execute";
}

export function containsReservedScope(allowedTools: string[]): boolean {
  return allowedTools.includes(ACCOUNT_MANAGEMENT_SCOPE);
}
