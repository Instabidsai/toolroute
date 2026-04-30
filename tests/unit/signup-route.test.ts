import { createHash } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { ACCOUNT_MANAGEMENT_SCOPE } from "@/lib/key-scopes";

const mocks = vi.hoisted(() => ({
  supabaseAdmin: vi.fn(),
}));

vi.mock("@/lib/gateway", () => ({
  CORS_HEADERS: {},
  AUTHED_RESPONSE_HEADERS: {},
  NO_STORE_HEADERS: {},
  supabaseAdmin: mocks.supabaseAdmin,
}));

import { POST } from "@/app/api/v1/signup/route";

function requestFor(body: unknown) {
  return new Request("https://toolroute.ai/api/v1/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as NextRequest;
}

function buildSupabaseMock(options?: {
  createUserError?: { message: string };
  gatewayUserInsertError?: { message: string };
  apiKeyInsertError?: { message: string };
}) {
  const createUser = vi.fn().mockResolvedValue(
    options?.createUserError
      ? { data: { user: null }, error: options.createUserError }
      : { data: { user: { id: "user_123" } }, error: null }
  );
  const generateLink = vi.fn().mockResolvedValue({
    data: {
      properties: {
        action_link: "https://toolroute.ai/auth/callback?token=verify",
      },
    },
    error: null,
  });
  const gatewayUsersInsert = vi.fn().mockResolvedValue({
    error: options?.gatewayUserInsertError ?? null,
  });
  const apiKeysInsert = vi.fn().mockResolvedValue({
    error: options?.apiKeyInsertError ?? null,
  });
  const from = vi.fn((table: string) => {
    if (table === "gateway_users") {
      return { insert: gatewayUsersInsert };
    }
    if (table === "api_keys") {
      return { insert: apiKeysInsert };
    }
    throw new Error(`Unexpected table ${table}`);
  });

  const supabase = {
    auth: {
      admin: {
        createUser,
        generateLink,
      },
    },
    from,
  };

  mocks.supabaseAdmin.mockReturnValue(supabase);

  return {
    createUser,
    generateLink,
    gatewayUsersInsert,
    apiKeysInsert,
  };
}

describe("POST /api/v1/signup", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true })
    );
    delete process.env.RESEND_API_KEY;
  });

  it("creates a Supabase user, gateway user, and tr_test API key", async () => {
    const supabase = buildSupabaseMock();

    const response = await POST(
      requestFor({
        email: "Agent@Example.com",
        password: "strong-password-123",
        accepted_tos: true,
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.user_id).toBe("user_123");
    expect(payload.api_key).toMatch(/^tr_test_/);
    expect(payload.key_prefix).toBe(payload.api_key.slice(0, 12));
    expect(payload.key_scope).toBe("management");

    expect(supabase.createUser).toHaveBeenCalledWith({
      email: "agent@example.com",
      password: "strong-password-123",
      email_confirm: false,
      user_metadata: {
        signup_source: "toolroute_password",
      },
    });

    expect(supabase.gatewayUsersInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "user_123",
        email: "agent@example.com",
        plan_slug: "free",
        credit_balance: 0,
        lifetime_credits: 0,
        lifetime_usage: 0,
      })
    );

    const keyInsert = supabase.apiKeysInsert.mock.calls[0][0];
    expect(keyInsert).toMatchObject({
      user_id: "user_123",
      name: "Default Management Key",
      key_prefix: payload.key_prefix,
      allowed_tools: [ACCOUNT_MANAGEMENT_SCOPE],
      is_active: true,
      rate_limit_rpm: 10,
    });
    expect(keyInsert.key_hash).toBe(
      createHash("sha256").update(payload.api_key).digest("hex")
    );
    expect(keyInsert.key_hash).not.toContain(payload.api_key);
  });

  it("rejects duplicate emails without creating gateway rows", async () => {
    const supabase = buildSupabaseMock({
      createUserError: { message: "User already registered" },
    });

    const response = await POST(
      requestFor({
        email: "taken@example.com",
        password: "strong-password-123",
        accepted_tos: true,
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error.code).toBe("email_taken");
    expect(supabase.gatewayUsersInsert).not.toHaveBeenCalled();
    expect(supabase.apiKeysInsert).not.toHaveBeenCalled();
  });

  it("blocks disposable email domains before Supabase auth", async () => {
    const supabase = buildSupabaseMock();

    const response = await POST(
      requestFor({
        email: "agent@mailinator.com",
        password: "strong-password-123",
        accepted_tos: true,
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe("disposable_email");
    expect(supabase.createUser).not.toHaveBeenCalled();
  });
});
