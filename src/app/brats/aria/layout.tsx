import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const navLinks = [
  { label: "Glade", href: "/brats/aria" },
  { label: "Journal", href: "/brats/aria/journal" },
  { label: "Gallery", href: "/brats/aria/gallery" },
  { label: "Chat", href: "/brats/aria/chat" },
  { label: "Settings", href: "/brats/aria/settings" },
];

export default async function AriaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      {/* Top nav */}
      <header className="border-b border-[#2a3a2c] px-6 py-4 flex items-center justify-between gap-6 flex-wrap">
        {/* Brand */}
        <div className="flex items-center text-sm">
          <Link
            href="/"
            className="text-[#4a5e4c] hover:text-[#8aaa8c] transition-colors"
          >
            brat.gg
          </Link>
        </div>

        {/* Section nav */}
        <nav className="flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-3 py-1.5 text-sm text-[#6b8a6e] hover:text-[#d6e4d2] hover:bg-[#161d17] rounded-md transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Auth state */}
        <div className="flex items-center gap-3 text-sm ml-auto">
          {user ? (
            <AuthedUser />
          ) : (
            <Link
              href="/login"
              className="text-[#6b8a6e] hover:text-[#d6e4d2] transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>
      </header>

      {/* Page content */}
      <div className="flex-1">{children}</div>
    </div>
  );
}

async function AuthedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  const label = profile?.display_name ?? user.email?.split("@")[0] ?? "you";

  return (
    <div className="flex items-center gap-3">
      <span className="text-[#4a5e4c] text-xs">{label}</span>
      <SignOutButton />
    </div>
  );
}

function SignOutButton() {
  return (
    <form action="/api/auth/signout" method="POST">
      <button
        type="submit"
        className="text-xs text-[#4a5e4c] hover:text-[#8aaa8c] transition-colors"
      >
        Sign out
      </button>
    </form>
  );
}
