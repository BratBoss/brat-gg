import { decryptSecret, ConfigError } from "@/lib/crypto";
import { NextResponse } from "next/server";

export type DecryptKeyResult =
  | { ok: true; key: string }
  | { ok: false; response: NextResponse };

/**
 * Decrypts the stored BYOK API key.
 * ConfigError → 500 (deployment misconfiguration — ENCRYPTION_SECRET missing/malformed).
 * Plain Error → 422 (malformed stored key — user must re-enter in Settings).
 */
export function decryptApiKey(encryptedKey: string): DecryptKeyResult {
  try {
    return { ok: true, key: decryptSecret(encryptedKey) };
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error("[brat.gg] ENCRYPTION_SECRET misconfiguration:", (err as Error).message);
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Server configuration error. Please contact the administrator." },
          { status: 500 }
        ),
      };
    }
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Could not read your API key. Please re-enter it in Settings." },
        { status: 422 }
      ),
    };
  }
}
