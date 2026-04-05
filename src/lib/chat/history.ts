import { createClient } from "@/lib/supabase/server";
import { decryptMessage, encryptMessage } from "@/lib/crypto";
import {
  shouldRefreshSummary,
  getMessagesToSummarize,
  generateSummary,
} from "@/lib/summarize";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Recovers the decrypted session summary and watermark from a session row.
 * On decrypt failure: zeroes the watermark so context falls back to HISTORY_CONTEXT_LIMIT
 * and the next summarization rebuilds from scratch (stale offset would silently skip messages).
 */
export function recoverHistorySummary(sessionRow: {
  history_summary: unknown;
  last_summarized_message_count: unknown;
}): { historySummary: string | null; lastSummarizedCount: number } {
  let historySummary: string | null = null;
  let lastSummarizedCount = (sessionRow.last_summarized_message_count as number | null) ?? 0;

  if (sessionRow.history_summary) {
    try {
      historySummary = decryptMessage(sessionRow.history_summary as string);
    } catch {
      lastSummarizedCount = 0;
      console.error(
        "[brat.gg] Failed to decrypt session summary — resetting watermark for this request"
      );
    }
  }

  return { historySummary, lastSummarizedCount };
}

/** Loads all messages for a session from the DB and decrypts them. */
export async function loadDecryptedHistory(
  supabase: SupabaseClient,
  sessionId: string
): Promise<{ role: "user" | "assistant"; content: string }[]> {
  const { data: history } = await supabase
    .from("messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  return (history ?? []).map((m) => ({
    role: m.role as "user" | "assistant",
    content: decryptMessage(m.content),
  }));
}

/**
 * Refreshes the session summary if enough messages have aged out of the live window.
 * Only advances in-memory state if the DB write succeeds — keeps watermark and persisted summary in sync.
 * On any failure, chat continues with stale/null summary (never blocks the request).
 */
export async function refreshSummaryIfNeeded(
  supabase: SupabaseClient,
  {
    sessionId,
    chatMessages,
    lastSummarizedCount,
    historySummary,
    decryptedApiKey,
    model,
    companionName,
  }: {
    sessionId: string;
    chatMessages: { role: string; content: string }[];
    lastSummarizedCount: number;
    historySummary: string | null;
    decryptedApiKey: string;
    model: string;
    companionName: string;
  }
): Promise<{ historySummary: string | null; lastSummarizedCount: number }> {
  if (!shouldRefreshSummary(chatMessages.length, lastSummarizedCount)) {
    return { historySummary, lastSummarizedCount };
  }

  try {
    const newMessages = getMessagesToSummarize(chatMessages, lastSummarizedCount);
    if (newMessages.length === 0) return { historySummary, lastSummarizedCount };

    const newSummary = await generateSummary(
      newMessages,
      historySummary,
      decryptedApiKey,
      model,
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      companionName
    );

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
      return { historySummary, lastSummarizedCount };
    }

    // Advance watermark only after successful DB write.
    return { historySummary: newSummary, lastSummarizedCount: chatMessages.length };
  } catch (err) {
    console.error(
      "[brat.gg] Conversation summary refresh failed, continuing without update:",
      err
    );
    return { historySummary, lastSummarizedCount };
  }
}
