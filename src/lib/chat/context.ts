import { LIVE_WINDOW } from "@/lib/summarize";

// Fallback context limit used when no summary exists yet.
// Once a summary is in place the live window (LIVE_WINDOW = 20) is used instead,
// since older context is covered by the injected summary.
const HISTORY_CONTEXT_LIMIT = 50;

/**
 * Trims history to `limit` most-recent messages, then ensures the window starts on a
 * user turn. A raw count-based slice can produce an orphaned assistant reply at position 0
 * (no triggering user prompt), which degrades model context quality.
 */
function trimHistory(
  messages: { role: string; content: string }[],
  limit: number
): { role: string; content: string }[] {
  const trimmed = messages.length > limit ? messages.slice(messages.length - limit) : messages;
  const firstUser = trimmed.findIndex((m) => m.role === "user");
  return firstUser > 0 ? trimmed.slice(firstUser) : trimmed;
}

/**
 * Builds the context message window to send to the model.
 *
 * With a summary: anchors at (lastSummarizedCount - LIVE_WINDOW) so no messages fall between
 * summary coverage and the live window. Between refreshes the window grows by at most
 * SUMMARY_TRIGGER_DELTA before the next refresh collapses it back to ~LIVE_WINDOW.
 *
 * Without a summary: falls back to HISTORY_CONTEXT_LIMIT.
 * Either path enforces the orphaned-assistant-message invariant.
 */
export function buildContextMessages(
  chatMessages: { role: string; content: string }[],
  historySummary: string | null,
  lastSummarizedCount: number
): { role: string; content: string }[] {
  if (historySummary) {
    const watermark = Math.max(0, lastSummarizedCount - LIVE_WINDOW);
    const sliced = chatMessages.slice(watermark);
    const firstUser = sliced.findIndex((m) => m.role === "user");
    return firstUser > 0 ? sliced.slice(firstUser) : sliced;
  }
  return trimHistory(chatMessages, HISTORY_CONTEXT_LIMIT);
}
