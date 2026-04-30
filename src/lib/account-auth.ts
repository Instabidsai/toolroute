import {
  getUserFromSession,
  validateRequest,
} from "@/lib/gateway";
import { GatewayError } from "@/lib/gateway-types";
import { hasToolRouteBearerToken } from "@/lib/toolroute-key-format";

export type AccountActor = {
  userId: string;
  email: string;
  authKind: "session" | "toolroute_key";
  keyId?: string;
  planSlug?: string;
  creditBalance?: number;
  allowedTools?: string[] | null;
};

export async function getAccountActor(
  authHeader: string | null
): Promise<AccountActor> {
  if (hasToolRouteBearerToken(authHeader)) {
    const ctx = await validateRequest(authHeader);
    if (ctx.allowedTools && ctx.allowedTools.length > 0) {
      throw new GatewayError(
        "Restricted ToolRoute keys cannot manage account settings",
        403,
        "restricted_key_no_account_management"
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
    };
  }

  const session = await getUserFromSession(authHeader);
  return {
    ...session,
    authKind: "session",
  };
}
