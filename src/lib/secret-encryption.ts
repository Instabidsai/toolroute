import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const PREFIX = "trenc:v1:";
const KEY_ENV = "TOOLROUTE_BYOK_ENCRYPTION_KEY";
const LEGACY_PLAINTEXT_ENV = "TOOLROUTE_ALLOW_LEGACY_PLAINTEXT_BYOK";

function decodeKey(): Buffer {
  const raw = process.env[KEY_ENV];
  if (!raw) {
    throw new Error(`${KEY_ENV} is required to store or read encrypted provider keys`);
  }

  const trimmed = raw.trim();
  const candidates: Buffer[] = [];
  if (/^[0-9a-f]{64}$/i.test(trimmed)) {
    candidates.push(Buffer.from(trimmed, "hex"));
  }
  candidates.push(Buffer.from(trimmed, "base64"));
  candidates.push(Buffer.from(trimmed, "utf8"));

  const key = candidates.find((value) => value.length === 32);
  if (!key) {
    throw new Error(`${KEY_ENV} must decode to exactly 32 bytes`);
  }

  return key;
}

export function isEncryptedSecret(value: string): boolean {
  return value.startsWith(PREFIX);
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", decodeKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return (
    PREFIX +
    [
      iv.toString("base64url"),
      tag.toString("base64url"),
      ciphertext.toString("base64url"),
    ].join(".")
  );
}

export function decryptSecret(storedValue: string): string {
  if (!isEncryptedSecret(storedValue)) {
    if (process.env[LEGACY_PLAINTEXT_ENV] === "true") {
      return storedValue;
    }
    throw new Error("Stored provider key is not encrypted");
  }

  const body = storedValue.slice(PREFIX.length);
  const [ivRaw, tagRaw, ciphertextRaw] = body.split(".");
  if (!ivRaw || !tagRaw || !ciphertextRaw) {
    throw new Error("Stored provider key has an invalid encrypted payload");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    decodeKey(),
    Buffer.from(ivRaw, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function decryptSecretIfEncrypted(storedValue: string): string {
  return isEncryptedSecret(storedValue) ? decryptSecret(storedValue) : storedValue;
}
