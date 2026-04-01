import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

// 32 zero-bytes — used only in non-production when ENCRYPTION_SECRET is unset.
// Keys encrypted with this fallback are readable but not secure.
const DEV_FALLBACK_KEY = "0".repeat(64);

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "\x1b[33m[brat.gg] ENCRYPTION_SECRET is not set. " +
          "Using an insecure dev fallback key. " +
          "Set this variable before deploying to production.\x1b[0m"
      );
      return Buffer.from(DEV_FALLBACK_KEY, "hex");
    }
    throw new Error(
      "ENCRYPTION_SECRET is not set. This is required in production. " +
        "Generate one with: openssl rand -hex 32"
    );
  }

  if (secret.length !== 64) {
    throw new Error(
      "ENCRYPTION_SECRET must be exactly 64 hex characters (32 bytes). " +
        "Generate one with: openssl rand -hex 32"
    );
  }

  return Buffer.from(secret, "hex");
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a colon-separated string: iv:authTag:ciphertext (all hex-encoded).
 */
export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12); // 96-bit IV — GCM standard
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts a value produced by encryptSecret.
 * Throws if the input is malformed or the key/tag is wrong.
 */
export function decryptSecret(stored: string): string {
  const key = getKey();
  const parts = stored.split(":");
  if (parts.length !== 3) {
    throw new Error("Encrypted value has unexpected format");
  }
  const [ivHex, tagHex, ctHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ct = Buffer.from(ctHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ct).toString("utf8") + decipher.final("utf8");
}
