"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

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

export default function ChatClient({
  sessionId,
  initialMessages,
  profile,
}: {
  sessionId: string;
  initialMessages: Message[];
  profile: Profile;
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  async function handleSend() {
    const content = input.trim();
    if (!content || streaming) return;

    if (!profile.hasApiKey) {
      setError("Please add your OpenRouter API key in Settings before chatting.");
      return;
    }

    setError(null);
    setInput("");

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
    startTransition(async () => {
      const supabase = createClient();
      // Delete the session — messages cascade
      await supabase.from("chat_sessions").delete().eq("id", sessionId);
      window.location.reload();
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const userLabel = profile.displayName ?? "You";
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
    <div className="flex flex-col h-[calc(100vh-65px)]">
      {/* Chat header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[#2a3a2c]">
        <div className="flex items-center gap-3">
          <div className="relative w-8 h-8 rounded-full overflow-hidden border border-[#2a3a2c] bg-[#161d17] shrink-0">
            <Image
              src="/images/aria/portrait.jpg"
              alt="Aria"
              fill
              className="object-cover object-top"
              unoptimized
            />
          </div>
          <div>
            <p className="text-[#d6e4d2] text-sm font-medium leading-none">Aria</p>
            <p className="text-[#4a5e4c] text-xs mt-0.5">Glade</p>
          </div>
        </div>

        <button
          onClick={handleNewChat}
          disabled={isPending}
          className="text-xs text-[#4a5e4c] hover:text-[#8aaa8c] transition-colors disabled:opacity-40"
        >
          New chat
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {allDisplayMessages.length === 0 && (
          <div className="flex items-center justify-center h-full text-center">
            {profile.hasApiKey ? (
              <p className="text-[#4a5e4c] text-sm">Say something to begin.</p>
            ) : (
              <p className="text-[#4a5e4c] text-sm">
                Add your OpenRouter API key in{" "}
                <a href="/brats/aria/settings" className="text-[#8aaa8c] underline hover:text-[#d6e4d2] transition-colors">
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
            isStreaming={msg.id === "streaming"}
          />
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="px-6 py-2 border-t border-[#2a3a2c]">
          <p className="text-red-400/80 text-xs">{error}</p>
        </div>
      )}

      {/* Composer */}
      <div className="border-t border-[#2a3a2c] px-6 py-4">
        <div className="flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write something…"
            rows={1}
            disabled={streaming || !profile.hasApiKey}
            className="flex-1 resize-none bg-[#161d17] border border-[#2a3a2c] rounded-md px-4 py-3 text-sm text-[#d6e4d2] placeholder-[#4a5e4c] focus:outline-none focus:border-[#5e7d5a] transition-colors disabled:opacity-40 max-h-36 overflow-y-auto"
            style={{ minHeight: "44px" }}
          />
          <button
            onClick={handleSend}
            disabled={streaming || !input.trim() || !profile.hasApiKey}
            className="shrink-0 px-4 py-3 rounded-md bg-[#2a3a2c] hover:bg-[#3a4e3c] text-[#d6e4d2] text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {streaming ? (
              <span className="inline-block w-4 h-4 border border-[#8aaa8c] border-t-transparent rounded-full animate-spin" />
            ) : (
              "Send"
            )}
          </button>
        </div>
        <p className="text-[#2a3a2c] text-xs mt-2">
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
  isStreaming,
}: {
  message: Message;
  userLabel: string;
  userAvatarUrl: string | null;
  isStreaming: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div className="relative w-7 h-7 rounded-full overflow-hidden border border-[#2a3a2c] bg-[#161d17] shrink-0 mt-0.5">
        {isUser ? (
          userAvatarUrl ? (
            <Image
              src={userAvatarUrl}
              alt={userLabel}
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[10px] text-[#6b8a6e]">
              {userLabel[0]?.toUpperCase()}
            </div>
          )
        ) : (
          <Image
            src="/images/aria/portrait.jpg"
            alt="Aria"
            fill
            className="object-cover object-top"
            unoptimized
          />
        )}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[75%] rounded-lg px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-[#2a3a2c] text-[#d6e4d2]"
            : "bg-[#161d17] border border-[#2a3a2c] text-[#c4d8c0]"
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {isStreaming && (
          <span className="inline-block w-1.5 h-3.5 bg-[#8fb88a] ml-0.5 animate-pulse rounded-sm" />
        )}
      </div>
    </div>
  );
}
