import { createClient } from "@/lib/supabase/server";
import { encryptSecret } from "@/lib/crypto";
import { NextResponse } from "next/server";

const ALLOWED_MODELS = ["x-ai/grok-4.1-fast", "deepseek/deepseek-v3.2"];

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const {
    displayName,
    avatarPath,
    openrouterApiKey,
    openrouterModel,
  } = body as {
    displayName?: string;
    avatarPath?: string | null;
    openrouterApiKey?: string;
    openrouterModel?: string;
  };

  if (openrouterModel !== undefined && !ALLOWED_MODELS.includes(openrouterModel)) {
    return NextResponse.json({ error: "Invalid model selection" }, { status: 400 });
  }

  const update: Record<string, unknown> = {
    id: user.id,
    updated_at: new Date().toISOString(),
  };

  if (displayName !== undefined) {
    update.display_name = displayName.trim() || null;
  }

  if (avatarPath !== undefined) {
    // Store the storage path, not a URL
    update.avatar_url = avatarPath;
  }

  if (openrouterModel !== undefined) {
    update.openrouter_model = openrouterModel;
  }

  // Encrypt API key server-side before writing to DB.
  // An empty string means "clear the key". Undefined means "leave unchanged".
  if (openrouterApiKey !== undefined) {
    if (openrouterApiKey === "") {
      update.openrouter_api_key = null;
    } else {
      try {
        update.openrouter_api_key = encryptSecret(openrouterApiKey);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Encryption failed";
        return NextResponse.json({ error: message }, { status: 500 });
      }
    }
  }

  const { error } = await supabase.from("profiles").upsert(update);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
