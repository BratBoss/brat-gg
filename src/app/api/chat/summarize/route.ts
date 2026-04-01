import { createClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/crypto";
import { NextResponse } from "next/server";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

// Don't bother summarizing a trivial exchange.
const MIN_MESSAGES_TO_SUMMARIZE = 2;

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.sessionId) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { sessionId } = body as { sessionId: string };

  // Verify session ownership (RLS enforces this too)
  const { data: session } = await supabase
    .from("chat_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Fetch messages for this session
  const { data: messages } = await supabase
    .from("messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  // Attempt summarization if the conversation is worth storing
  if (messages && messages.length >= MIN_MESSAGES_TO_SUMMARIZE) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("openrouter_api_key, openrouter_model, display_name, history_summary")
      .eq("id", user.id)
      .single();

    if (profile?.openrouter_api_key) {
      // Summarization is best-effort — failures don't block session deletion
      try {
        const decryptedKey = decryptSecret(profile.openrouter_api_key);
        const model = profile.openrouter_model ?? "x-ai/grok-4.1-fast";

        const summaryMessages = buildSummaryMessages({
          messages,
          priorSummary: profile.history_summary ?? null,
          userName: profile.display_name ?? null,
        });

        const res = await fetch(OPENROUTER_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${decryptedKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
            "X-Title": "brat.gg",
          },
          body: JSON.stringify({
            model,
            messages: summaryMessages,
            stream: false,
            max_tokens: 250,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const summary: string | undefined =
            data.choices?.[0]?.message?.content?.trim();

          if (summary) {
            await supabase
              .from("profiles")
              .update({ history_summary: summary })
              .eq("id", user.id);
          }
        }
      } catch {
        // Summarization failed (decryption error, API error, etc.).
        // This is intentionally swallowed — the session will still be
        // deleted below so the user gets a clean start regardless.
      }
    }
  }

  // Always delete the session. Messages cascade.
  await supabase.from("chat_sessions").delete().eq("id", sessionId);

  return NextResponse.json({ ok: true });
}

// ---------------------------------------------------------------------------
// Summarization prompt
// ---------------------------------------------------------------------------

function buildSummaryMessages({
  messages,
  priorSummary,
  userName,
}: {
  messages: { role: string; content: string }[];
  priorSummary: string | null;
  userName: string | null;
}): { role: string; content: string }[] {
  const speakerName = userName?.trim() || "the user";
  const conversationText = messages
    .map((m) =>
      m.role === "user"
        ? `${speakerName}: ${m.content}`
        : `Aria: ${m.content}`
    )
    .join("\n\n");

  const systemContent = priorSummary
    ? `You are maintaining Aria's memory of someone she chats with.

Aria already knows this about them:
${priorSummary}

Read the new conversation below and write an updated memory note — 2 to 4 sentences — that incorporates what Aria already knew with what she just learned. Focus on who this person is, what matters to them, and the texture of how they connect with Aria. Write in flowing sentences. No bullet points. No filler.`
    : `You are maintaining Aria's memory. Aria is a warm, intimate digital companion.

Read the conversation below and write a brief memory note — 2 to 4 sentences — about this person. Focus on who they seem to be, what they talked about, anything personal they shared, and the general feel of how they interact with Aria. Write in flowing sentences. No bullet points. No filler.`;

  return [
    { role: "system", content: systemContent },
    { role: "user", content: conversationText },
  ];
}
