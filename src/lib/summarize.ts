// Per-session conversation summarization helpers.
//
// Summaries are generated at request time when enough new messages have
// accumulated outside the live context window. The user's own OpenRouter
// key is used (BYOK preserved). Summary text is stored encrypted at rest
// using the same MESSAGE_ENCRYPTION_KEY / encryptMessage pattern used for
// message content.
//
// Summarization is incremental: each refresh only passes the messages that
// have aged out of the live window since the previous summary, plus the
// existing summary text for continuity. This bounds the summarizer's input
// regardless of how long the conversation grows.

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

/** Most-recent messages kept as raw context alongside the summary. */
export const LIVE_WINDOW = 20;

/**
 * New messages must accumulate beyond this delta from the last summary
 * before a refresh is triggered. Keeps summarization infrequent.
 */
const SUMMARY_TRIGGER_DELTA = 10;

const SUMMARIZER_SYSTEM_PROMPT = `You are a memory assistant maintaining a compact, updated summary of a conversation.

Your output will be injected into a system prompt as the companion's working memory. Write it accordingly.

Rules:
- Preserve durable user facts: name, identity details, preferences, personality, ongoing projects, stated goals.
- Preserve open or unresolved threads that are still relevant to the relationship or conversation.
- Preserve emotionally significant context: things shared in vulnerability, milestones, meaningful exchanges.
- When new messages contradict or supersede earlier information, correct or replace the stale version — do not preserve both.
- Omit trivial banter, one-off small talk, and low-value chatter that carries no forward relevance.
- Rewrite the entire memory as a single compact artifact. Do not append to or mimic a transcript.
- Write in third person from the companion's perspective ("The user said...", "They mentioned...").
- Stay under 350 words. Return only the summary text — no preamble, labels, or framing.`;

/**
 * Returns true when a summary refresh should be triggered for this session.
 *
 * Conditions:
 *  - There are messages outside the live window (something to summarize).
 *  - Enough new messages have arrived since the last summary watermark.
 */
export function shouldRefreshSummary(
  totalMessageCount: number,
  lastSummarizedMessageCount: number
): boolean {
  const olderCount = Math.max(0, totalMessageCount - LIVE_WINDOW);
  if (olderCount === 0) return false;
  return totalMessageCount - lastSummarizedMessageCount >= SUMMARY_TRIGGER_DELTA;
}

/**
 * Returns the slice of chatMessages that should be incorporated into the
 * next summary — messages that have aged out of the live window since the
 * last summary was generated.
 *
 * On the first summary (lastSummarizedMessageCount === 0) this returns all
 * older messages. On subsequent refreshes it returns only the newly aged-out
 * messages that were in the live window when the previous summary was made.
 */
export function getMessagesToSummarize(
  chatMessages: { role: string; content: string }[],
  lastSummarizedMessageCount: number
): { role: string; content: string }[] {
  const newOlderStart =
    lastSummarizedMessageCount === 0
      ? 0
      : Math.max(0, lastSummarizedMessageCount - LIVE_WINDOW);
  return chatMessages.slice(newOlderStart, chatMessages.length - LIVE_WINDOW);
}

/**
 * Calls OpenRouter to produce an updated memory summary for a session.
 *
 * If previousSummary is present, only the newly aged-out messages are passed
 * alongside it and the model rewrites the combined memory as a single artifact.
 * If no previousSummary, the new messages are summarized from scratch.
 *
 * companionName is the display name for the assistant speaker in the transcript
 * (e.g. "Aria"). Pass it explicitly so this helper stays companion-agnostic.
 *
 * Throws on failure — callers must catch and fall back gracefully.
 * A failed summary must never block the user's chat request.
 */
export async function generateSummary(
  newMessages: { role: string; content: string }[],
  previousSummary: string | null,
  apiKey: string,
  model: string,
  appUrl: string,
  companionName: string
): Promise<string> {
  const conversationText = newMessages
    .map((m) => `${m.role === "user" ? "User" : companionName}: ${m.content}`)
    .join("\n\n");

  const userContent = previousSummary?.trim()
    ? `Existing summary to update:\n\n${previousSummary.trim()}\n\n---\n\nNew messages to incorporate:\n\n${conversationText}`
    : `Conversation to summarize:\n\n${conversationText}`;

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": appUrl,
      "X-Title": "brat.gg",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SUMMARIZER_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      stream: false,
      max_tokens: 600,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "unknown");
    throw new Error(`OpenRouter summary request failed (${response.status}): ${errText}`);
  }

  const json = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("OpenRouter returned an empty summary response");
  }

  return content.trim();
}
