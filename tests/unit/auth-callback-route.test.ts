import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  supabaseAdmin: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
}));

vi.mock("@/lib/gateway", () => ({
  supabaseAdmin: mocks.supabaseAdmin,
}));

import { GET } from "@/app/auth/callback/route";

function requestFor(url: string) {
  return new NextRequest(url);
}

function buildAdminMock(existing?: { metadata?: Record<string, unknown>; email?: string } | null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: existing ?? null, error: null });
  const selectEq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq: selectEq });
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn().mockReturnValue({ eq: updateEq });
  const insert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn().mockReturnValue({ select, update, insert });

  const admin = { from };
  mocks.supabaseAdmin.mockReturnValue(admin);

  return { from, insert, maybeSingle, select, selectEq, update, updateEq };
}

describe("GET /auth/callback", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  });

  it("exchanges the code, marks an existing gateway user verified, and redirects", async () => {
    const exchangeCodeForSession = vi.fn().mockResolvedValue({
      data: {
        user: {
          id: "user_123",
          email: "agent@example.com",
        },
      },
      error: null,
    });
    mocks.createServerClient.mockImplementation((_url, _key, options) => ({
      auth: {
        exchangeCodeForSession: async (code: string) => {
          options.cookies.setAll([
            { name: "sb-access-token", value: "token", options: { path: "/" } },
          ]);
          return exchangeCodeForSession(code);
        },
      },
    }));
    const admin = buildAdminMock({
      email: "old@example.com",
      metadata: { accepted_tos_at: "2026-04-27T00:00:00.000Z" },
    });

    const response = await GET(
      requestFor("https://toolroute.ai/auth/callback?code=auth-code")
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://toolroute.ai/dashboard");
    expect(response.headers.get("set-cookie")).toContain("sb-access-token=token");
    expect(exchangeCodeForSession).toHaveBeenCalledWith("auth-code");
    expect(admin.update).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "agent@example.com",
        metadata: expect.objectContaining({
          accepted_tos_at: "2026-04-27T00:00:00.000Z",
          email_verified: true,
          email_verified_at: expect.any(String),
        }),
      })
    );
    expect(admin.updateEq).toHaveBeenCalledWith("id", "user_123");
  });

  it("creates a zero-credit gateway user if the callback arrives first", async () => {
    mocks.createServerClient.mockReturnValue({
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({
          data: { user: { id: "user_456", email: "new@example.com" } },
          error: null,
        }),
      },
    });
    const admin = buildAdminMock(null);

    const response = await GET(
      requestFor("https://toolroute.ai/auth/callback?code=auth-code")
    );

    expect(response.headers.get("location")).toBe("https://toolroute.ai/dashboard");
    expect(admin.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "user_456",
        email: "new@example.com",
        plan_slug: "free",
        credit_balance: 0,
        lifetime_credits: 0,
        lifetime_usage: 0,
        metadata: expect.objectContaining({ email_verified: true }),
      })
    );
  });

  it("redirects missing codes back to login", async () => {
    const response = await GET(requestFor("https://toolroute.ai/auth/callback"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://toolroute.ai/login?error=missing_auth_code"
    );
    expect(mocks.createServerClient).not.toHaveBeenCalled();
  });
});
