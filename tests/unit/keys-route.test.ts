import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getUserFromSession: vi.fn(),
  generateApiKey: vi.fn(),
  supabaseAdmin: vi.fn(),
}));

vi.mock("@/lib/gateway", () => ({
  CORS_HEADERS: {},
  getUserFromSession: mocks.getUserFromSession,
  generateApiKey: mocks.generateApiKey,
  supabaseAdmin: mocks.supabaseAdmin,
}));

import { PATCH } from "@/app/api/v1/keys/route";

function requestFor(body: unknown) {
  return new Request("https://toolroute.ai/api/v1/keys", {
    method: "PATCH",
    headers: {
      Authorization: "Bearer user-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }) as NextRequest;
}

function queryChain(result: unknown) {
  const chain = {
    eq: vi.fn(() => chain),
    select: vi.fn(() => chain),
    single: vi.fn().mockResolvedValue(result),
  };
  return chain;
}

function buildSupabaseMock(options?: { existing?: unknown; updateError?: unknown }) {
  const existingChain = queryChain({
    data: options?.existing ?? { id: "key_123" },
    error: null,
  });
  const updateChain = queryChain({
    data: {
      id: "key_123",
      name: "Production",
      key_prefix: "tr_test_abc",
      allowed_tools: null,
      is_active: true,
      last_used_at: null,
      created_at: "2026-04-27T00:00:00.000Z",
      expires_at: null,
    },
    error: options?.updateError ?? null,
  });
  const apiKeys = {
    select: vi.fn(() => existingChain),
    update: vi.fn(() => updateChain),
  };
  const from = vi.fn(() => apiKeys);
  mocks.supabaseAdmin.mockReturnValue({ from });

  return { apiKeys, existingChain, from, updateChain };
}

describe("PATCH /api/v1/keys", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getUserFromSession.mockResolvedValue({
      userId: "user_123",
      email: "agent@example.com",
    });
  });

  it("renames an owned API key", async () => {
    const supabase = buildSupabaseMock();

    const response = await PATCH(
      requestFor({ key_id: "key_123", name: "  Production  " })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.name).toBe("Production");
    expect(mocks.getUserFromSession).toHaveBeenCalledWith("Bearer user-token");
    expect(supabase.apiKeys.update).toHaveBeenCalledWith({ name: "Production" });
    expect(supabase.existingChain.eq).toHaveBeenCalledWith("id", "key_123");
    expect(supabase.existingChain.eq).toHaveBeenCalledWith("user_id", "user_123");
    expect(supabase.updateChain.eq).toHaveBeenCalledWith("id", "key_123");
    expect(supabase.updateChain.eq).toHaveBeenCalledWith("user_id", "user_123");
  });

  it("rejects a missing key name before updating", async () => {
    const supabase = buildSupabaseMock();

    const response = await PATCH(requestFor({ key_id: "key_123", name: "   " }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe("missing_name");
    expect(supabase.apiKeys.update).not.toHaveBeenCalled();
  });
});
