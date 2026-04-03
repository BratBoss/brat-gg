import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SettingsClient from "@/components/settings/SettingsClient";

export const metadata = {
  title: "Settings | brat.gg",
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/brats/aria/settings");
  }

  // Run in parallel: profile data (no key blob) + key existence check.
  // The key check uses head:true so PostgREST returns only a count — no body.
  const [{ data: profile }, { count: keyCount }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, avatar_url, openrouter_model")
      .eq("id", user.id)
      .single(),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("id", user.id)
      .not("openrouter_api_key", "is", null),
  ]);

  // Generate a short-lived signed URL for display — the bucket is private.
  // We store only the storage path in profiles.avatar_url.
  let avatarDisplayUrl: string | null = null;
  if (profile?.avatar_url) {
    const { data: signed } = await supabase.storage
      .from("avatars")
      .createSignedUrl(profile.avatar_url, 3600);
    avatarDisplayUrl = signed?.signedUrl ?? null;
  }

  return (
    <SettingsClient
      userId={user.id}
      initialValues={{
        displayName: profile?.display_name ?? "",
        avatarPath: profile?.avatar_url ?? null,
        avatarDisplayUrl,
        hasApiKey: (keyCount ?? 0) > 0,
        openrouterModel: profile?.openrouter_model ?? "x-ai/grok-4.1-fast",
      }}
    />
  );
}
