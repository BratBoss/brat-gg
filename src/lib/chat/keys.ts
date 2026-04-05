import { decryptSecret, ConfigError } from "@/lib/crypto";

export type DecryptKeyResult =
  | { ok: true; key: string }
  | { ok: false; kind: "config_error" | "malformed_key" };

/**
 * Decrypts the stored BYOK API key.
 * ConfigError → kind "config_error" (deployment misconfiguration — caller should 500).
 * Plain Error → kind "malformed_key" (bad stored value — caller should 422).
 */
export function decryptApiKey(encryptedKey: string): DecryptKeyResult {
  try {
    return { ok: true, key: decryptSecret(encryptedKey) };
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error("[brat.gg] ENCRYPTION_SECRET misconfiguration:", (err as Error).message);
      return { ok: false, kind: "config_error" };
    }
    return { ok: false, kind: "malformed_key" };
  }
}
