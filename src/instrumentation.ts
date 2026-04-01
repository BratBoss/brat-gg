// Next.js instrumentation — runs once per server instance at startup,
// before any request is handled.
//
// We validate ENCRYPTION_SECRET here so a misconfigured deployment
// fails immediately and visibly, rather than on the first user
// interaction that touches the BYOK key storage.

export async function register() {
  // Guard: only run in the Node.js runtime (not Edge).
  // The crypto module is not available in the Edge runtime.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertEncryptionConfigured } = await import("@/lib/crypto");
    assertEncryptionConfigured();
  }
}
