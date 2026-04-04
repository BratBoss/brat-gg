"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

type Profile = {
  displayName: string | null;
  avatarUrl: string | null;
  hasApiKey: boolean;
  model: string;
};

type BratInfo = {
  name: string;
  portrait: string;
  section: string | null;
  settingsHref: string;
};

// Static component overrides for ReactMarkdown — defined outside the component
// to avoid recreation on every render.
const mdComponents: React.ComponentProps<typeof ReactMarkdown>["components"] = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => (
    <strong className="font-semibold text-[var(--th-text)]">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-[var(--th-dim)] underline hover:text-[var(--th-text)] transition-colors"
    >
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul className="list-disc list-outside ml-4 my-2 space-y-0.5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-outside ml-4 my-2 space-y-0.5">{children}</ol>
  ),
  li: ({ children }) => <li>{children}</li>,
  // Block code: pre wraps the code element. Override child code via arbitrary variant.
  pre: ({ children }) => (
    <pre className="bg-[var(--th-bg)] border border-[var(--th-border)] rounded-md p-3 my-2 overflow-x-auto text-[0.85em] font-mono text-[var(--th-dim)] [&_code]:bg-transparent [&_code]:p-0 [&_code]:rounded-none">
      {children}
    </pre>
  ),
  // Inline code — block code inherits the pre overrides above.
  code: ({ children, className }) => (
    <code
      className={`font-mono text-[0.85em] text-[var(--th-dim)] bg-[var(--th-bg)] rounded px-1 py-0.5 ${className ?? ""}`}
    >
      {children}
    </code>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-[var(--th-muted)] pl-3 my-2 italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-[var(--th-border)] my-3" />,
  h1: ({ children }) => (
    <h1 className="text-base font-semibold text-[var(--th-text)] mt-3 mb-1">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-base font-medium text-[var(--th-text)] mt-2 mb-1">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-medium text-[var(--th-text)] mt-2 mb-1">{children}</h3>
  ),
};

export default function ChatClient({
  sessionId,
  initialMessages,
  profile,
  brat,
}: {
  sessionId: string;
  initialMessages: Message[];
  profile: Profile;
  brat: BratInfo;
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Smooth scroll when a new committed message is added.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Instant scroll during streaming — avoids competing smooth-scroll animations
  // on every chunk which causes visible scroll jitter.
  useEffect(() => {
    if (streamingContent) {
      bottomRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [streamingContent]);

  async function handleSend() {
    const content = input.trim();
    if (!content || streaming) return;

    if (!profile.hasApiKey) {
      setError("Please add your OpenRouter API key in Settings before chatting.");
      return;
    }

    setError(null);
    setInput("");
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    // Optimistic user message
    const tempUserMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    setStreaming(true);
    setStreamingContent("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message: content,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let fullContent = "";
      let lineBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });

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
              setStreamingContent(fullContent);
            } catch {
              // skip malformed chunks
            }
          }
        }
      }

      // P2 fix: flush any remaining buffered line after the read loop ends
      // (mirrors the server-side fix — guards against a final SSE event that
      // arrives without a trailing newline).
      if (lineBuffer.startsWith("data: ")) {
        const data = lineBuffer.slice(6).trimEnd();
        if (data && data !== "[DONE]") {
          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content ?? "";
            fullContent += delta;
            setStreamingContent(fullContent);
          } catch {
            // skip malformed
          }
        }
      }

      // Commit assistant message to state
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: fullContent,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setStreamingContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      // Remove the optimistic user message on failure
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
    } finally {
      setStreaming(false);
    }
  }

  async function handleNewChat() {
    if (
      !window.confirm(
        "Start a new chat? This will erase the current conversation."
      )
    ) {
      return;
    }
    startTransition(async () => {
      const supabase = createClient();
      // Delete the session — messages cascade
      await supabase.from("chat_sessions").delete().eq("id", sessionId);
      window.location.reload();
    });
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    // Auto-resize: reset then expand to fit content, capped by max-h via CSS.
    e.target.style.height = "auto";
    e.target.style.height = `${e.target.scrollHeight}px`;
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const userLabel = profile.displayName ?? "You";
  const hasCommittedMessages = messages.length > 0;
  const allDisplayMessages = [
    ...messages,
    ...(streamingContent
      ? [
          {
            id: "streaming",
            role: "assistant" as const,
            content: streamingContent,
            created_at: new Date().toISOString(),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Chat header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--th-border)]">
        <div className="flex items-center gap-3">
          <div className="relative w-8 h-8 rounded-full overflow-hidden border border-[var(--th-border)] bg-[var(--th-surface)] shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={brat.portrait}
              alt={brat.name}
              className="absolute inset-0 h-full w-full object-cover object-top"
            />
          </div>
          <div>
            <p className="text-[var(--th-text)] text-sm font-medium leading-none">{brat.name}</p>
            {brat.section && (
              <p className="text-[var(--th-muted)] text-xs mt-0.5">{brat.section}</p>
            )}
          </div>
        </div>

        <button
          onClick={handleNewChat}
          disabled={isPending || !hasCommittedMessages}
          className="text-xs text-[var(--th-muted)] hover:text-[var(--th-dim)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          New chat
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6 space-y-6">
        {allDisplayMessages.length === 0 && (
          <div className="flex items-center justify-center h-full text-center">
            {profile.hasApiKey ? (
              <p className="text-[var(--th-muted)] text-sm">Say something to begin.</p>
            ) : (
              <p className="text-[var(--th-muted)] text-sm">
                Add your OpenRouter API key in{" "}
                <a href={brat.settingsHref} className="text-[var(--th-dim)] underline hover:text-[var(--th-text)] transition-colors">
                  Settings
                </a>{" "}
                to start chatting.
              </p>
            )}
          </div>
        )}

        {allDisplayMessages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            userLabel={userLabel}
            userAvatarUrl={profile.avatarUrl}
            assistantPortrait={brat.portrait}
            assistantName={brat.name}
            isStreaming={msg.id === "streaming"}
          />
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="px-6 py-2 border-t border-[var(--th-border)]">
          <p className="text-red-400/80 text-xs">{error}</p>
        </div>
      )}

      {/* Composer */}
      <div className="border-t border-[var(--th-border)] px-6 py-4">
        <div className="flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Write something…"
            rows={1}
            disabled={streaming || !profile.hasApiKey}
            className="flex-1 resize-none bg-[var(--th-surface)] border border-[var(--th-border)] rounded-md px-4 py-3 text-base sm:text-sm text-[var(--th-text)] placeholder-[var(--th-muted)] focus:outline-none focus:border-[var(--th-accent)] transition-colors disabled:opacity-40 max-h-36 overflow-y-auto min-h-[44px]"
          />
          <button
            onClick={handleSend}
            disabled={streaming || !input.trim() || !profile.hasApiKey}
            className="shrink-0 px-4 py-3 rounded-md bg-[var(--th-border)] hover:bg-[var(--th-surface-hover)] text-[var(--th-text)] text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {streaming ? (
              <span className="inline-block w-4 h-4 border border-[var(--th-dim)] border-t-transparent rounded-full animate-spin" />
            ) : (
              "Send"
            )}
          </button>
        </div>
        <p className="text-[var(--th-muted)] text-xs mt-2">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  userLabel,
  userAvatarUrl,
  assistantPortrait,
  assistantName,
  isStreaming,
}: {
  message: Message;
  userLabel: string;
  userAvatarUrl: string | null;
  assistantPortrait: string;
  assistantName: string;
  isStreaming: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div className="relative w-7 h-7 rounded-full overflow-hidden border border-[var(--th-border)] bg-[var(--th-surface)] shrink-0 mt-0.5">
        {isUser ? (
          userAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={userAvatarUrl}
              alt={userLabel}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[10px] text-[var(--th-subtle)]">
              {userLabel[0]?.toUpperCase()}
            </div>
          )
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={assistantPortrait}
            alt={assistantName}
            className="absolute inset-0 h-full w-full object-cover object-top"
          />
        )}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[75%] rounded-lg px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-[var(--th-border)] text-[var(--th-text)]"
            : "bg-[var(--th-surface)] border border-[var(--th-border)] text-[var(--th-soft)]"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        ) : isStreaming ? (
          // While streaming, render as plain text so the cursor can sit inline
          // at the end of the content. ReactMarkdown wraps output in block-level
          // elements (<p>, etc.), which forces a sibling <span> onto a new line.
          // Markdown renders once the stream completes and isStreaming is false.
          <p className="whitespace-pre-wrap break-words">
            {message.content}
            <span className="inline-block w-1.5 h-3.5 bg-[var(--th-accent-bright)] ml-0.5 animate-blink rounded-sm" />
          </p>
        ) : (
          <div className="break-words">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
