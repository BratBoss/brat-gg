import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

// ---------------------------------------------------------------
// BYOK security note
//
// brat.gg is a bring-your-own-key product. Users supply their own
// OpenRouter API keys; no site-managed provider keys exist.
// ENCRYPTION_SECRET protects those keys at rest in the database.
//
// There is no fallback key. If ENCRYPTION_SECRET is absent or
// malformed the server refuses to run. This is intentional:
// silent crypto degradation is worse than a loud startup failure.
// ---------------------------------------------------------------

/**
 * Thrown when the server's ENCRYPTION_SECRET env var is absent or
 * malformed. This is a deployment/configuration error — not a user
 * error. API routes should respond with 500 and a generic message.
 */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET;

  if (!secret) {
    throw new ConfigError(
      "ENCRYPTION_SECRET is not set. " +
        "This is required for BYOK key storage. " +
        "Generate one with: openssl rand -hex 32"
    );
  }

  if (secret.length !== 64) {
    throw new ConfigError(
      "ENCRYPTION_SECRET must be exactly 64 hex characters (32 bytes). " +
        "Generate one with: openssl rand -hex 32"
    );
  }

  return Buffer.from(secret, "hex");
}

/**
 * Call this at server startup (e.g. from instrumentation.ts) to
 * catch a missing or malformed ENCRYPTION_SECRET before any request
 * is served, rather than on the first user interaction that needs it.
 */
export function assertEncryptionConfigured(): void {
  getKey(); // throws ConfigError if misconfigured
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a colon-separated string: iv:authTag:ciphertext (all hex-encoded).
 * Throws ConfigError if ENCRYPTION_SECRET is absent or malformed.
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
 * Throws ConfigError if ENCRYPTION_SECRET is absent or malformed.
 * Throws a plain Error if the stored value is malformed or the auth tag fails.
 */
export function decryptSecret(stored: string): string {
  const key = getKey(); // ConfigError propagates as-is
  const parts = stored.split(":");
  if (parts.length !== 3) {
    throw new Error("Stored value has unexpected format");
  }
  const [ivHex, tagHex, ctHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ct = Buffer.from(ctHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ct).toString("utf8") + decipher.final("utf8");
}
