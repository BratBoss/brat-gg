import { createClient } from "@/lib/supabase/server";
import { encryptMessage } from "@/lib/crypto";

// How long to wait with no new bytes from OpenRouter before aborting.
// Handles stalled connections where the TCP socket stays open but OpenRouter
// stops sending — reader.read() would otherwise hang forever.
const STREAM_INACTIVITY_MS = 30_000;

/**
 * Pipes orResponse.body through a TransformStream, accumulating assistant content for persistence.
 *
 * Error handling:
 * - Mid-stream OpenRouter errors (SSE event shape) → throws, clears fullContent, sends bratgg_error.
 * - Inactivity timeout → AbortError, clears fullContent, sends bratgg_error.
 * - Any stream error → partial content is NOT persisted.
 *
 * writer.close() always runs in the finally block — even on DB failure — so the browser never hangs.
 */
export function streamOpenRouterChat(
  orResponse: Response,
  sessionId: string,
  streamAbortController: AbortController
): ReadableStream {
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
                  encoder.encode(
                    `event: bratgg_error\ndata: ${JSON.stringify({ message: clientMsg })}\n\n`
                  )
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
      const isInactivity =
        streamErr instanceof DOMException && streamErr.name === "AbortError";
      const clientMsg = isInactivity
        ? "Response timed out — please try again."
        : "Stream interrupted — please try again.";
      console.error("[brat.gg] Stream error:", streamErr);
      try {
        await writer.write(
          encoder.encode(
            `event: bratgg_error\ndata: ${JSON.stringify({ message: clientMsg })}\n\n`
          )
        );
      } catch {
        // writer may already be in an error state; best-effort only
      }
    } finally {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      // DB errors must not prevent writer.close() — a hanging TransformStream blocks the browser forever.
      try {
        if (fullContent) {
          await persistAssistantReply(sessionId, fullContent);
        }
      } catch (err) {
        console.error("[brat.gg] Failed to persist assistant message:", err);
      } finally {
        await writer.close();
      }
    }
  })();

  return readable;
}

async function persistAssistantReply(sessionId: string, content: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("messages").insert({
    session_id: sessionId,
    role: "assistant",
    content: encryptMessage(content),
  });
}
