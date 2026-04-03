import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

// ---------------------------------------------------------------
// BYOK security note
//
// brat.gg is a bring-your-own-key product. Users supply their own
// OpenRouter API keys; no site-managed provider keys exist.
// ENCRYPTION_SECRET protects those keys at rest in the database.
//
// MESSAGE_ENCRYPTION_KEY protects conversation message content at
// rest. Both keys are required. Neither has a fallback — silent
// crypto degradation is worse than a loud startup failure.
// ---------------------------------------------------------------

/**
 * Thrown when a required encryption env var is absent or malformed.
 * This is a deployment/configuration error — not a user error.
 * API routes should respond with 500 and a generic message.
 */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

function getKeyFor(envVar: string): Buffer {
  const secret = process.env[envVar];

  if (!secret) {
    throw new ConfigError(
      `${envVar} is not set. ` +
        "Generate one with: openssl rand -hex 32"
    );
  }

  if (!/^[0-9a-fA-F]{64}$/.test(secret)) {
    throw new ConfigError(
      `${envVar} must be exactly 64 hex characters (32 bytes). ` +
        "Generate one with: openssl rand -hex 32"
    );
  }

  return Buffer.from(secret, "hex");
}

function getKey(): Buffer {
  return getKeyFor("ENCRYPTION_SECRET");
}

function getMessageKey(): Buffer {
  return getKeyFor("MESSAGE_ENCRYPTION_KEY");
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
 * Call this at server startup to catch a missing or malformed
 * MESSAGE_ENCRYPTION_KEY before any request is served.
 */
export function assertMessageEncryptionConfigured(): void {
  getMessageKey(); // throws ConfigError if misconfigured
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

// ---------------------------------------------------------------
// Message content encryption (MESSAGE_ENCRYPTION_KEY)
//
// Encrypted payloads are prefixed with "enc:" so that legacy
// plaintext rows can be read back transparently without a backfill.
// New rows are always written encrypted.
// ---------------------------------------------------------------

const ENC_PREFIX = "enc:";

/**
 * Encrypts a message content string using AES-256-GCM.
 * Returns "enc:iv:authTag:ciphertext" (all hex-encoded).
 * Throws ConfigError if MESSAGE_ENCRYPTION_KEY is absent or malformed.
 */
export function encryptMessage(plaintext: string): string {
  const key = getMessageKey();
  const iv = randomBytes(12); // 96-bit IV — GCM standard
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts a message content string produced by encryptMessage.
 *
 * If the value does not start with "enc:", it is returned as-is —
 * this handles legacy plaintext rows written before encryption was
 * enabled, so existing conversation history remains readable.
 *
 * Throws ConfigError if MESSAGE_ENCRYPTION_KEY is absent or malformed.
 * Throws a plain Error if the stored value is malformed or the auth tag fails.
 */
export function decryptMessage(stored: string): string {
  if (!stored.startsWith(ENC_PREFIX)) {
    return stored; // legacy plaintext row — return unchanged
  }
  const key = getMessageKey(); // ConfigError propagates as-is
  const payload = stored.slice(ENC_PREFIX.length);
  const parts = payload.split(":");
  // Validate structural shape: iv (24 hex chars / 12 bytes), authTag (32 hex chars / 16 bytes),
  // ciphertext (non-empty hex). If the payload doesn't match, the "enc:" prefix was coincidental
  // plaintext — return the original value unchanged rather than crashing chat history.
  if (
    parts.length !== 3 ||
    !/^[0-9a-fA-F]{24}$/.test(parts[0]) ||
    !/^[0-9a-fA-F]{32}$/.test(parts[1]) ||
    !/^[0-9a-fA-F]+$/.test(parts[2])
  ) {
    return stored; // not a valid encrypted payload — treat as plaintext
  }
  const [ivHex, tagHex, ctHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ct = Buffer.from(ctHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ct).toString("utf8") + decipher.final("utf8");
}
