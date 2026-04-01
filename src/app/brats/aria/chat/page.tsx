import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ChatClient from "@/components/chat/ChatClient";

export const metadata = {
  title: "Chat — Aria | brat.gg",
};

export default async function ChatPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/brats/aria/chat");
  }

  // Load profile to check if BYOK key is set
  const { data: profile } = await supabase
    .from("profiles")
    .select("openrouter_api_key, openrouter_model, display_name, avatar_url")
    .eq("id", user.id)
    .single();

  // Load or create active chat session for this user + brat
  let session = await getOrCreateSession(supabase, user.id, "aria");

  // Load messages for this session
  const { data: messages } = await supabase
    .from("messages")
    .select("id, role, content, created_at")
    .eq("session_id", session.id)
    .order("created_at", { ascending: true });

  return (
    <ChatClient
      sessionId={session.id}
      initialMessages={messages ?? []}
      profile={{
        displayName: profile?.display_name ?? null,
        avatarUrl: profile?.avatar_url ?? null,
        hasApiKey: !!profile?.openrouter_api_key,
        model: profile?.openrouter_model ?? "x-ai/grok-4.1-fast",
      }}
    />
  );
}

async function getOrCreateSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  bratSlug: string
) {
  const { data: existing } = await supabase
    .from("chat_sessions")
    .select("id")
    .eq("user_id", userId)
    .eq("brat_slug", bratSlug)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (existing) return existing;

  const { data: created, error } = await supabase
    .from("chat_sessions")
    .insert({ user_id: userId, brat_slug: bratSlug })
    .select("id")
    .single();

  if (error || !created) throw new Error("Failed to create chat session");
  return created;
}
