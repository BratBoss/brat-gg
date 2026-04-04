// Per-session conversation summarization.
// Triggered when messages age out of the live window. Uses the user's OpenRouter key (BYOK).
// Incremental: each refresh passes only newly aged-out messages + previous summary,
// bounding input regardless of conversation length. Stored encrypted (encryptMessage).

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

/** True when messages exist outside the live window AND enough new messages since last refresh. */
export function shouldRefreshSummary(
  totalMessageCount: number,
  lastSummarizedMessageCount: number
): boolean {
  const olderCount = Math.max(0, totalMessageCount - LIVE_WINDOW);
  if (olderCount === 0) return false;
  return totalMessageCount - lastSummarizedMessageCount >= SUMMARY_TRIGGER_DELTA;
}

/**
 * Messages to incorporate into the next summary — those aged out since lastSummarizedMessageCount.
 * First summary (===0): all older messages. Subsequent: only newly aged-out messages.
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
 * Calls OpenRouter to produce an updated session memory summary.
 * Passes only newly aged-out messages + previousSummary (if any); model rewrites as one artifact.
 * companionName labels the assistant speaker. Throws on failure — callers must catch;
 * a failed summary must never block the chat request.
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
