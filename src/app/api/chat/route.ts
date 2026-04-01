import { createClient } from "@/lib/supabase/server";
import { decryptSecret, ConfigError } from "@/lib/crypto";
import { buildAriaSystemPrompt } from "@/content/aria/buildSystemPrompt";
import { NextResponse } from "next/server";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function POST(request: Request) {
  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.sessionId || !body?.message) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { sessionId, message } = body as { sessionId: string; message: string };

  // Verify session belongs to this user (RLS also enforces this, belt-and-suspenders)
  const { data: session } = await supabase
    .from("chat_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Get user's profile — key, model, and display name for the system prompt
  const { data: profile } = await supabase
    .from("profiles")
    .select("openrouter_api_key, openrouter_model, display_name")
    .eq("id", user.id)
    .single();

  // BYOK requirement: every user must supply their own key.
  // No key stored = normal state for a new user, not a server error.
  if (!profile?.openrouter_api_key) {
    return NextResponse.json(
      { error: "No OpenRouter API key configured. Please add one in Settings." },
      { status: 422 }
    );
  }

  // Decrypt the user's key. Two distinct failure modes:
  //   ConfigError  → ENCRYPTION_SECRET is absent/wrong (deployment error, 500)
  //   plain Error  → stored value is malformed (user can re-enter key, 422)
  let decryptedApiKey: string;
  try {
    decryptedApiKey = decryptSecret(profile.openrouter_api_key);
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error("[brat.gg] ENCRYPTION_SECRET misconfiguration:", err.message);
      return NextResponse.json(
        { error: "Server configuration error. Please contact the administrator." },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "Could not read your API key. Please re-enter it in Settings." },
      { status: 422 }
    );
  }

  const model = profile.openrouter_model ?? "x-ai/grok-4.1-fast";

  const systemPrompt = buildAriaSystemPrompt({
    userName: profile.display_name ?? null,
    currentDate: new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    // historySummary not wired in v1 — memory design deferred
  });

  // Persist user message
  await supabase.from("messages").insert({
    session_id: sessionId,
    role: "user",
    content: message,
  });

  // Load conversation history for context
  const { data: history } = await supabase
    .from("messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  const chatMessages = (history ?? []).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // Stream from OpenRouter
  const orResponse = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${decryptedApiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      "X-Title": "brat.gg",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        ...chatMessages,
      ],
      stream: true,
    }),
  });

  if (!orResponse.ok) {
    const err = await orResponse.text().catch(() => "Unknown error");
    return NextResponse.json(
      { error: `OpenRouter error: ${err}` },
      { status: 502 }
    );
  }

  // Collect full content while streaming, then persist
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  (async () => {
    let fullContent = "";
    const reader = orResponse.body!.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        // Collect content from SSE chunks
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const json = JSON.parse(data);
              const delta = json.choices?.[0]?.delta?.content ?? "";
              fullContent += delta;
            } catch {
              // skip
            }
          }
        }

        await writer.write(encoder.encode(chunk));
      }
    } finally {
      await writer.close();

      // Persist assistant message after stream completes
      if (fullContent) {
        const supabase2 = await createClient();
        await supabase2.from("messages").insert({
          session_id: sessionId,
          role: "assistant",
          content: fullContent,
        });
      }
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
