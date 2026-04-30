import { afterEach, describe, expect, it, vi } from "vitest";
import {
  decryptSecret,
  decryptSecretIfEncrypted,
  encryptSecret,
  isEncryptedSecret,
} from "@/lib/secret-encryption";

const KEY = Buffer.from("0123456789abcdef0123456789abcdef").toString("base64");

describe("secret encryption", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("encrypts provider keys before storage and decrypts them for dispatch", () => {
    vi.stubEnv("TOOLROUTE_BYOK_ENCRYPTION_KEY", KEY);

    const encrypted = encryptSecret("provider-secret");

    expect(encrypted).not.toContain("provider-secret");
    expect(isEncryptedSecret(encrypted)).toBe(true);
    expect(decryptSecret(encrypted)).toBe("provider-secret");
  });

  it("fails closed for legacy plaintext unless the migration escape hatch is explicit", () => {
    vi.stubEnv("TOOLROUTE_BYOK_ENCRYPTION_KEY", KEY);

    expect(() => decryptSecret("plain-secret")).toThrow(/not encrypted/);

    vi.stubEnv("TOOLROUTE_ALLOW_LEGACY_PLAINTEXT_BYOK", "true");
    expect(decryptSecret("plain-secret")).toBe("plain-secret");
  });

  it("passes unencrypted master-pool rows through the compatibility helper", () => {
    expect(decryptSecretIfEncrypted("legacy-master-secret")).toBe(
      "legacy-master-secret"
    );
  });
});
