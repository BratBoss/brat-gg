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

/** Deployment misconfiguration (missing/malformed env var). API routes should 500, not 422. */
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

/** Call at server startup (instrumentation.ts) to fail fast on missing/malformed ENCRYPTION_SECRET. */
export function assertEncryptionConfigured(): void {
  getKey(); // throws ConfigError if misconfigured
}

/** Call at server startup (instrumentation.ts) to fail fast on missing/malformed MESSAGE_ENCRYPTION_KEY. */
export function assertMessageEncryptionConfigured(): void {
  getMessageKey(); // throws ConfigError if misconfigured
}

/** AES-256-GCM encrypt with ENCRYPTION_SECRET. Returns "iv:authTag:ciphertext" (hex). */
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

/** Decrypt a value from encryptSecret. ConfigError on bad key; plain Error on malformed value. */
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
// Encrypted payloads are prefixed with "enc:". Message content and
// history summaries are expected to be stored only in this format.
// ---------------------------------------------------------------

const ENC_PREFIX = "enc:";

/** AES-256-GCM encrypt with MESSAGE_ENCRYPTION_KEY. Returns "enc:iv:authTag:ciphertext" (hex). */
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

/** Decrypt a value from encryptMessage. Throws if format invalid, key bad, or auth tag fails. */
export function decryptMessage(stored: string): string {
  if (!stored.startsWith(ENC_PREFIX)) {
    throw new Error("Stored message is not in encrypted format");
  }

  const key = getMessageKey(); // ConfigError propagates as-is
  const payload = stored.slice(ENC_PREFIX.length);
  const parts = payload.split(":");

  if (
    parts.length !== 3 ||
    !/^[0-9a-fA-F]{24}$/.test(parts[0]) ||
    !/^[0-9a-fA-F]{32}$/.test(parts[1]) ||
    !/^[0-9a-fA-F]+$/.test(parts[2])
  ) {
    throw new Error("Stored message has unexpected encrypted format");
  }

  const [ivHex, tagHex, ctHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ct = Buffer.from(ctHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ct).toString("utf8") + decipher.final("utf8");
}
