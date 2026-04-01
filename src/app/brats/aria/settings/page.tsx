import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SettingsClient from "@/components/aria/SettingsClient";

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, openrouter_api_key, openrouter_model")
    .eq("id", user.id)
    .single();

  return (
    <SettingsClient
      userId={user.id}
      initialValues={{
        displayName: profile?.display_name ?? "",
        avatarUrl: profile?.avatar_url ?? null,
        openrouterApiKey: profile?.openrouter_api_key ?? "",
        openrouterModel: profile?.openrouter_model ?? "x-ai/grok-4.1-fast",
      }}
    />
  );
}
