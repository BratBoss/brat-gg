import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Constrain `next` to safe internal paths to prevent open-redirect attacks.
  // Reject anything that starts with "//" (protocol-relative) or contains ":"
  // (protocol) or "@" (userinfo), all of which can redirect to external hosts.
  const rawNext = searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.includes(":") && !rawNext.includes("@")
    ? rawNext
    : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Auth failed — redirect to login with error indicator, preserving next so
  // retry after cancel/failure still lands the user at their intended page.
  const failureUrl = next !== "/"
    ? `${origin}/login?error=auth_failed&next=${encodeURIComponent(next)}`
    : `${origin}/login?error=auth_failed`;
  return NextResponse.redirect(failureUrl);
}
