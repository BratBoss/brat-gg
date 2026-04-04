import { createClient } from "@/lib/supabase/server";
import { decryptSecret, encryptMessage, decryptMessage, ConfigError } from "@/lib/crypto";
import { getBratBySlug } from "@/content/brats";
import { getSystemPromptBuilder } from "@/content/brats/getSystemPrompt";
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

// How long to wait with no new bytes from OpenRouter before aborting.
// Handles stalled connections where the TCP socket stays open but OpenRouter
// stops sending — reader.read() would otherwise hang forever.
const STREAM_INACTIVITY_MS = 30_000;

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
  const { data: sessionRow } = await supabase
    .from("chat_sessions")
    .select("id, brat_slug, history_summary, last_summarized_message_count")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (!sessionRow) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Fail loudly for unknown slugs rather than silently using a wrong companion.
  const buildSystemPrompt = getSystemPromptBuilder(sessionRow.brat_slug as string);
  if (!buildSystemPrompt) {
    return NextResponse.json(
      { error: `Unsupported companion: ${sessionRow.brat_slug}` },
      { status: 400 }
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("openrouter_api_key, openrouter_model, display_name")
    .eq("id", user.id)
    .single();

  // BYOK: missing key is normal for new users (422, not 500).
  if (!profile?.openrouter_api_key) {
    return NextResponse.json(
      { error: "No OpenRouter API key configured. Please add one in Settings." },
      { status: 422 }
    );
  }

  // ConfigError → deployment error (500); plain Error → malformed stored key (422).
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

  // Speaker label for summarization transcripts.
  const companionName =
    getBratBySlug(sessionRow.brat_slug as string)?.name ?? "Aria";

  // On decrypt failure: zero watermark so context falls back to HISTORY_CONTEXT_LIMIT
  // and next summarization rebuilds from scratch (stale offset would silently skip messages).
  let historySummary: string | null = null;
  let lastSummarizedCount = (sessionRow.last_summarized_message_count as number | null) ?? 0;

  if (sessionRow.history_summary) {
    try {
      historySummary = decryptMessage(sessionRow.history_summary as string);
    } catch {
      lastSummarizedCount = 0;
      console.error("[brat.gg] Failed to decrypt session summary — resetting watermark for this request");
    }
  }

  // Persist user message (encrypted at rest)
  await supabase.from("messages").insert({
    session_id: sessionId,
    role: "user",
    content: encryptMessage(message),
  });

  // Load history including the message just persisted.
  const { data: history } = await supabase
    .from("messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  const chatMessages = (history ?? []).map((m) => ({
    role: m.role as "user" | "assistant",
    content: decryptMessage(m.content),
  }));

  // Refresh summary if enough messages aged out. On failure, chat continues with stale/null summary.
  if (shouldRefreshSummary(chatMessages.length, lastSummarizedCount)) {
    try {
      const newMessages = getMessagesToSummarize(chatMessages, lastSummarizedCount);
      if (newMessages.length > 0) {
        const newSummary = await generateSummary(
          newMessages,
          historySummary,
          decryptedApiKey,
          model,
          process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
          companionName
        );
        // Only advance in-memory state if DB write succeeds — keeps watermark and persisted summary in sync.
        const { error: updateError } = await supabase
          .from("chat_sessions")
          .update({
            history_summary: encryptMessage(newSummary),
            summary_updated_at: new Date().toISOString(),
            last_summarized_message_count: chatMessages.length,
          })
          .eq("id", sessionId);
        if (updateError) {
          console.error("[brat.gg] Failed to persist conversation summary:", updateError.message);
        } else {
          historySummary = newSummary;
          lastSummarizedCount = chatMessages.length; // advance watermark to match DB
        }
      }
    } catch (err) {
      console.error("[brat.gg] Conversation summary refresh failed, continuing without update:", err);
    }
  }

  const systemPrompt = buildSystemPrompt({
    userName: profile.display_name ?? null,
    currentDate: new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    historySummary,
  });

  // Raw context window: when a summary exists, start at (lastSummarizedCount - LIVE_WINDOW)
  // so no messages fall between summary coverage and the live window.
  // Without a summary, fall back to HISTORY_CONTEXT_LIMIT.
  let contextMessages: { role: string; content: string }[];
  if (historySummary) {
    const watermark = Math.max(0, lastSummarizedCount - LIVE_WINDOW);
    const sliced = chatMessages.slice(watermark);
    // Ensure the window starts on a user turn (same invariant as trimHistory).
    const firstUser = sliced.findIndex((m) => m.role === "user");
    contextMessages = firstUser > 0 ? sliced.slice(firstUser) : sliced;
  } else {
    contextMessages = trimHistory(chatMessages, HISTORY_CONTEXT_LIMIT);
  }

  // streamAbortController: inactivity watchdog aborts stalled connections so writer.close() always runs.
  const streamAbortController = new AbortController();

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
    signal: streamAbortController.signal,
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
    let inactivityTimer: ReturnType<typeof setTimeout> | null = null;

    // After STREAM_INACTIVITY_MS with no bytes, abort fetch → reader.read() throws → finally closes writer.
    function resetInactivityTimer() {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(
        () => streamAbortController.abort("stream-inactivity"),
        STREAM_INACTIVITY_MS
      );
    }

    try {
      resetInactivityTimer();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        resetInactivityTimer();

        const chunk = decoder.decode(value, { stream: true });
        await writer.write(encoder.encode(chunk));

        // Reassemble SSE events split across reads; lines.pop() holds partial trailing line.
        lineBuffer += chunk;
        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trimEnd();
            if (data === "[DONE]") continue;

            // Parse first; skip lines with malformed JSON.
            let json: ReturnType<typeof JSON.parse>;
            try {
              json = JSON.parse(data);
            } catch {
              continue;
            }

            // OpenRouter cannot change the HTTP status once streaming begins,
            // so mid-stream errors arrive as SSE events. Detect both shapes:
            //   • top-level { error: { message, code } }
            //   • choices[0].finish_reason === "error"
            if (json.error) {
              throw new Error(
                `OpenRouter mid-stream error: ${json.error?.message ?? JSON.stringify(json.error)}`
              );
            }
            if (json.choices?.[0]?.finish_reason === "error") {
              throw new Error("OpenRouter reported a stream finish error");
            }

            const delta = json.choices?.[0]?.delta?.content ?? "";
            fullContent += delta;
          }
        }
      }

      // Drain lineBuffer: final SSE event may lack a trailing newline and miss the for-loop.
      if (lineBuffer.startsWith("data: ")) {
        const data = lineBuffer.slice(6).trimEnd();
        if (data && data !== "[DONE]") {
          try {
            const json = JSON.parse(data);
            const finishReason = json.choices?.[0]?.finish_reason;
            if (!json.error && finishReason !== "error") {
              const delta = json.choices?.[0]?.delta?.content ?? "";
              fullContent += delta;
            } else if (json.error || finishReason === "error") {
              fullContent = "";
              const clientMsg = "Stream interrupted — please try again.";
              console.error("[brat.gg] Stream tail error:", json.error ?? finishReason);
              try {
                await writer.write(
                  encoder.encode(`event: bratgg_error\ndata: ${JSON.stringify({ message: clientMsg })}\n\n`)
                );
              } catch {
                // writer may already be in an error state; best-effort only
              }
            }
          } catch {
            // skip malformed
          }
        }
      }
    } catch (streamErr) {
      // Clear partial content — persistence is gated on fullContent, preventing partial reply storage.
      fullContent = "";
      // Send structured SSE error so browser exits spinner instead of hanging.
      const isInactivity =
        streamErr instanceof DOMException && streamErr.name === "AbortError";
      const clientMsg = isInactivity
        ? "Response timed out — please try again."
        : "Stream interrupted — please try again.";
      console.error("[brat.gg] Stream error:", streamErr);
      try {
        await writer.write(
          encoder.encode(`event: bratgg_error\ndata: ${JSON.stringify({ message: clientMsg })}\n\n`)
        );
      } catch {
        // writer may already be in an error state; best-effort only
      }
    } finally {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      // DB errors must not prevent writer.close() — a hanging TransformStream blocks the browser forever.
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
