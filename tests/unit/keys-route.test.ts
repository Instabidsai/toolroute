import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAccountActor: vi.fn(),
  getUserFromSession: vi.fn(),
  generateApiKey: vi.fn(),
  generateTestApiKey: vi.fn(),
  supabaseAdmin: vi.fn(),
}));

vi.mock("@/lib/account-auth", () => ({
  getAccountActor: mocks.getAccountActor,
}));

vi.mock("@/lib/gateway", () => ({
  CORS_HEADERS: {},
  AUTHED_RESPONSE_HEADERS: {},
  NO_STORE_HEADERS: {},
  getUserFromSession: mocks.getUserFromSession,
  generateApiKey: mocks.generateApiKey,
  generateTestApiKey: mocks.generateTestApiKey,
  supabaseAdmin: mocks.supabaseAdmin,
}));

import { PATCH, POST } from "@/app/api/v1/keys/route";

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
    mocks.getAccountActor.mockResolvedValue({
      userId: "user_123",
      email: "agent@example.com",
      authKind: "session",
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
    expect(mocks.getAccountActor).toHaveBeenCalledWith("Bearer user-token");
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

function postRequest(body: unknown) {
  return new Request("https://toolroute.ai/api/v1/keys", {
    method: "POST",
    headers: {
      Authorization: "Bearer user-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }) as NextRequest;
}

function buildPostSupabaseMock(
  plan: string | null,
  credits: { credit_balance?: number; lifetime_credits?: number } = {}
) {
  const planChain = queryChain({
    data: {
      plan_slug: plan,
      credit_balance: credits.credit_balance ?? 0,
      lifetime_credits: credits.lifetime_credits ?? 0,
    },
    error: null,
  });
  const insertChain = queryChain({
    data: {
      id: "key_new",
      name: "Default Key",
      key_prefix: plan && plan !== "free" ? "tr_live_abcd1234" : "tr_test_abcd",
      allowed_tools: null,
      is_active: true,
      created_at: "2026-04-27T00:00:00.000Z",
      expires_at: null,
    },
    error: null,
  });
  const gatewayUsers = { select: vi.fn(() => planChain) };
  const apiKeys = { insert: vi.fn(() => insertChain) };
  const from = vi.fn((table: string) =>
    table === "gateway_users" ? gatewayUsers : apiKeys
  );
  mocks.supabaseAdmin.mockReturnValue({ from });
  return { from, apiKeys, gatewayUsers };
}

describe("POST /api/v1/keys", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getAccountActor.mockResolvedValue({
      userId: "user_123",
      email: "agent@example.com",
      authKind: "session",
    });
    mocks.generateApiKey.mockReturnValue({
      raw: "tr_live_aaaa",
      hash: "hash_live",
      prefix: "tr_live_aaaa",
    });
    mocks.generateTestApiKey.mockReturnValue({
      raw: "tr_test_bbbb",
      hash: "hash_test",
      prefix: "tr_test_bbb",
    });
  });

  it("mints a tr_test_ key for free-plan users", async () => {
    buildPostSupabaseMock("free");

    const response = await POST(postRequest({}));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.key).toBe("tr_test_bbbb");
    expect(mocks.generateTestApiKey).toHaveBeenCalled();
    expect(mocks.generateApiKey).not.toHaveBeenCalled();
  });

  it("mints a tr_live_ key for paid-plan users", async () => {
    buildPostSupabaseMock("starter");

    const response = await POST(postRequest({}));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.key).toBe("tr_live_aaaa");
    expect(mocks.generateApiKey).toHaveBeenCalled();
    expect(mocks.generateTestApiKey).not.toHaveBeenCalled();
  });

  it("mints a tr_live_ key for free-plan users with paid credits", async () => {
    buildPostSupabaseMock("free", { credit_balance: 5, lifetime_credits: 5 });

    const response = await POST(postRequest({}));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.key).toBe("tr_live_aaaa");
    expect(mocks.generateApiKey).toHaveBeenCalled();
    expect(mocks.generateTestApiKey).not.toHaveBeenCalled();
  });

  it("defaults missing plan_slug to free (mints tr_test_)", async () => {
    buildPostSupabaseMock(null);

    const response = await POST(postRequest({}));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.key).toBe("tr_test_bbbb");
    expect(mocks.generateTestApiKey).toHaveBeenCalled();
  });
});
