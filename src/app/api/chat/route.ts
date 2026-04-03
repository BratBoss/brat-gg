import { createClient } from "@/lib/supabase/server";
import { decryptSecret, encryptMessage, decryptMessage, ConfigError } from "@/lib/crypto";
import { buildAriaSystemPrompt } from "@/content/aria/buildSystemPrompt";
import {
  shouldRefreshSummary,
  getMessagesToSummarize,
  generateSummary,
  LIVE_WINDOW,
} from "@/lib/summarize";
import { NextResponse } from "next/server";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

// Fallback context limit used when no summary exists yet.
// Once a summary is in place the live window (LIVE_WINDOW = 20) is used instead,
// since older context is covered by the injected summary.
const HISTORY_CONTEXT_LIMIT = 50;

function trimHistory(
  messages: { role: string; content: string }[],
  limit: number
): { role: string; content: string }[] {
  const trimmed = messages.length > limit ? messages.slice(messages.length - limit) : messages;
  // Ensure the retained window starts on a user turn. A raw count-based slice
  // can otherwise produce an orphaned assistant reply at position 0 (no
  // triggering user prompt), which degrades model context quality.
  const firstUser = trimmed.findIndex((m) => m.role === "user");
  return firstUser > 0 ? trimmed.slice(firstUser) : trimmed;
}

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

  // Verify session belongs to this user (RLS also enforces this, belt-and-suspenders).
  // Also load summary fields here to avoid a second round-trip.
  const { data: sessionRow } = await supabase
    .from("chat_sessions")
    .select("id, history_summary, last_summarized_message_count")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (!sessionRow) {
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

  // Decrypt the stored summary, if present. A corrupt summary is non-fatal —
  // treat as absent and continue. The next successful summarization will overwrite it.
  let historySummary: string | null = null;
  if (sessionRow.history_summary) {
    try {
      historySummary = decryptMessage(sessionRow.history_summary as string);
    } catch {
      console.error("[brat.gg] Failed to decrypt session summary — treating as absent");
    }
  }

  // Persist user message (encrypted at rest)
  await supabase.from("messages").insert({
    session_id: sessionId,
    role: "user",
    content: encryptMessage(message),
  });

  // Load full conversation history for context (includes the message just persisted)
  const { data: history } = await supabase
    .from("messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  const chatMessages = (history ?? []).map((m) => ({
    role: m.role as "user" | "assistant",
    content: decryptMessage(m.content),
  }));

  // ── Conversation summary refresh ─────────────────────────────────────────
  // Triggered at request time when enough new messages have aged out of the
  // live context window since the last summary. If summarization fails the
  // chat request continues normally — historySummary retains its previous
  // value (or null), and the model receives the full trimmed history instead.
  const lastSummarizedCount = (sessionRow.last_summarized_message_count as number | null) ?? 0;

  if (shouldRefreshSummary(chatMessages.length, lastSummarizedCount)) {
    try {
      const newMessages = getMessagesToSummarize(chatMessages, lastSummarizedCount);
      if (newMessages.length > 0) {
        const newSummary = await generateSummary(
          newMessages,
          historySummary,
          decryptedApiKey,
          model,
          process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
        );
        await supabase
          .from("chat_sessions")
          .update({
            history_summary: encryptMessage(newSummary),
            summary_updated_at: new Date().toISOString(),
            last_summarized_message_count: chatMessages.length,
          })
          .eq("id", sessionId);
        historySummary = newSummary;
      }
    } catch (err) {
      console.error("[brat.gg] Conversation summary refresh failed, continuing without update:", err);
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  const systemPrompt = buildAriaSystemPrompt({
    userName: profile.display_name ?? null,
    currentDate: new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    historySummary,
  });

  // When a summary is available, only the most recent LIVE_WINDOW messages are
  // sent as raw context — older context is covered by the injected summary.
  // Without a summary, fall back to the full HISTORY_CONTEXT_LIMIT.
  const contextLimit = historySummary ? LIVE_WINDOW : HISTORY_CONTEXT_LIMIT;
  const contextMessages = trimHistory(chatMessages, contextLimit);

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
        ...contextMessages,
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
    let lineBuffer = "";
    const reader = orResponse.body!.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        await writer.write(encoder.encode(chunk));

        // Accumulate into lineBuffer so SSE events split across read() calls
        // are reassembled before parsing. lines.pop() retains any incomplete
        // trailing line for the next iteration.
        lineBuffer += chunk;
        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trimEnd();
            if (data === "[DONE]") continue;
            try {
              const json = JSON.parse(data);
              const delta = json.choices?.[0]?.delta?.content ?? "";
              fullContent += delta;
            } catch {
              // skip malformed chunk
            }
          }
        }
      }

      // P2 fix: flush any remaining buffered content after the read loop ends.
      // lines.pop() holds back the last (possibly incomplete) line on each
      // iteration. If the stream's final SSE event arrives without a trailing
      // newline, that line never enters the for-loop above. Drain it here so
      // the last token is not silently dropped from fullContent.
      if (lineBuffer.startsWith("data: ")) {
        const data = lineBuffer.slice(6).trimEnd();
        if (data && data !== "[DONE]") {
          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content ?? "";
            fullContent += delta;
          } catch {
            // skip malformed
          }
        }
      }
    } finally {
      // P1 fix: persist inside its own try/catch so a DB error cannot prevent
      // writer.close() from running. Without this, any rejection from
      // createClient() or .insert() would leave the TransformStream readable
      // open forever, hanging the browser's reader.read() indefinitely.
      try {
        if (fullContent) {
          const supabase2 = await createClient();
          await supabase2.from("messages").insert({
            session_id: sessionId,
            role: "assistant",
            content: encryptMessage(fullContent),
          });
        }
      } catch (err) {
        console.error("[brat.gg] Failed to persist assistant message:", err);
      } finally {
        await writer.close();
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
