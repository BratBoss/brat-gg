import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { decryptMessage } from "@/lib/crypto";
import { getBratBySlug } from "@/content/brats";
import ChatClient from "@/components/chat/ChatClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const brat = getBratBySlug(slug);
  if (!brat || !brat.available) return {};
  return { title: `Chat — ${brat.name} | brat.gg` };
}

export default async function ChatPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brat = getBratBySlug(slug);

  if (!brat || !brat.available) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/brats/${slug}/chat`);
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

  const session = await getOrCreateSession(supabase, user.id, slug);

  const { data: rawMessages } = await supabase
    .from("messages")
    .select("id, role, content, created_at")
    .eq("session_id", session.id)
    .order("created_at", { ascending: true });

  const messages = (rawMessages ?? []).map((m) => ({
    ...m,
    content: decryptMessage(m.content),
  }));

  return (
    <ChatClient
      sessionId={session.id}
      initialMessages={messages}
      profile={{
        displayName: profile?.display_name ?? null,
        avatarUrl: avatarDisplayUrl,
        hasApiKey: (keyCount ?? 0) > 0,
        model: profile?.openrouter_model ?? "x-ai/grok-4.1-fast",
      }}
      brat={{
        name: brat.name,
        portrait: brat.portrait,
        section: brat.section,
        settingsHref: `/settings?brat=${slug}`, 
      }}
    />
  );
}

async function getOrCreateSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  bratSlug: string
) {
  // Atomic upsert: inserts if no row exists, otherwise updates nothing meaningful
  // (user_id and brat_slug are already correct) and returns the existing row.
  // The unique constraint on (user_id, brat_slug) makes this race-safe — two
  // concurrent requests will both succeed and return the same session id.
  const { data, error } = await supabase
    .from("chat_sessions")
    .upsert(
      { user_id: userId, brat_slug: bratSlug },
      { onConflict: "user_id,brat_slug" }
    )
    .select("id")
    .single();

  if (error || !data) throw new Error("Failed to get or create chat session");
  return data;
}
