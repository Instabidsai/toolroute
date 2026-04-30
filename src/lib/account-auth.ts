import {
  getUserFromSession,
  validateRequest,
} from "@/lib/gateway";
import { GatewayError } from "@/lib/gateway-types";
import {
  isAccountManagementScope,
  type ToolRouteKeyScope,
} from "@/lib/key-scopes";
import { hasToolRouteBearerToken } from "@/lib/toolroute-key-format";

export type AccountActor = {
  userId: string;
  email: string;
  authKind: "session" | "toolroute_key";
  keyId?: string;
  planSlug?: string;
  creditBalance?: number;
  allowedTools?: string[] | null;
  keyScope?: ToolRouteKeyScope;
};

export async function getAccountActor(
  authHeader: string | null
): Promise<AccountActor> {
  if (hasToolRouteBearerToken(authHeader)) {
    const ctx = await validateRequest(authHeader);
    if (!isAccountManagementScope(ctx.allowedTools)) {
      throw new GatewayError(
        "A ToolRoute management key is required for account settings",
        403,
        "management_key_required"
      );
    }

    return {
      userId: ctx.userId,
      email: "",
      authKind: "toolroute_key",
      keyId: ctx.keyId,
      planSlug: ctx.planSlug,
      creditBalance: ctx.creditBalance,
      allowedTools: ctx.allowedTools,
      keyScope: "management",
    };
  }

  const session = await getUserFromSession(authHeader);
  return {
    ...session,
    authKind: "session",
  };
}
