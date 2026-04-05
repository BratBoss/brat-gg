import { createClient } from "@/lib/supabase/server";
import { encryptMessage } from "@/lib/crypto";
import { getBratBySlug } from "@/content/brats";
import { getSystemPromptBuilder } from "@/content/brats/getSystemPrompt";
import { NextResponse } from "next/server";
import { decryptApiKey } from "@/lib/chat/keys";
import { recoverHistorySummary, loadDecryptedHistory, refreshSummaryIfNeeded } from "@/lib/chat/history";
import { buildContextMessages } from "@/lib/chat/context";
import { streamOpenRouterChat } from "@/lib/chat/stream";
import { OPENROUTER_API_URL } from "@/lib/chat/openrouter";

export async function POST(request: Request) {
  // TIMING INSTRUMENTATION — remove after diagnosis
  const _t0 = Date.now();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  console.log(`[brat.gg perf] auth: ${Date.now() - _t0}ms`);

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
  console.log(`[brat.gg perf] session row: ${Date.now() - _t0}ms`);

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
  console.log(`[brat.gg perf] profile: ${Date.now() - _t0}ms`);

  // BYOK: missing key is normal for new users (422, not 500).
  if (!profile?.openrouter_api_key) {
    return NextResponse.json(
      { error: "No OpenRouter API key configured. Please add one in Settings." },
      { status: 422 }
    );
  }

  // ConfigError → 500 (deployment misconfiguration); plain Error → 422 (malformed stored key).
  const keyResult = decryptApiKey(profile.openrouter_api_key);
  if (!keyResult.ok) {
    if (keyResult.kind === "config_error") {
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
  const decryptedApiKey = keyResult.key;

  const model = profile.openrouter_model ?? "x-ai/grok-4.1-fast";
  // Speaker label for summarization transcripts.
  const companionName = getBratBySlug(sessionRow.brat_slug as string)?.name ?? "Aria";

  let { historySummary, lastSummarizedCount } = recoverHistorySummary(sessionRow);

  // Persist user message (encrypted at rest).
  await supabase.from("messages").insert({
    session_id: sessionId,
    role: "user",
    content: encryptMessage(message),
  });
  console.log(`[brat.gg perf] msg insert: ${Date.now() - _t0}ms`);

  // Load history including the message just persisted.
  const chatMessages = await loadDecryptedHistory(supabase, sessionId);
  console.log(`[brat.gg perf] history loaded (${chatMessages.length} msgs): ${Date.now() - _t0}ms`);

  // Refresh summary if enough messages aged out. On failure, chat continues with stale/null summary.
  ({ historySummary, lastSummarizedCount } = await refreshSummaryIfNeeded(supabase, {
    sessionId,
    chatMessages,
    lastSummarizedCount,
    historySummary,
    decryptedApiKey,
    model,
    companionName,
  }));
  console.log(`[brat.gg perf] summary refresh: ${Date.now() - _t0}ms`);

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

  const contextMessages = buildContextMessages(chatMessages, historySummary, lastSummarizedCount);

  const streamAbortController = new AbortController();

  console.log(`[brat.gg perf] → fetch OpenRouter at ${Date.now() - _t0}ms`);
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
      messages: [{ role: "system", content: systemPrompt }, ...contextMessages],
      stream: true,
    }),
    signal: streamAbortController.signal,
  });

  if (!orResponse.ok) {
    const err = await orResponse.text().catch(() => "Unknown error");
    return NextResponse.json({ error: `OpenRouter error: ${err}` }, { status: 502 });
  }
  console.log(`[brat.gg perf] OpenRouter headers received: ${Date.now() - _t0}ms`);

  const readable = streamOpenRouterChat(orResponse, sessionId, streamAbortController);

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
