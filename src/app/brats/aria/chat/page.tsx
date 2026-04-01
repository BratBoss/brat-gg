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

  // Run in parallel: profile data (no key blob) + key existence check.
  // The key check uses head:true so PostgREST returns only a count — no body.
  const [{ data: profile }, { count: keyCount }] = await Promise.all([
    supabase
      .from("profiles")
      .select("openrouter_model, display_name, avatar_url")
      .eq("id", user.id)
      .single(),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("id", user.id)
      .not("openrouter_api_key", "is", null),
  ]);

  // Generate signed URL for the user's avatar — bucket is private.
  let avatarDisplayUrl: string | null = null;
  if (profile?.avatar_url) {
    const { data: signed } = await supabase.storage
      .from("avatars")
      .createSignedUrl(profile.avatar_url, 3600);
    avatarDisplayUrl = signed?.signedUrl ?? null;
  }

  const session = await getOrCreateSession(supabase, user.id, "aria");

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
        avatarUrl: avatarDisplayUrl,
        hasApiKey: (keyCount ?? 0) > 0,
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
